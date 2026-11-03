/* 011 - RF-06 y RF-07. Flujo en dos pasos:
     1. SP_Checkout_IniciarPago: congela precios, valida cupon y reserva 15 minutos.
     2. El backend cobra en la pasarela usando IDCheckout como llave.
     3. SP_Pedidos_CrearPedido: en una sola transaccion crea pedido, detalle, kardex y uso de cupon.
   Orden de bloqueo en todos los SP: carrito -> cupon -> existencias por IDVariante ascendente.
   Un deadlock residual (1205) lo reintenta el backend; la transaccion ya hizo rollback completo. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
CREATE OR ALTER PROCEDURE Api.SP_Envios_ListarOpciones @IDDireccion INT = NULL, @IDUsuario INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT m.IDMetodoEnvio, m.Codigo, m.Nombre, m.EsRecogerEnTienda, t.Costo, t.MontoEnvioGratis, t.DiasEstimados
    FROM Ventas.MetodoEnvio m
    LEFT JOIN (Clientes.Direccion d
               JOIN Clientes.Municipio mu ON mu.IDMunicipio = d.IDMunicipio
               JOIN Ventas.TarifaEnvio t ON t.IDDepartamento = mu.IDDepartamento AND t.Activo = 1)
        ON t.IDMetodoEnvio = m.IDMetodoEnvio AND d.IDDireccion = @IDDireccion AND d.IDUsuario = @IDUsuario
    WHERE m.Activo = 1 AND (m.EsRecogerEnTienda = 1 OR t.IDTarifaEnvio IS NOT NULL)
    ORDER BY m.EsRecogerEnTienda, t.Costo;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Envios_GuardarTarifa
    @IDUsuarioActor INT, @IDMetodoEnvio SMALLINT, @IDDepartamento SMALLINT, @Costo DECIMAL(18,2), @MontoEnvioGratis DECIMAL(18,2) = NULL, @DiasEstimados TINYINT, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CONFIG_GESTIONAR';
        BEGIN TRAN;
        UPDATE Ventas.TarifaEnvio WITH (UPDLOCK, HOLDLOCK)
        SET Costo = @Costo, MontoEnvioGratis = @MontoEnvioGratis, DiasEstimados = @DiasEstimados, Activo = @Activo
        WHERE IDMetodoEnvio = @IDMetodoEnvio AND IDDepartamento = @IDDepartamento;
        IF @@ROWCOUNT = 0
            INSERT Ventas.TarifaEnvio (IDMetodoEnvio, IDDepartamento, Costo, MontoEnvioGratis, DiasEstimados, Activo)
            VALUES (@IDMetodoEnvio, @IDDepartamento, @Costo, @MontoEnvioGratis, @DiasEstimados, @Activo);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Checkout_IniciarPago
    @IDUsuario INT, @Llave UNIQUEIDENTIFIER, @HashSolicitud BINARY(32), @IDMetodoEnvio SMALLINT, @IDDireccion INT = NULL, @IDSucursalRecoger INT = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(), @IDCheckout BIGINT, @HashPrevio BINARY(32), @IDCarrito BIGINT, @IDCupon INT, @ExpiraEn DATETIME2(3),
                @Subtotal DECIMAL(18,2), @Descuento DECIMAL(18,2) = 0, @Envio DECIMAL(18,2) = 0, @Elegible DECIMAL(18,2), @Anterior BIGINT, @EsRecoger BIT,
                @IDVariante INT, @Cantidad INT, @SKU NVARCHAR(100);
        DECLARE @Lineas TABLE (IDVariante INT PRIMARY KEY, IDImpuesto SMALLINT, IDCategoria INT, IDPromocion INT, Cantidad INT, PrecioLista DECIMAL(18,2),
                               DescuentoUnitario DECIMAL(18,2), PrecioFinal DECIMAL(18,2), Subtotal DECIMAL(18,2), Vendible BIT, Elegible BIT);

        EXEC Interno.SP_Contexto_Establecer @IDUsuario;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;
        BEGIN TRAN;

        -- Doble clic: la segunda llamada espera aqui y recibe el mismo checkout.
        SELECT @IDCheckout = IDRecurso, @HashPrevio = HashSolicitud
        FROM Ventas.SolicitudIdempotente WITH (UPDLOCK, HOLDLOCK)
        WHERE Operacion = 'CHECKOUT_INICIAR' AND IDUsuario = @IDUsuario AND Llave = @Llave;
        IF @IDCheckout IS NOT NULL
        BEGIN
            IF @HashPrevio <> @HashSolicitud EXEC Interno.SP_Error_Lanzar 51401;
            COMMIT;
            SELECT IDCheckout, Subtotal, DescuentoCupon, CostoEnvio, Total, Estado, ExpiraEn FROM Ventas.Checkout WHERE IDCheckout = @IDCheckout;
            RETURN;
        END;

        SELECT @IDCarrito = IDCarrito, @IDCupon = IDCupon FROM Ventas.Carrito WITH (UPDLOCK, HOLDLOCK) WHERE IDUsuario = @IDUsuario AND Estado = 'ACTIVO';
        IF @IDCarrito IS NULL EXEC Interno.SP_Error_Lanzar 51402;

        SELECT @Anterior = IDCheckout FROM Ventas.Checkout WITH (UPDLOCK) WHERE IDCarrito = @IDCarrito AND Estado = 'ACTIVO';
        IF @Anterior IS NOT NULL EXEC Interno.SP_Checkout_Liberar @Anterior, 'CANCELADO';

        INSERT @Lineas (IDVariante, IDImpuesto, IDCategoria, IDPromocion, Cantidad, PrecioLista, DescuentoUnitario, PrecioFinal, Subtotal, Vendible, Elegible)
        SELECT IDVariante, IDImpuesto, IDCategoria, IDPromocion, Cantidad, PrecioLista, DescuentoUnitario, PrecioFinal, Subtotal, Vendible, 1
        FROM Interno.FU_Carrito_Lineas(@IDCarrito, @Ahora);
        IF NOT EXISTS (SELECT 1 FROM @Lineas) EXEC Interno.SP_Error_Lanzar 51402;
        IF EXISTS (SELECT 1 FROM @Lineas WHERE Vendible = 0)
        BEGIN
            SELECT TOP (1) @SKU = CONCAT('SKU ', v.SKU) FROM @Lineas l JOIN Catalogo.Variante v ON v.IDVariante = l.IDVariante WHERE l.Vendible = 0;
            EXEC Interno.SP_Error_Lanzar 51104, @SKU;
        END;
        SELECT @Subtotal = SUM(Subtotal) FROM @Lineas;

        SELECT @EsRecoger = EsRecogerEnTienda FROM Ventas.MetodoEnvio WHERE IDMetodoEnvio = @IDMetodoEnvio AND Activo = 1;
        IF @EsRecoger IS NULL EXEC Interno.SP_Error_Lanzar 51405;
        IF (@EsRecoger = 1 AND (@IDSucursalRecoger IS NULL OR @IDDireccion IS NOT NULL)) OR (@EsRecoger = 0 AND (@IDDireccion IS NULL OR @IDSucursalRecoger IS NOT NULL))
            EXEC Interno.SP_Error_Lanzar 51406;
        IF @EsRecoger = 1 AND NOT EXISTS (SELECT 1 FROM Inventario.Sucursal WHERE IDSucursal = @IDSucursalRecoger AND Activo = 1 AND PermiteRecoger = 1)
            EXEC Interno.SP_Error_Lanzar 51405;
        -- La direccion debe ser del propio cliente.
        IF @EsRecoger = 0 AND NOT EXISTS (SELECT 1 FROM Clientes.Direccion WHERE IDDireccion = @IDDireccion AND IDUsuario = @IDUsuario AND Activo = 1)
            EXEC Interno.SP_Error_Lanzar 51406;

        IF @IDCupon IS NOT NULL
        BEGIN
            EXEC Interno.SP_Cupones_Validar @IDCupon, @IDUsuario, @IDCarrito, 1, @Descuento OUTPUT;
            SELECT @Elegible = Elegible FROM Interno.FU_Cupones_CalculoDescuento(@IDCupon, @IDCarrito, @Ahora);
            UPDATE l SET Elegible = 0 FROM @Lineas l JOIN Marketing.Cupon c ON c.IDCupon = @IDCupon
            WHERE c.IDCategoria IS NOT NULL AND c.IDCategoria NOT IN (SELECT IDCategoria FROM Interno.FU_Catalogo_Ancestros(l.IDCategoria));
        END;

        IF @EsRecoger = 0
        BEGIN
            SELECT @Envio = CASE WHEN t.MontoEnvioGratis IS NOT NULL AND @Subtotal - @Descuento >= t.MontoEnvioGratis THEN 0 ELSE t.Costo END
            FROM Clientes.Direccion d
            JOIN Clientes.Municipio m ON m.IDMunicipio = d.IDMunicipio
            JOIN Ventas.TarifaEnvio t ON t.IDDepartamento = m.IDDepartamento AND t.IDMetodoEnvio = @IDMetodoEnvio AND t.Activo = 1
            WHERE d.IDDireccion = @IDDireccion;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51405;
        END;

        SET @ExpiraEn = DATEADD(MINUTE, (SELECT CAST(Valor AS INT) FROM Config.Parametro WHERE Clave = 'RESERVA_MINUTOS'), @Ahora);
        INSERT Ventas.Checkout (IDCarrito, IDUsuario, IDMetodoEnvio, IDDireccion, IDSucursalRecoger, IDCupon, Subtotal, DescuentoCupon, CostoEnvio, Total, ExpiraEn)
        VALUES (@IDCarrito, @IDUsuario, @IDMetodoEnvio, @IDDireccion, @IDSucursalRecoger, @IDCupon, @Subtotal, @Descuento, @Envio, @Subtotal - @Descuento + @Envio, @ExpiraEn);
        SET @IDCheckout = SCOPE_IDENTITY();

        -- Prorrateo del cupon; el residuo de redondeo va a la linea elegible mas grande,
        -- de modo que la suma de las lineas coincide al centavo con el encabezado.
        INSERT Ventas.CheckoutDetalle (IDCheckout, IDVariante, IDPromocion, Cantidad, PrecioLista, DescuentoPromocion, PrecioUnitario, DescuentoCupon, TasaIVA)
        SELECT @IDCheckout, l.IDVariante, l.IDPromocion, l.Cantidad, l.PrecioLista, l.DescuentoUnitario, l.PrecioFinal,
               CASE WHEN @Descuento > 0 AND l.Elegible = 1 THEN ROUND(@Descuento * l.Subtotal / @Elegible, 2) ELSE 0 END,
               ISNULL(t.Porcentaje, 0)
        FROM @Lineas l OUTER APPLY Interno.FU_Impuestos_TasaVigente(l.IDImpuesto, @Ahora) t;
        IF @Descuento > 0
            UPDATE d SET DescuentoCupon = d.DescuentoCupon + (@Descuento - s.Suma)
            FROM Ventas.CheckoutDetalle d
            CROSS APPLY (SELECT SUM(x.DescuentoCupon) AS Suma FROM Ventas.CheckoutDetalle x WHERE x.IDCheckout = @IDCheckout) s
            WHERE d.IDCheckout = @IDCheckout
              AND d.IDVariante = (SELECT TOP (1) IDVariante FROM @Lineas WHERE Elegible = 1 ORDER BY Subtotal DESC, IDVariante);
        IF @IDCupon IS NOT NULL
            INSERT Ventas.CuponUso (IDCupon, IDUsuario, IDCheckout, Monto, Estado) VALUES (@IDCupon, @IDUsuario, @IDCheckout, @Descuento, 'RESERVADO');

        DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT IDVariante, Cantidad FROM @Lineas ORDER BY IDVariante;
        OPEN c;
        FETCH NEXT FROM c INTO @IDVariante, @Cantidad;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC Interno.SP_Inventario_ReservarExistencia @IDCheckout, @IDVariante, @Cantidad, @IDSucursalRecoger, @ExpiraEn;
            FETCH NEXT FROM c INTO @IDVariante, @Cantidad;
        END;
        CLOSE c; DEALLOCATE c;

        INSERT Ventas.SolicitudIdempotente (Operacion, IDUsuario, Llave, HashSolicitud, IDRecurso)
        VALUES ('CHECKOUT_INICIAR', @IDUsuario, @Llave, @HashSolicitud, @IDCheckout);
        COMMIT;
        SELECT IDCheckout, Subtotal, DescuentoCupon, CostoEnvio, Total, Estado, ExpiraEn FROM Ventas.Checkout WHERE IDCheckout = @IDCheckout;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Checkout_Cancelar @IDUsuario INT, @IDCheckout BIGINT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuario;
        BEGIN TRAN;
        IF NOT EXISTS (SELECT 1 FROM Ventas.Checkout WITH (UPDLOCK) WHERE IDCheckout = @IDCheckout AND IDUsuario = @IDUsuario AND Estado = 'ACTIVO')
            EXEC Interno.SP_Error_Lanzar 51404;
        EXEC Interno.SP_Checkout_Liberar @IDCheckout, 'CANCELADO';
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- Pago rechazado: queda el intento y el checkout sigue activo para reintentar hasta que expire.
CREATE OR ALTER PROCEDURE Api.SP_Pagos_RegistrarRechazo
    @IDUsuario INT, @IDCheckout BIGINT, @IDMetodoPago SMALLINT, @ReferenciaPasarela VARCHAR(100), @Mensaje NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @Total DECIMAL(18,2);
        SELECT @Total = Total FROM Ventas.Checkout WHERE IDCheckout = @IDCheckout AND IDUsuario = @IDUsuario;
        IF @Total IS NULL EXEC Interno.SP_Error_Lanzar 51007;
        IF NOT EXISTS (SELECT 1 FROM Ventas.Pago WHERE ReferenciaPasarela = @ReferenciaPasarela)
            INSERT Ventas.Pago (IDCheckout, IDMetodoPago, Monto, Estado, ReferenciaPasarela, Mensaje)
            VALUES (@IDCheckout, @IDMetodoPago, @Total, 'RECHAZADO', @ReferenciaPasarela, @Mensaje);
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
/* RF-06: atomico e idempotente en tres capas: SolicitudIdempotente, UQ_Pedido_Checkout y
   UX_Pago_AprobadoPorCheckout. Si la reserva ya expiro pero la pasarela cobro, el cobro se
   registra para reembolso y ese registro se confirma antes de avisar al cliente. */
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_CrearPedido
    @IDUsuario INT, @IDCheckout BIGINT, @Llave UNIQUEIDENTIFIER, @HashSolicitud BINARY(32), @IDMetodoPago SMALLINT,
    @ReferenciaPasarela VARCHAR(100), @MontoCobrado DECIMAL(18,2), @NITFactura VARCHAR(15) = 'CF', @NombreFactura NVARCHAR(200) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(), @IDPedido BIGINT, @HashPrevio BINARY(32), @Estado VARCHAR(12), @ExpiraEn DATETIME2(3), @Total DECIMAL(18,2),
                @IDEstado TINYINT, @IDDireccion INT, @IDCarrito BIGINT, @IDCupon INT, @Numero VARCHAR(20), @TasaEnvio DECIMAL(5,2), @Base DECIMAL(18,2), @IVA DECIMAL(18,2),
                @IDPedidoDetalle BIGINT, @IDVariante INT, @IDBodega INT, @Cantidad INT, @Motivo NVARCHAR(300);

        EXEC Interno.SP_Contexto_Establecer @IDUsuario;
        BEGIN TRAN;
        SELECT @IDPedido = IDRecurso, @HashPrevio = HashSolicitud
        FROM Ventas.SolicitudIdempotente WITH (UPDLOCK, HOLDLOCK)
        WHERE Operacion = 'PEDIDO_CREAR' AND IDUsuario = @IDUsuario AND Llave = @Llave;
        IF @IDPedido IS NOT NULL AND @HashPrevio <> @HashSolicitud EXEC Interno.SP_Error_Lanzar 51401;

        SELECT @Estado = Estado, @ExpiraEn = ExpiraEn, @Total = Total, @IDDireccion = IDDireccion, @IDCarrito = IDCarrito, @IDCupon = IDCupon
        FROM Ventas.Checkout WITH (UPDLOCK, HOLDLOCK) WHERE IDCheckout = @IDCheckout AND IDUsuario = @IDUsuario;
        IF @Estado IS NULL EXEC Interno.SP_Error_Lanzar 51007;

        -- Reintento con la misma u otra llave sobre un checkout ya pagado: mismo pedido, sin segundo cobro.
        IF @IDPedido IS NULL AND @Estado = 'COMPLETADO' SELECT @IDPedido = IDPedido FROM Ventas.Pedido WHERE IDCheckout = @IDCheckout;
        IF @IDPedido IS NOT NULL
        BEGIN
            COMMIT;
            SELECT p.IDPedido, p.NumeroPedido, p.Total, e.Codigo AS Estado FROM Ventas.Pedido p
            JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido WHERE p.IDPedido = @IDPedido;
            RETURN;
        END;

        IF @MontoCobrado <> @Total EXEC Interno.SP_Error_Lanzar 51408;
        IF @Estado <> 'ACTIVO' OR @ExpiraEn <= @Ahora
        BEGIN
            IF NOT EXISTS (SELECT 1 FROM Ventas.Pago WHERE ReferenciaPasarela = @ReferenciaPasarela)
                INSERT Ventas.Pago (IDCheckout, IDMetodoPago, Monto, Estado, ReferenciaPasarela, Mensaje)
                VALUES (@IDCheckout, @IDMetodoPago, @MontoCobrado, 'REEMBOLSO_PENDIENTE', @ReferenciaPasarela, N'Cobro recibido con la reserva vencida.');
            COMMIT;
            EXEC Interno.SP_Error_Lanzar 51403;
        END;

        INSERT Ventas.Pago (IDCheckout, IDMetodoPago, Monto, Estado, ReferenciaPasarela) VALUES (@IDCheckout, @IDMetodoPago, @MontoCobrado, 'APROBADO', @ReferenciaPasarela);

        SELECT @IDEstado = IDEstadoPedido FROM Ventas.EstadoPedido WHERE Codigo = 'PAGADO';
        SET @Numero = CONCAT('SC-', NEXT VALUE FOR Ventas.SecNumeroPedido);
        SELECT @TasaEnvio = t.Porcentaje FROM Catalogo.Impuesto i CROSS APPLY Interno.FU_Impuestos_TasaVigente(i.IDImpuesto, @Ahora) t WHERE i.Codigo = 'IVA';
        IF @NombreFactura IS NULL SELECT @NombreFactura = CONCAT(Nombres, N' ', Apellidos) FROM Seguridad.Usuario WHERE IDUsuario = @IDUsuario;

        SELECT @Base = SUM(ROUND((d.Cantidad * d.PrecioUnitario - d.DescuentoCupon) / (1 + d.TasaIVA / 100), 2)) FROM Ventas.CheckoutDetalle d WHERE d.IDCheckout = @IDCheckout;
        SELECT @Base = @Base + ROUND(c.CostoEnvio / (1 + ISNULL(@TasaEnvio, 0) / 100), 2) FROM Ventas.Checkout c WHERE c.IDCheckout = @IDCheckout;
        SET @IVA = @Total - @Base;

        INSERT Ventas.Pedido (NumeroPedido, IDUsuario, IDCheckout, IDEstadoPedido, IDMetodoEnvio, IDSucursalRecoger, IDCupon, Subtotal, DescuentoCupon, CostoEnvio, Total,
                              BaseImponible, IVA, NITFactura, NombreFactura)
        SELECT @Numero, @IDUsuario, @IDCheckout, @IDEstado, IDMetodoEnvio, IDSucursalRecoger, IDCupon, Subtotal, DescuentoCupon, CostoEnvio, Total, @Base, @IVA,
               ISNULL(NULLIF(@NITFactura, ''), 'CF'), @NombreFactura
        FROM Ventas.Checkout WHERE IDCheckout = @IDCheckout;
        SET @IDPedido = SCOPE_IDENTITY();

        -- CostoUnitario se pondera entre las bodegas que surten la linea.
        INSERT Ventas.PedidoDetalle (IDPedido, IDVariante, IDPromocion, SKU, NombreProducto, Cantidad, PrecioLista, DescuentoPromocion, PrecioUnitario, DescuentoCupon,
                                     TotalLinea, TasaIVA, BaseLinea, IVALinea, CostoUnitario)
        SELECT @IDPedido, d.IDVariante, d.IDPromocion, v.SKU, p.Nombre, d.Cantidad, d.PrecioLista, d.DescuentoPromocion, d.PrecioUnitario, d.DescuentoCupon,
               t.TotalLinea, d.TasaIVA, b.BaseLinea, t.TotalLinea - b.BaseLinea, c.Costo
        FROM Ventas.CheckoutDetalle d
        JOIN Catalogo.Variante v ON v.IDVariante = d.IDVariante
        JOIN Catalogo.Producto p ON p.IDProducto = v.IDProducto
        CROSS APPLY (SELECT CAST(d.Cantidad * d.PrecioUnitario - d.DescuentoCupon AS DECIMAL(18,2)) AS TotalLinea) t
        CROSS APPLY (SELECT CAST(ROUND(t.TotalLinea / (1 + d.TasaIVA / 100), 2) AS DECIMAL(18,2)) AS BaseLinea) b
        CROSS APPLY (SELECT CAST(SUM(r.Cantidad * e.CostoPromedio) / SUM(r.Cantidad) AS DECIMAL(18,4)) AS Costo
                     FROM Inventario.Reserva r
                     JOIN Inventario.Existencia e ON e.IDVariante = r.IDVariante AND e.IDBodega = r.IDBodega
                     WHERE r.IDCheckout = @IDCheckout AND r.IDVariante = d.IDVariante AND r.Estado = 'ACTIVA') c
        WHERE d.IDCheckout = @IDCheckout;

        INSERT Ventas.PedidoAsignacion (IDPedidoDetalle, IDBodega, Cantidad)
        SELECT pd.IDPedidoDetalle, r.IDBodega, r.Cantidad
        FROM Inventario.Reserva r JOIN Ventas.PedidoDetalle pd ON pd.IDPedido = @IDPedido AND pd.IDVariante = r.IDVariante
        WHERE r.IDCheckout = @IDCheckout AND r.Estado = 'ACTIVA';

        IF @IDDireccion IS NOT NULL
            INSERT Ventas.PedidoDireccion (IDPedido, IDMunicipio, Destinatario, Telefono, Linea1, Linea2, Referencia)
            SELECT @IDPedido, IDMunicipio, Destinatario, Telefono, Linea1, Linea2, Referencia FROM Clientes.Direccion WHERE IDDireccion = @IDDireccion;

        -- La salida fisica ocurre aqui y consume la reserva en el mismo movimiento.
        SET @Motivo = CONCAT(N'Venta ', @Numero);
        DECLARE c CURSOR LOCAL FAST_FORWARD FOR
            SELECT pd.IDPedidoDetalle, a.IDBodega, a.Cantidad, pd.IDVariante
            FROM Ventas.PedidoDetalle pd JOIN Ventas.PedidoAsignacion a ON a.IDPedidoDetalle = pd.IDPedidoDetalle
            WHERE pd.IDPedido = @IDPedido ORDER BY pd.IDVariante, a.IDBodega;
        OPEN c;
        FETCH NEXT FROM c INTO @IDPedidoDetalle, @IDBodega, @Cantidad, @IDVariante;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodega, 'SALIDA_VENTA', @Cantidad, @Motivo, @IDUsuario,
                 @LiberarReserva = @Cantidad, @IDPedidoDetalle = @IDPedidoDetalle, @ReferenciaDocumento = @Numero;
            FETCH NEXT FROM c INTO @IDPedidoDetalle, @IDBodega, @Cantidad, @IDVariante;
        END;
        CLOSE c; DEALLOCATE c;

        UPDATE Inventario.Reserva SET Estado = 'CONSUMIDA' WHERE IDCheckout = @IDCheckout AND Estado = 'ACTIVA';
        UPDATE Ventas.CuponUso SET Estado = 'CONFIRMADO', IDPedido = @IDPedido WHERE IDCheckout = @IDCheckout;
        UPDATE Ventas.Checkout SET Estado = 'COMPLETADO' WHERE IDCheckout = @IDCheckout;
        UPDATE Ventas.Carrito SET Estado = 'CONVERTIDO', UltimaActividad = @Ahora WHERE IDCarrito = @IDCarrito;
        INSERT Ventas.Factura (IDPedido) VALUES (@IDPedido);
        INSERT Ventas.EventoSalida (TipoEvento, Contenido)
        SELECT 'PEDIDO_CREADO', (SELECT @IDPedido AS IDPedido, @Numero AS NumeroPedido, @Total AS Total FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        INSERT Ventas.SolicitudIdempotente (Operacion, IDUsuario, Llave, HashSolicitud, IDRecurso) VALUES ('PEDIDO_CREAR', @IDUsuario, @Llave, @HashSolicitud, @IDPedido);
        COMMIT;
        SELECT @IDPedido AS IDPedido, @Numero AS NumeroPedido, @Total AS Total, 'PAGADO' AS Estado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
/* ---------- Consulta: el cliente solo ve lo suyo; lo ajeno responde 404, no 403 ---------- */
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_ListarMisPedidos @IDUsuario INT, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    SELECT p.IDPedido, p.NumeroPedido, p.FechaPedido, p.Total, e.Codigo AS Estado, e.Nombre AS NombreEstado, COUNT(*) OVER () AS TotalRegistros
    FROM Ventas.Pedido p JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    WHERE p.IDUsuario = @IDUsuario
    ORDER BY p.FechaPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_Listar
    @IDUsuarioActor INT, @Estado VARCHAR(30) = NULL, @IDUsuario INT = NULL, @TextoCliente NVARCHAR(100) = NULL, @Desde DATE = NULL, @Hasta DATE = NULL,
    @Orden VARCHAR(20) = 'FECHA_DESC', @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PEDIDOS_GESTIONAR';
    SELECT p.IDPedido, p.NumeroPedido, p.FechaPedido, p.Total, e.Codigo AS Estado, u.IDUsuario, u.Correo, CONCAT(u.Nombres, N' ', u.Apellidos) AS Cliente,
           COUNT(*) OVER () AS TotalRegistros
    FROM Ventas.Pedido p
    JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    JOIN Seguridad.Usuario u ON u.IDUsuario = p.IDUsuario
    WHERE (@Estado IS NULL OR e.Codigo = @Estado) AND (@IDUsuario IS NULL OR p.IDUsuario = @IDUsuario)
      AND (@Desde IS NULL OR p.FechaLocal >= @Desde) AND (@Hasta IS NULL OR p.FechaLocal <= @Hasta)
      AND (@TextoCliente IS NULL OR u.Correo LIKE @TextoCliente + N'%' OR u.Nombres LIKE @TextoCliente + N'%' OR u.Apellidos LIKE @TextoCliente + N'%')
    ORDER BY CASE WHEN @Orden = 'TOTAL_DESC' THEN p.Total END DESC,
             CASE WHEN @Orden = 'TOTAL_ASC' THEN p.Total END ASC,
             CASE WHEN @Orden = 'FECHA_ASC' THEN p.FechaPedido END ASC,
             p.FechaPedido DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_ObtenerDetalle @IDUsuarioActor INT, @IDPedido BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Puede BIT = 0;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor;
    IF EXISTS (SELECT 1 FROM Ventas.Pedido WHERE IDPedido = @IDPedido AND IDUsuario = @IDUsuarioActor) SET @Puede = 1;
    IF @Puede = 0 AND EXISTS (SELECT 1 FROM Seguridad.Usuario u JOIN Seguridad.RolPermiso rp ON rp.IDRol = u.IDRol
                              JOIN Seguridad.Permiso pe ON pe.IDPermiso = rp.IDPermiso
                              WHERE u.IDUsuario = @IDUsuarioActor AND pe.Codigo = 'PEDIDOS_GESTIONAR') SET @Puede = 1;
    IF @Puede = 0 OR NOT EXISTS (SELECT 1 FROM Ventas.Pedido WHERE IDPedido = @IDPedido) EXEC Interno.SP_Error_Lanzar 51007;

    SELECT p.IDPedido, p.NumeroPedido, p.FechaPedido, e.Codigo AS Estado, e.EsCancelable, p.Subtotal, p.DescuentoCupon, p.CostoEnvio, p.Total, p.BaseImponible, p.IVA,
           p.NITFactura, p.NombreFactura, m.Nombre AS MetodoEnvio, s.Nombre AS SucursalRecoger, c.Codigo AS CodigoCupon,
           d.Destinatario, d.Telefono, d.Linea1, d.Linea2, d.Referencia, mu.Nombre AS Municipio, dp.Nombre AS Departamento
    FROM Ventas.Pedido p
    JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
    JOIN Ventas.MetodoEnvio m ON m.IDMetodoEnvio = p.IDMetodoEnvio
    LEFT JOIN Inventario.Sucursal s ON s.IDSucursal = p.IDSucursalRecoger
    LEFT JOIN Marketing.Cupon c ON c.IDCupon = p.IDCupon
    LEFT JOIN Ventas.PedidoDireccion d ON d.IDPedido = p.IDPedido
    LEFT JOIN Clientes.Municipio mu ON mu.IDMunicipio = d.IDMunicipio
    LEFT JOIN Clientes.Departamento dp ON dp.IDDepartamento = mu.IDDepartamento
    WHERE p.IDPedido = @IDPedido;

    SELECT IDPedidoDetalle, IDVariante, SKU, NombreProducto, Cantidad, PrecioLista, DescuentoPromocion, PrecioUnitario, DescuentoCupon, TotalLinea, BaseLinea, IVALinea, CantidadDevuelta
    FROM Ventas.PedidoDetalle WHERE IDPedido = @IDPedido ORDER BY IDPedidoDetalle;

    SELECT EstadoAnterior, EstadoNuevo, Fecha, Motivo, CorreoUsuario FROM Interno.VW_Pedidos_Historial WHERE IDPedido = @IDPedido ORDER BY Fecha, IDPedidoHistorialEstado;
END;
GO
-- Avance operativo. Cancelar y devolver tienen SP propio porque mueven inventario y dinero.
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_CambiarEstado @IDUsuarioActor INT, @IDPedido BIGINT, @EstadoNuevo VARCHAR(30), @Motivo NVARCHAR(300) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PEDIDOS_GESTIONAR';
        IF @EstadoNuevo IN ('CANCELADO', 'DEVUELTO_PARCIAL', 'DEVUELTO_TOTAL') EXEC Interno.SP_Error_Lanzar 51501;
        DECLARE @IDEstado TINYINT = (SELECT IDEstadoPedido FROM Ventas.EstadoPedido WHERE Codigo = @EstadoNuevo);
        IF @IDEstado IS NULL EXEC Interno.SP_Error_Lanzar 51006, N'Estado invalido.';
        UPDATE Ventas.Pedido SET IDEstadoPedido = @IDEstado WHERE IDPedido = @IDPedido;
        IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- Puede cancelar el dueno o quien gestiona pedidos, siempre antes del despacho.
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_CancelarPedido @IDUsuarioActor INT, @IDPedido BIGINT, @Motivo NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        IF LEN(LTRIM(RTRIM(ISNULL(@Motivo, N'')))) = 0 EXEC Interno.SP_Error_Lanzar 51202;
        DECLARE @Dueno INT, @IDEstadoActual TINYINT, @Cancelable BIT, @Total DECIMAL(18,2), @Numero VARCHAR(20), @IDCheckout BIGINT, @IDCupon INT,
                @IDEstadoCancelado TINYINT = (SELECT IDEstadoPedido FROM Ventas.EstadoPedido WHERE Codigo = 'CANCELADO'),
                @IDPedidoDetalle BIGINT, @IDVariante INT, @IDBodega INT, @Cantidad INT;
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        BEGIN TRAN;
        SELECT @Dueno = p.IDUsuario, @IDEstadoActual = p.IDEstadoPedido, @Cancelable = e.EsCancelable, @Total = p.Total, @Numero = p.NumeroPedido, @IDCheckout = p.IDCheckout, @IDCupon = p.IDCupon
        FROM Ventas.Pedido p WITH (UPDLOCK, HOLDLOCK) JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;
        IF @Dueno IS NULL EXEC Interno.SP_Error_Lanzar 51007;
        IF @Dueno <> @IDUsuarioActor
            IF NOT EXISTS (SELECT 1 FROM Seguridad.Usuario u JOIN Seguridad.RolPermiso rp ON rp.IDRol = u.IDRol
                           JOIN Seguridad.Permiso pe ON pe.IDPermiso = rp.IDPermiso
                           WHERE u.IDUsuario = @IDUsuarioActor AND u.Activo = 1 AND pe.Codigo = 'PEDIDOS_GESTIONAR')
                EXEC Interno.SP_Error_Lanzar 51007;
        IF @Cancelable = 0 EXEC Interno.SP_Error_Lanzar 51502;

        DECLARE c CURSOR LOCAL FAST_FORWARD FOR
            SELECT d.IDPedidoDetalle, d.IDVariante, a.IDBodega, a.Cantidad
            FROM Ventas.PedidoDetalle d JOIN Ventas.PedidoAsignacion a ON a.IDPedidoDetalle = d.IDPedidoDetalle
            WHERE d.IDPedido = @IDPedido ORDER BY d.IDVariante, a.IDBodega;
        OPEN c;
        FETCH NEXT FROM c INTO @IDPedidoDetalle, @IDVariante, @IDBodega, @Cantidad;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodega, 'CANCELACION', @Cantidad, @Motivo, @IDUsuarioActor,
                 @IDPedidoDetalle = @IDPedidoDetalle, @ReferenciaDocumento = @Numero;
            FETCH NEXT FROM c INTO @IDPedidoDetalle, @IDVariante, @IDBodega, @Cantidad;
        END;
        CLOSE c; DEALLOCATE c;

        IF @IDCupon IS NOT NULL
        BEGIN
            UPDATE Marketing.Cupon SET UsosActuales = UsosActuales - 1 WHERE IDCupon = @IDCupon;
            UPDATE Ventas.CuponUso SET Estado = 'REVERTIDO' WHERE IDCheckout = @IDCheckout;
        END;
        UPDATE Ventas.Pedido SET IDEstadoPedido = @IDEstadoCancelado WHERE IDPedido = @IDPedido;
        INSERT Ventas.Reembolso (IDPedido, Monto) VALUES (@IDPedido, @Total);
        UPDATE Ventas.Factura SET Estado = 'ANULADA' WHERE IDPedido = @IDPedido;
        INSERT Ventas.EventoSalida (TipoEvento, Contenido)
        SELECT 'PEDIDO_CANCELADO', (SELECT @IDPedido AS IDPedido, @Numero AS NumeroPedido FOR JSON PATH, WITHOUT_ARRAY_WRAPPER);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
/* RF-07. @LineasJson: [{"IDPedidoDetalle":1,"Cantidad":1,"ReingresaInventario":true,"IDBodega":null}]
   Lo registra el Operador. El monto devuelto es proporcional e incluye el descuento del cupon;
   la ultima unidad de la linea toma el saldo, para que la suma cierre al centavo. El envio no se reembolsa. */
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_CrearDevolucion @IDUsuarioActor INT, @IDPedido BIGINT, @Motivo NVARCHAR(300), @LineasJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PEDIDOS_GESTIONAR';
        IF LEN(LTRIM(RTRIM(ISNULL(@Motivo, N'')))) = 0 EXEC Interno.SP_Error_Lanzar 51202;
        IF ISJSON(@LineasJson) = 0 EXEC Interno.SP_Error_Lanzar 51006, N'Lineas invalidas.';

        DECLARE @Lineas TABLE (IDPedidoDetalle BIGINT, Cantidad INT, Reingresa BIT, IDBodega INT);
        INSERT @Lineas SELECT IDPedidoDetalle, Cantidad, ISNULL(ReingresaInventario, 1), IDBodega
        FROM OPENJSON(@LineasJson) WITH (IDPedidoDetalle BIGINT, Cantidad INT, ReingresaInventario BIT, IDBodega INT);
        IF NOT EXISTS (SELECT 1 FROM @Lineas) OR EXISTS (SELECT 1 FROM @Lineas WHERE Cantidad IS NULL OR Cantidad <= 0)
           OR EXISTS (SELECT 1 FROM @Lineas GROUP BY IDPedidoDetalle HAVING COUNT(*) > 1)
            EXEC Interno.SP_Error_Lanzar 51006, N'Lineas invalidas.';

        DECLARE @Estado VARCHAR(30), @Numero VARCHAR(20), @IDDevolucion BIGINT, @Monto DECIMAL(18,2), @MontoTotal DECIMAL(18,2) = 0,
                @IDPedidoDetalle BIGINT, @Cantidad INT, @Reingresa BIT, @IDBodega INT, @IDVariante INT, @TotalLinea DECIMAL(18,2), @Vendida INT, @Devuelta INT, @Previo DECIMAL(18,2);
        BEGIN TRAN;
        SELECT @Estado = e.Codigo, @Numero = p.NumeroPedido
        FROM Ventas.Pedido p WITH (UPDLOCK, HOLDLOCK) JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido
        WHERE p.IDPedido = @IDPedido;
        IF @Estado IS NULL EXEC Interno.SP_Error_Lanzar 51007;
        IF @Estado NOT IN ('ENTREGADO', 'DEVUELTO_PARCIAL') EXEC Interno.SP_Error_Lanzar 51504;
        IF EXISTS (SELECT 1 FROM @Lineas l WHERE NOT EXISTS (SELECT 1 FROM Ventas.PedidoDetalle d WHERE d.IDPedidoDetalle = l.IDPedidoDetalle AND d.IDPedido = @IDPedido))
            EXEC Interno.SP_Error_Lanzar 51007;

        INSERT Ventas.Devolucion (IDPedido, IDUsuario, Motivo) VALUES (@IDPedido, @IDUsuarioActor, @Motivo);
        SET @IDDevolucion = SCOPE_IDENTITY();

        DECLARE c CURSOR LOCAL FAST_FORWARD FOR
            SELECT l.IDPedidoDetalle, l.Cantidad, l.Reingresa, l.IDBodega FROM @Lineas l
            JOIN Ventas.PedidoDetalle d ON d.IDPedidoDetalle = l.IDPedidoDetalle ORDER BY d.IDVariante;
        OPEN c;
        FETCH NEXT FROM c INTO @IDPedidoDetalle, @Cantidad, @Reingresa, @IDBodega;
        WHILE @@FETCH_STATUS = 0
        BEGIN
            UPDATE Ventas.PedidoDetalle SET CantidadDevuelta = CantidadDevuelta + @Cantidad
            WHERE IDPedidoDetalle = @IDPedidoDetalle AND CantidadDevuelta + @Cantidad <= Cantidad;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51503;

            SELECT @IDVariante = IDVariante, @TotalLinea = TotalLinea, @Vendida = Cantidad, @Devuelta = CantidadDevuelta
            FROM Ventas.PedidoDetalle WHERE IDPedidoDetalle = @IDPedidoDetalle;
            SELECT @Previo = ISNULL(SUM(Monto), 0) FROM Ventas.DevolucionDetalle WHERE IDPedidoDetalle = @IDPedidoDetalle;
            SET @Monto = CASE WHEN @Devuelta = @Vendida THEN @TotalLinea - @Previo ELSE ROUND(@TotalLinea * @Cantidad / @Vendida, 2) END;

            IF @IDBodega IS NULL
                SELECT TOP (1) @IDBodega = IDBodega FROM Ventas.PedidoAsignacion WHERE IDPedidoDetalle = @IDPedidoDetalle ORDER BY Cantidad DESC, IDBodega;
            INSERT Ventas.DevolucionDetalle (IDDevolucion, IDPedidoDetalle, IDBodega, Cantidad, Monto, ReingresaInventario)
            VALUES (@IDDevolucion, @IDPedidoDetalle, @IDBodega, @Cantidad, @Monto, @Reingresa);
            IF @Reingresa = 1
                EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodega, 'DEVOLUCION', @Cantidad, @Motivo, @IDUsuarioActor,
                     @IDPedidoDetalle = @IDPedidoDetalle, @ReferenciaDocumento = @Numero;
            SET @MontoTotal += @Monto;
            FETCH NEXT FROM c INTO @IDPedidoDetalle, @Cantidad, @Reingresa, @IDBodega;
        END;
        CLOSE c; DEALLOCATE c;

        DECLARE @EstadoFinal VARCHAR(30) = CASE WHEN EXISTS (SELECT 1 FROM Ventas.PedidoDetalle WHERE IDPedido = @IDPedido AND CantidadDevuelta < Cantidad)
                                                THEN 'DEVUELTO_PARCIAL' ELSE 'DEVUELTO_TOTAL' END;
        IF @EstadoFinal <> @Estado
            UPDATE Ventas.Pedido SET IDEstadoPedido = (SELECT IDEstadoPedido FROM Ventas.EstadoPedido WHERE Codigo = @EstadoFinal) WHERE IDPedido = @IDPedido;
        INSERT Ventas.Reembolso (IDPedido, IDDevolucion, Monto) VALUES (@IDPedido, @IDDevolucion, @MontoTotal);
        COMMIT;
        SELECT @IDDevolucion AS IDDevolucion, @MontoTotal AS MontoReembolso, @EstadoFinal AS Estado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
