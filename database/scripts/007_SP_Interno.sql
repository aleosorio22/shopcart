/* 007 - Piezas internas. No abren transaccion: corren dentro de la del SP que las llama y
   dejan subir el error a su CATCH. El rol de la aplicacion no puede ejecutarlas directamente. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
-- Se llama siempre: con un pool de conexiones el contexto anterior debe sobrescribirse.
CREATE OR ALTER PROCEDURE Interno.SP_Contexto_Establecer
    @IDUsuario INT, @Motivo NVARCHAR(300) = NULL, @DireccionIP VARCHAR(45) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    EXEC sys.sp_set_session_context @key = N'IDUsuario', @value = @IDUsuario;
    EXEC sys.sp_set_session_context @key = N'Motivo', @value = @Motivo;
    EXEC sys.sp_set_session_context @key = N'DireccionIP', @value = @DireccionIP;
END;
GO
CREATE OR ALTER PROCEDURE Interno.SP_Error_Lanzar @Codigo INT, @Detalle NVARCHAR(500) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Mensaje NVARCHAR(2048);
    SELECT @Mensaje = Mensaje FROM Config.ErrorNegocio WHERE Codigo = @Codigo;
    SET @Mensaje = CONCAT(ISNULL(@Mensaje, N'Error de negocio.'), CASE WHEN @Detalle IS NULL THEN N'' ELSE N' ' + @Detalle END);
    ;THROW @Codigo, @Mensaje, 1;
END;
GO
-- Debe llamarse desde CATCH y despues del ROLLBACK para que el registro sobreviva.
-- Los errores de negocio son esperados y no se registran.
CREATE OR ALTER PROCEDURE Interno.SP_Error_Registrar
AS
BEGIN
    SET NOCOUNT ON;
    IF ERROR_NUMBER() BETWEEN 51000 AND 59999 RETURN;
    INSERT Auditoria.ErrorBD (IDUsuario, Numero, Severidad, Estado, Procedimiento, Linea, Mensaje)
    VALUES (CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), ERROR_NUMBER(), ERROR_SEVERITY(), ERROR_STATE(), ERROR_PROCEDURE(), ERROR_LINE(), ERROR_MESSAGE());
END;
GO
-- @Permiso NULL solo comprueba que el usuario exista y este activo.
CREATE OR ALTER PROCEDURE Interno.SP_Seguridad_ExigirPermiso @IDUsuario INT, @Permiso VARCHAR(60) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDRol SMALLINT;
    SELECT @IDRol = IDRol FROM Seguridad.Usuario WHERE IDUsuario = @IDUsuario AND Activo = 1;
    IF @IDRol IS NULL EXEC Interno.SP_Error_Lanzar 51002;
    IF @Permiso IS NOT NULL AND NOT EXISTS (
        SELECT 1 FROM Seguridad.RolPermiso rp JOIN Seguridad.Permiso p ON p.IDPermiso = rp.IDPermiso
        WHERE rp.IDRol = @IDRol AND p.Codigo = @Permiso)
        EXEC Interno.SP_Error_Lanzar 51000;
END;
GO
/* Unico punto que altera Existencia.Fisica: cada cambio deja su fila en kardex.
   @Cantidad siempre positiva; el signo lo da el tipo de movimiento. */
CREATE OR ALTER PROCEDURE Interno.SP_Inventario_RegistrarMovimiento
    @IDVariante INT, @IDBodega INT, @TipoMovimiento VARCHAR(30), @Cantidad INT, @Motivo NVARCHAR(300),
    @IDUsuario INT, @CostoUnitario DECIMAL(18,4) = NULL, @LiberarReserva INT = 0,
    @IDPedidoDetalle BIGINT = NULL, @ReferenciaDocumento NVARCHAR(60) = NULL, @IDGrupoMovimiento UNIQUEIDENTIFIER = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDTipo TINYINT, @Signo SMALLINT, @ExigeMotivo BIT, @Fisica INT, @Reservada INT, @Costo DECIMAL(18,4), @Nuevo INT;

    SELECT @IDTipo = IDTipoMovimiento, @Signo = Signo, @ExigeMotivo = ExigeMotivo
    FROM Inventario.TipoMovimiento WHERE Codigo = @TipoMovimiento;
    IF @IDTipo IS NULL OR @Cantidad IS NULL OR @Cantidad <= 0 EXEC Interno.SP_Error_Lanzar 51006, N'Movimiento invalido.';
    IF @ExigeMotivo = 1 AND LEN(LTRIM(RTRIM(ISNULL(@Motivo, N'')))) = 0 EXEC Interno.SP_Error_Lanzar 51202;

    SELECT @Fisica = Fisica, @Reservada = Reservada, @Costo = CostoPromedio
    FROM Inventario.Existencia WITH (UPDLOCK, HOLDLOCK, ROWLOCK)
    WHERE IDVariante = @IDVariante AND IDBodega = @IDBodega;
    IF @Fisica IS NULL
    BEGIN
        INSERT Inventario.Existencia (IDVariante, IDBodega) VALUES (@IDVariante, @IDBodega);
        SELECT @Fisica = 0, @Reservada = 0, @Costo = 0;
    END;

    SET @Nuevo = @Fisica + @Signo * @Cantidad;
    -- Un ajuste tampoco puede quitar unidades ya reservadas por otro cliente.
    IF @Nuevo < 0 OR @Nuevo < @Reservada - @LiberarReserva EXEC Interno.SP_Error_Lanzar 51203;

    IF @Signo = 1 AND @CostoUnitario IS NOT NULL
        SET @Costo = CASE WHEN @Nuevo = 0 THEN @CostoUnitario
                          ELSE (@Fisica * @Costo + @Cantidad * @CostoUnitario) / @Nuevo END;

    UPDATE Inventario.Existencia
    SET Fisica = @Nuevo, Reservada = Reservada - @LiberarReserva, CostoPromedio = @Costo, ActualizadoEn = SYSUTCDATETIME()
    WHERE IDVariante = @IDVariante AND IDBodega = @IDBodega;

    INSERT Inventario.Kardex (IDVariante, IDBodega, IDTipoMovimiento, Cantidad, SaldoAnterior, SaldoNuevo, CostoUnitario,
                              Motivo, IDUsuario, ReferenciaDocumento, IDGrupoMovimiento, IDPedidoDetalle)
    VALUES (@IDVariante, @IDBodega, @IDTipo, @Signo * @Cantidad, @Fisica, @Nuevo, ISNULL(@CostoUnitario, @Costo),
            ISNULL(NULLIF(LTRIM(RTRIM(@Motivo)), N''), @TipoMovimiento), @IDUsuario, @ReferenciaDocumento, @IDGrupoMovimiento, @IDPedidoDetalle);
END;
GO
/* Reparte la cantidad entre bodegas por prioridad. El UPDATE lleva la condicion de
   disponibilidad en el WHERE: es la operacion atomica que impide vender la ultima unidad
   dos veces. Quien llama debe recorrer las variantes en orden para evitar deadlocks. */
CREATE OR ALTER PROCEDURE Interno.SP_Inventario_ReservarExistencia
    @IDCheckout BIGINT, @IDVariante INT, @Cantidad INT, @IDSucursal INT, @ExpiraEn DATETIME2(3)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Restante INT = @Cantidad, @IDBodega INT, @Disponible INT, @Tomar INT, @SKU VARCHAR(40);
    WHILE @Restante > 0
    BEGIN
        SET @IDBodega = NULL;
        SELECT TOP (1) @IDBodega = e.IDBodega, @Disponible = e.Disponible
        FROM Inventario.Existencia e WITH (UPDLOCK, ROWLOCK)
        JOIN Inventario.Bodega b ON b.IDBodega = e.IDBodega
        WHERE e.IDVariante = @IDVariante AND e.Disponible > 0 AND b.Activo = 1
          AND ((@IDSucursal IS NULL AND b.PermiteVentaEnLinea = 1) OR b.IDSucursal = @IDSucursal)
        ORDER BY b.Prioridad, b.IDBodega;

        IF @IDBodega IS NULL
        BEGIN
            SELECT @SKU = SKU FROM Catalogo.Variante WHERE IDVariante = @IDVariante;
            SET @SKU = CONCAT('SKU ', @SKU);
            EXEC Interno.SP_Error_Lanzar 51201, @SKU;
        END;

        SET @Tomar = CASE WHEN @Disponible < @Restante THEN @Disponible ELSE @Restante END;
        UPDATE Inventario.Existencia SET Reservada = Reservada + @Tomar, ActualizadoEn = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDBodega = @IDBodega AND Fisica - Reservada >= @Tomar;
        IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51201;

        INSERT Inventario.Reserva (IDCheckout, IDVariante, IDBodega, Cantidad, ExpiraEn)
        VALUES (@IDCheckout, @IDVariante, @IDBodega, @Tomar, @ExpiraEn);
        SET @Restante -= @Tomar;
    END;
END;
GO
-- Devuelve reservas y uso de cupon de un checkout no completado. Bloquea en el mismo orden que la reserva.
CREATE OR ALTER PROCEDURE Interno.SP_Checkout_Liberar @IDCheckout BIGINT, @EstadoFinal VARCHAR(12)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDReserva BIGINT, @IDVariante INT, @IDBodega INT, @Cantidad INT, @IDCupon INT;
    DECLARE c CURSOR LOCAL FAST_FORWARD FOR
        SELECT IDReserva, IDVariante, IDBodega, Cantidad FROM Inventario.Reserva
        WHERE IDCheckout = @IDCheckout AND Estado = 'ACTIVA' ORDER BY IDVariante, IDBodega;
    OPEN c;
    FETCH NEXT FROM c INTO @IDReserva, @IDVariante, @IDBodega, @Cantidad;
    WHILE @@FETCH_STATUS = 0
    BEGIN
        UPDATE Inventario.Existencia SET Reservada = Reservada - @Cantidad, ActualizadoEn = SYSUTCDATETIME()
        WHERE IDVariante = @IDVariante AND IDBodega = @IDBodega;
        UPDATE Inventario.Reserva SET Estado = 'LIBERADA' WHERE IDReserva = @IDReserva;
        FETCH NEXT FROM c INTO @IDReserva, @IDVariante, @IDBodega, @Cantidad;
    END;
    CLOSE c; DEALLOCATE c;

    SELECT @IDCupon = IDCupon FROM Ventas.CuponUso WHERE IDCheckout = @IDCheckout AND Estado = 'RESERVADO';
    IF @IDCupon IS NOT NULL
    BEGIN
        UPDATE Marketing.Cupon SET UsosActuales = UsosActuales - 1 WHERE IDCupon = @IDCupon;
        UPDATE Ventas.CuponUso SET Estado = 'REVERTIDO' WHERE IDCheckout = @IDCheckout;
    END;
    UPDATE Ventas.Checkout SET Estado = @EstadoFinal WHERE IDCheckout = @IDCheckout;
END;
GO
/* Valida con un error especifico por causa. Con @ConsumirUso = 1 toma primero el bloqueo
   exclusivo del cupon: serializa a los clientes y hace confiable el conteo por cliente. */
CREATE OR ALTER PROCEDURE Interno.SP_Cupones_Validar
    @IDCupon INT, @IDUsuario INT, @IDCarrito BIGINT, @ConsumirUso BIT = 0, @Descuento DECIMAL(18,2) OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(), @Activo BIT, @Desde DATETIME2(3), @Hasta DATETIME2(3), @LimiteTotal INT,
            @LimiteCliente INT, @Usos INT, @Minimo DECIMAL(18,2), @Subtotal DECIMAL(18,2), @Elegible DECIMAL(18,2), @UsosCliente INT;

    IF @ConsumirUso = 1
    BEGIN
        UPDATE Marketing.Cupon SET UsosActuales = UsosActuales + 1
        WHERE IDCupon = @IDCupon AND (LimiteTotal IS NULL OR UsosActuales < LimiteTotal);
        IF @@ROWCOUNT = 0
        BEGIN
            IF EXISTS (SELECT 1 FROM Marketing.Cupon WHERE IDCupon = @IDCupon) EXEC Interno.SP_Error_Lanzar 51305;
            EXEC Interno.SP_Error_Lanzar 51301;
        END;
    END;

    SELECT @Activo = Activo, @Desde = VigenteDesde, @Hasta = VigenteHasta, @LimiteTotal = LimiteTotal,
           @LimiteCliente = LimitePorCliente, @Usos = UsosActuales, @Minimo = MontoMinimo
    FROM Marketing.Cupon WHERE IDCupon = @IDCupon;

    IF @Activo IS NULL EXEC Interno.SP_Error_Lanzar 51301;
    IF @Activo = 0 EXEC Interno.SP_Error_Lanzar 51302;
    IF @Ahora < @Desde EXEC Interno.SP_Error_Lanzar 51303;
    IF @Ahora >= @Hasta EXEC Interno.SP_Error_Lanzar 51304;
    IF @ConsumirUso = 0 AND @LimiteTotal IS NOT NULL AND @Usos >= @LimiteTotal EXEC Interno.SP_Error_Lanzar 51305;

    IF @IDUsuario IS NOT NULL
    BEGIN
        SELECT @UsosCliente = COUNT(*) FROM Ventas.CuponUso
        WHERE IDCupon = @IDCupon AND IDUsuario = @IDUsuario AND Estado <> 'REVERTIDO';
        IF @UsosCliente >= @LimiteCliente EXEC Interno.SP_Error_Lanzar 51306;
    END;

    SELECT @Subtotal = Subtotal, @Elegible = Elegible, @Descuento = Descuento
    FROM Interno.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito, @Ahora);
    IF @Subtotal < @Minimo EXEC Interno.SP_Error_Lanzar 51307;
    IF @Elegible <= 0 EXEC Interno.SP_Error_Lanzar 51308;
END;
GO
-- El carrito siempre se deduce de la sesion o del token: el cliente nunca envia un IDCarrito.
CREATE OR ALTER PROCEDURE Interno.SP_Carrito_Resolver
    @IDUsuario INT, @HashTokenInvitado BINARY(32), @Crear BIT, @IDCarrito BIGINT OUTPUT
AS
BEGIN
    SET NOCOUNT ON;
    SET @IDCarrito = NULL;
    IF @IDUsuario IS NULL AND @HashTokenInvitado IS NULL EXEC Interno.SP_Error_Lanzar 51006, N'Se requiere sesion o token de invitado.';
    IF @IDUsuario IS NOT NULL SET @HashTokenInvitado = NULL;

    SELECT @IDCarrito = IDCarrito FROM Ventas.Carrito WITH (UPDLOCK, HOLDLOCK)
    WHERE Estado = 'ACTIVO'
      AND ((@IDUsuario IS NOT NULL AND IDUsuario = @IDUsuario)
        OR (@IDUsuario IS NULL AND HashTokenInvitado = @HashTokenInvitado));

    IF @IDCarrito IS NULL AND @Crear = 1
    BEGIN
        INSERT Ventas.Carrito (IDUsuario, HashTokenInvitado) VALUES (@IDUsuario, @HashTokenInvitado);
        SET @IDCarrito = SCOPE_IDENTITY();
    END;
END;
GO
