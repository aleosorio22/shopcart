/* 010 - RF-04 y RF-05. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
-- Encabezado y lineas. Un cupon que dejo de aplicar muestra descuento cero, sin romper la lectura;
-- el checkout es quien lo valida y rechaza con el mensaje especifico.
CREATE OR ALTER PROCEDURE Api.SP_Carrito_Obtener @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDCarrito BIGINT, @IDCupon INT, @Ahora DATETIME2(3) = SYSUTCDATETIME(), @Subtotal DECIMAL(18,2), @Descuento DECIMAL(18,2) = 0;
    EXEC Interno.SP_Carrito_Resolver @IDUsuario, @HashTokenInvitado, 0, @IDCarrito OUTPUT;
    SELECT @IDCupon = IDCupon FROM Ventas.Carrito WHERE IDCarrito = @IDCarrito;
    SELECT @Subtotal = ISNULL(SUM(Subtotal), 0) FROM Interno.FU_Carrito_Lineas(@IDCarrito, @Ahora);

    SELECT @Descuento = d.Descuento
    FROM Interno.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito, @Ahora) d
    JOIN Marketing.Cupon c ON c.IDCupon = d.IDCupon
    WHERE c.Activo = 1 AND @Ahora >= c.VigenteDesde AND @Ahora < c.VigenteHasta AND d.Subtotal >= c.MontoMinimo;

    SELECT @IDCarrito AS IDCarrito, c.Codigo AS CodigoCupon, @Subtotal AS Subtotal, @Descuento AS Descuento,
           CAST(@Subtotal - @Descuento AS DECIMAL(18,2)) AS Total
    FROM (SELECT 1 AS x) u LEFT JOIN Marketing.Cupon c ON c.IDCupon = @IDCupon;

    SELECT IDVariante, SKU, IDProducto, NombreProducto, Cantidad, PrecioLista, DescuentoUnitario, PrecioFinal, Subtotal, Disponible, Vendible
    FROM Interno.FU_Carrito_Lineas(@IDCarrito, @Ahora) ORDER BY IDCarritoDetalle;
END;
GO
-- Modo SUMAR agrega a lo existente; modo FIJAR deja la cantidad indicada.
CREATE OR ALTER PROCEDURE Interno.SP_Carrito_EscribirLinea
    @IDUsuario INT, @HashTokenInvitado BINARY(32), @IDVariante INT, @Cantidad INT, @Sumar BIT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        IF @Cantidad IS NULL OR @Cantidad <= 0 EXEC Interno.SP_Error_Lanzar 51006, N'La cantidad debe ser mayor que cero.';
        DECLARE @IDCarrito BIGINT, @Actual INT = 0, @Final INT, @Disponible INT;
        BEGIN TRAN;
        EXEC Interno.SP_Carrito_Resolver @IDUsuario, @HashTokenInvitado, 1, @IDCarrito OUTPUT;
        IF NOT EXISTS (SELECT 1 FROM Catalogo.Variante v JOIN Catalogo.Producto p ON p.IDProducto = v.IDProducto
                       WHERE v.IDVariante = @IDVariante AND v.Activo = 1 AND p.Activo = 1)
            EXEC Interno.SP_Error_Lanzar 51104;
        SELECT @Actual = Cantidad FROM Ventas.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        SET @Final = CASE WHEN @Sumar = 1 THEN @Actual + @Cantidad ELSE @Cantidad END;
        SELECT @Disponible = Disponible FROM Interno.FU_Inventario_Disponible(@IDVariante, NULL);
        IF @Final > @Disponible EXEC Interno.SP_Error_Lanzar 51201;
        UPDATE Ventas.CarritoDetalle SET Cantidad = @Final WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        IF @@ROWCOUNT = 0 INSERT Ventas.CarritoDetalle (IDCarrito, IDVariante, Cantidad) VALUES (@IDCarrito, @IDVariante, @Final);
        UPDATE Ventas.Carrito SET UltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Carrito_AgregarItem @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL, @IDVariante INT, @Cantidad INT = 1
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Carrito_EscribirLinea @IDUsuario, @HashTokenInvitado, @IDVariante, @Cantidad, 1;
    EXEC Api.SP_Carrito_Obtener @IDUsuario, @HashTokenInvitado;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Carrito_ActualizarCantidad @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL, @IDVariante INT, @Cantidad INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Carrito_EscribirLinea @IDUsuario, @HashTokenInvitado, @IDVariante, @Cantidad, 0;
    EXEC Api.SP_Carrito_Obtener @IDUsuario, @HashTokenInvitado;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Carrito_EliminarItem @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL, @IDVariante INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @IDCarrito BIGINT;
        BEGIN TRAN;
        EXEC Interno.SP_Carrito_Resolver @IDUsuario, @HashTokenInvitado, 0, @IDCarrito OUTPUT;
        DELETE Ventas.CarritoDetalle WHERE IDCarrito = @IDCarrito AND IDVariante = @IDVariante;
        UPDATE Ventas.Carrito SET UltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
    EXEC Api.SP_Carrito_Obtener @IDUsuario, @HashTokenInvitado;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Carrito_AplicarCupon @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL, @Codigo VARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @IDCarrito BIGINT, @IDCupon INT, @Descuento DECIMAL(18,2);
        SELECT @IDCupon = IDCupon FROM Marketing.Cupon WHERE Codigo = UPPER(LTRIM(RTRIM(@Codigo)));
        IF @IDCupon IS NULL EXEC Interno.SP_Error_Lanzar 51301;
        BEGIN TRAN;
        EXEC Interno.SP_Carrito_Resolver @IDUsuario, @HashTokenInvitado, 0, @IDCarrito OUTPUT;
        IF @IDCarrito IS NULL EXEC Interno.SP_Error_Lanzar 51402;
        EXEC Interno.SP_Cupones_Validar @IDCupon, @IDUsuario, @IDCarrito, 0, @Descuento OUTPUT;
        UPDATE Ventas.Carrito SET IDCupon = @IDCupon, UltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
    EXEC Api.SP_Carrito_Obtener @IDUsuario, @HashTokenInvitado;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Carrito_QuitarCupon @IDUsuario INT = NULL, @HashTokenInvitado BINARY(32) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @IDCarrito BIGINT;
    EXEC Interno.SP_Carrito_Resolver @IDUsuario, @HashTokenInvitado, 0, @IDCarrito OUTPUT;
    UPDATE Ventas.Carrito SET IDCupon = NULL, UltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @IDCarrito;
    EXEC Api.SP_Carrito_Obtener @IDUsuario, @HashTokenInvitado;
END;
GO
-- Al iniciar sesion: el carrito de invitado se suma al del usuario.
CREATE OR ALTER PROCEDURE Api.SP_Carrito_FusionarInvitado @IDUsuario INT, @HashTokenInvitado BINARY(32)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @Invitado BIGINT, @Destino BIGINT;
        BEGIN TRAN;
        EXEC Interno.SP_Carrito_Resolver NULL, @HashTokenInvitado, 0, @Invitado OUTPUT;
        IF @Invitado IS NOT NULL
        BEGIN
            EXEC Interno.SP_Carrito_Resolver @IDUsuario, NULL, 1, @Destino OUTPUT;
            UPDATE d SET Cantidad = d.Cantidad + o.Cantidad
            FROM Ventas.CarritoDetalle d JOIN Ventas.CarritoDetalle o ON o.IDVariante = d.IDVariante AND o.IDCarrito = @Invitado
            WHERE d.IDCarrito = @Destino;
            INSERT Ventas.CarritoDetalle (IDCarrito, IDVariante, Cantidad)
            SELECT @Destino, o.IDVariante, o.Cantidad FROM Ventas.CarritoDetalle o
            WHERE o.IDCarrito = @Invitado
              AND NOT EXISTS (SELECT 1 FROM Ventas.CarritoDetalle d WHERE d.IDCarrito = @Destino AND d.IDVariante = o.IDVariante);
            UPDATE Ventas.Carrito SET Estado = 'FUSIONADO' WHERE IDCarrito = @Invitado;
            UPDATE Ventas.Carrito SET UltimaActividad = SYSUTCDATETIME() WHERE IDCarrito = @Destino;
        END;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
    EXEC Api.SP_Carrito_Obtener @IDUsuario, NULL;
END;
GO
/* ---------- Administracion de cupones ---------- */
CREATE OR ALTER PROCEDURE Api.SP_Cupones_Guardar
    @IDUsuarioActor INT, @IDCupon INT = NULL, @Codigo VARCHAR(40), @Descripcion NVARCHAR(200) = NULL, @TipoDescuento VARCHAR(10), @Valor DECIMAL(18,2),
    @DescuentoMaximo DECIMAL(18,2) = NULL, @MontoMinimo DECIMAL(18,2) = 0, @VigenteDesde DATETIME2(3), @VigenteHasta DATETIME2(3),
    @LimiteTotal INT = NULL, @LimitePorCliente INT = 1, @IDCategoria INT = NULL, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CUPONES_GESTIONAR';
        SET @Codigo = UPPER(LTRIM(RTRIM(@Codigo)));
        IF @IDCupon IS NULL
        BEGIN
            INSERT Marketing.Cupon (Codigo, Descripcion, TipoDescuento, Valor, DescuentoMaximo, MontoMinimo, VigenteDesde, VigenteHasta, LimiteTotal, LimitePorCliente, IDCategoria, Activo)
            VALUES (@Codigo, @Descripcion, @TipoDescuento, @Valor, @DescuentoMaximo, @MontoMinimo, @VigenteDesde, @VigenteHasta, @LimiteTotal, @LimitePorCliente, @IDCategoria, @Activo);
            SET @IDCupon = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Marketing.Cupon
            SET Codigo = @Codigo, Descripcion = @Descripcion, TipoDescuento = @TipoDescuento, Valor = @Valor, DescuentoMaximo = @DescuentoMaximo,
                MontoMinimo = @MontoMinimo, VigenteDesde = @VigenteDesde, VigenteHasta = @VigenteHasta, LimiteTotal = @LimiteTotal,
                LimitePorCliente = @LimitePorCliente, IDCategoria = @IDCategoria, Activo = @Activo
            WHERE IDCupon = @IDCupon;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDCupon AS IDCupon;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        IF ERROR_NUMBER() = 547 EXEC Interno.SP_Error_Lanzar 51006, N'Revise tipo, valor, vigencia y limites del cupon.';
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Cupones_Listar @IDUsuarioActor INT, @Texto VARCHAR(40) = NULL, @Activo BIT = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CUPONES_GESTIONAR';
    SELECT c.IDCupon, c.Codigo, c.Descripcion, c.TipoDescuento, c.Valor, c.DescuentoMaximo, c.MontoMinimo, c.VigenteDesde, c.VigenteHasta,
           c.LimiteTotal, c.LimitePorCliente, c.UsosActuales, c.IDCategoria, ca.Nombre AS Categoria, c.Activo, COUNT(*) OVER () AS TotalRegistros
    FROM Marketing.Cupon c LEFT JOIN Catalogo.Categoria ca ON ca.IDCategoria = c.IDCategoria
    WHERE (@Texto IS NULL OR c.Codigo LIKE @Texto + '%') AND (@Activo IS NULL OR c.Activo = @Activo)
    ORDER BY c.IDCupon DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Cupones_Desactivar @IDUsuarioActor INT, @IDCupon INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CUPONES_GESTIONAR';
        UPDATE Marketing.Cupon SET Activo = 0 WHERE IDCupon = @IDCupon;
        IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
