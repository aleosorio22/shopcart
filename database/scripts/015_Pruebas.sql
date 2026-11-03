/* 015 - Pruebas de aceptacion de RF-01 a RF-09 sobre la semilla. No forma parte de la instalacion.
   Se ejecuta con ejecutar.sh --pruebas. Falla con codigo de salida distinto de cero. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE ShopCart;
GO
CREATE TABLE #R (Prueba NVARCHAR(200), Ok BIT, Detalle NVARCHAR(400));
GO
CREATE PROCEDURE #Espera @Prueba NVARCHAR(200), @Sql NVARCHAR(MAX), @Codigo INT
AS
BEGIN
    BEGIN TRY
        EXEC sys.sp_executesql @Sql;
        INSERT #R VALUES (@Prueba, 0, N'No se lanzo el error esperado');
    END TRY
    BEGIN CATCH
        INSERT #R VALUES (@Prueba, CASE WHEN ERROR_NUMBER() = @Codigo THEN 1 ELSE 0 END, CONCAT(ERROR_NUMBER(), N': ', ERROR_MESSAGE()));
    END CATCH
END;
GO
DECLARE @Var INT = (SELECT IDVariante FROM Catalogo.Variante WHERE SKU = 'MOU-M185-NEG'),
        @Bod INT = (SELECT IDBodega FROM Inventario.Bodega WHERE Codigo = 'CD-01'), @Sql NVARCHAR(MAX);

SET @Sql = CONCAT(N'EXEC Api.SP_Inventario_AjustarExistencia 3, ', @Var, N', ', @Bod, N', -1, N'''';');
EXEC #Espera N'RF-03 ajuste sin motivo se rechaza', @Sql, 51202;
SET @Sql = CONCAT(N'EXEC Api.SP_Inventario_AjustarExistencia 3, ', @Var, N', ', @Bod, N', -99999, N''Merma'';');
EXEC #Espera N'RF-03 ajuste no deja saldo negativo', @Sql, 51203;
EXEC #Espera N'RF-09 bitacora no se modifica', N'UPDATE TOP (1) Auditoria.Bitacora SET Accion = ''CREAR'';', 51507;
EXEC #Espera N'RF-09 bitacora no se elimina', N'DELETE TOP (1) Auditoria.Bitacora;', 51507;
EXEC #Espera N'RF-09 bitacora no admite TRUNCATE', N'TRUNCATE TABLE Auditoria.Bitacora;', 4712;
EXEC #Espera N'RF-03 kardex no se modifica', N'UPDATE TOP (1) Inventario.Kardex SET Cantidad = 1;', 51204;
EXEC #Espera N'RF-02 precio historico no se modifica', N'UPDATE TOP (1) Catalogo.PrecioVariante SET Precio = 1;', 51506;
EXEC #Espera N'RF-01 cliente no cambia precios', N'EXEC Api.SP_Catalogo_CambiarPrecio 4, 1, 10;', 51000;
EXEC #Espera N'RF-01 operador no ve bitacora', N'EXEC Api.SP_Bitacora_Consultar 3;', 51000;
EXEC #Espera N'RF-05 cupon vencido', N'EXEC Interno.SP_Carrito_EscribirLinea 5, NULL, 7, 1, 1; EXEC Api.SP_Carrito_AplicarCupon 5, NULL, ''VENCIDO'';', 51304;
GO
/* Compra completa con cupon, repeticiones e intentos de acceso ajeno. */
DECLARE @Cli INT = 4, @Otro INT = 5, @Dir INT, @DirOtro INT, @Env SMALLINT = 1, @Pago SMALLINT = 1, @H BINARY(32) = HASHBYTES('SHA2_256', 'prueba'), @L1 UNIQUEIDENTIFIER = NEWID(), @L2 UNIQUEIDENTIFIER = NEWID(),
        @Var INT = (SELECT IDVariante FROM Catalogo.Variante WHERE SKU = 'MOU-M185-NEG'), @Var2 INT = (SELECT IDVariante FROM Catalogo.Variante WHERE SKU = 'PLY-BAS-M'), @Antes INT, @Sql NVARCHAR(MAX),
        @IDCheckout BIGINT, @Total DECIMAL(18,2), @IDPedido BIGINT, @Pedidos INT, @Precio DECIMAL(18,2), @Det BIGINT;
DECLARE @C TABLE (a BIGINT, b DECIMAL(18,2), c DECIMAL(18,2), d DECIMAL(18,2), e DECIMAL(18,2), f VARCHAR(12), g DATETIME2(3));
DECLARE @P TABLE (a BIGINT, b VARCHAR(20), c DECIMAL(18,2), d VARCHAR(30));

SELECT @Dir = IDDireccion FROM Clientes.Direccion WHERE IDUsuario = @Cli;
SELECT @DirOtro = IDDireccion FROM Clientes.Direccion WHERE IDUsuario = @Otro;
EXEC Interno.SP_Carrito_EscribirLinea @Cli, NULL, @Var, 3, 0;
EXEC Interno.SP_Carrito_EscribirLinea @Cli, NULL, @Var2, 2, 0;

SET @Sql = CONCAT(N'EXEC Api.SP_Checkout_IniciarPago ', @Cli, N', ''', NEWID(), N''', 0x00, 1, ', @DirOtro, N', NULL;');
EXEC #Espera N'RF-01 direccion ajena en checkout', @Sql, 51406;

SELECT @Antes = SUM(Reservada) FROM Inventario.Existencia WHERE IDVariante = @Var;
INSERT @C EXEC Api.SP_Checkout_IniciarPago @Cli, @L1, @H, @Env, @Dir, NULL;
INSERT @C EXEC Api.SP_Checkout_IniciarPago @Cli, @L1, @H, @Env, @Dir, NULL;
SELECT @IDCheckout = MIN(a), @Total = MIN(e) FROM @C;
INSERT #R SELECT N'RF-06 iniciar pago dos veces da el mismo checkout', CASE WHEN COUNT(DISTINCT a) = 1 THEN 1 ELSE 0 END, NULL FROM @C;
INSERT #R SELECT N'RF-06 reserva una sola vez', CASE WHEN SUM(Reservada) = @Antes + 3 THEN 1 ELSE 0 END, CONCAT(SUM(Reservada), N'') FROM Inventario.Existencia WHERE IDVariante = @Var;

SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_CrearPedido ', @Cli, N', ', @IDCheckout, N', ''', NEWID(), N''', 0x00, 1, ''P-MAL'', 1.00;');
EXEC #Espera N'RF-06 monto cobrado distinto se rechaza', @Sql, 51408;

SELECT @Precio = PrecioUnitario FROM Ventas.CheckoutDetalle WHERE IDCheckout = @IDCheckout AND IDVariante = @Var;
EXEC Api.SP_Catalogo_CambiarPrecio 2, @Var, 1.00;
INSERT @P EXEC Api.SP_Pedidos_CrearPedido @Cli, @IDCheckout, @L2, @H, @Pago, 'P-PRUEBA-1', @Total;
INSERT @P EXEC Api.SP_Pedidos_CrearPedido @Cli, @IDCheckout, @L2, @H, @Pago, 'P-PRUEBA-1', @Total;
INSERT @P EXEC Api.SP_Pedidos_CrearPedido @Cli, @IDCheckout, 'A0000000-0000-0000-0000-000000000001', @H, @Pago, 'P-PRUEBA-2', @Total;
SELECT @IDPedido = MIN(a) FROM @P;
INSERT #R SELECT N'RF-06 pagar tres veces da un solo pedido', CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END, CONCAT(COUNT(*), N'') FROM Ventas.Pedido WHERE IDCheckout = @IDCheckout;
INSERT #R SELECT N'RF-06 un solo cobro', CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END, CONCAT(COUNT(*), N'') FROM Ventas.Pago WHERE IDCheckout = @IDCheckout;
INSERT #R SELECT N'RF-02 respeta el precio visto al confirmar', CASE WHEN PrecioUnitario = @Precio THEN 1 ELSE 0 END, CONCAT(PrecioUnitario, N'') FROM Ventas.PedidoDetalle WHERE IDPedido = @IDPedido AND IDVariante = @Var;
INSERT #R SELECT N'RF-04 lineas suman el total sin redondeo', CASE WHEN SUM(d.TotalLinea) + MAX(p.CostoEnvio) = MAX(p.Total) THEN 1 ELSE 0 END, NULL FROM Ventas.PedidoDetalle d JOIN Ventas.Pedido p ON p.IDPedido = d.IDPedido WHERE p.IDPedido = @IDPedido;
EXEC Api.SP_Catalogo_CambiarPrecio 2, @Var, 99.99;

SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_ObtenerDetalle ', @Otro, N', ', @IDPedido, N';');
EXEC #Espera N'RF-01 pedido ajeno responde no encontrado', @Sql, 51007;
SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_CambiarEstado 3, ', @IDPedido, N', ''ENTREGADO'';');
EXEC #Espera N'RF-07 salto de estado rechazado', @Sql, 51501;
SET @Sql = CONCAT(N'UPDATE Ventas.Pedido SET IDEstadoPedido = 5 WHERE IDPedido = ', @IDPedido, N';');
EXEC #Espera N'RF-07 la BD rechaza la transicion directa', @Sql, 51501;
SET @Sql = CONCAT(N'UPDATE Ventas.Pedido SET Total = 1 WHERE IDPedido = ', @IDPedido, N';');
EXEC #Espera N'RF-02 el total del pedido es inmutable', @Sql, 51505;

EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'EN_PREPARACION';
EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'DESPACHADO';
SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_CancelarPedido 3, ', @IDPedido, N', N''Tarde'';');
EXEC #Espera N'RF-07 no se cancela despachado', @Sql, 51502;
EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'ENTREGADO';

SELECT @Det = IDPedidoDetalle FROM Ventas.PedidoDetalle WHERE IDPedido = @IDPedido AND IDVariante = @Var;
SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_CrearDevolucion 3, ', @IDPedido, N', N''Excede'', N''[{"IDPedidoDetalle":', @Det, N',"Cantidad":4}]'';');
EXEC #Espera N'RF-07 no devuelve mas de lo vendido', @Sql, 51503;
DECLARE @Disp1 INT, @Disp2 INT;
DECLARE @Dv TABLE (a BIGINT, b DECIMAL(18,2), c VARCHAR(30));
DECLARE @J NVARCHAR(200) = CONCAT(N'[{"IDPedidoDetalle":', @Det, N',"Cantidad":2}]');
SELECT @Disp1 = SUM(Fisica) FROM Inventario.Existencia WHERE IDVariante = @Var;
INSERT @Dv EXEC Api.SP_Pedidos_CrearDevolucion 3, @IDPedido, N'Parcial', @J;
SELECT @Disp2 = SUM(Fisica) FROM Inventario.Existencia WHERE IDVariante = @Var;
INSERT #R VALUES (N'RF-07 devolucion reintegra existencia', CASE WHEN @Disp2 = @Disp1 + 2 THEN 1 ELSE 0 END, CONCAT(@Disp1, N'->', @Disp2));
INSERT #R SELECT N'RF-07 devolucion parcial cambia el estado', CASE WHEN c = 'DEVUELTO_PARCIAL' THEN 1 ELSE 0 END, c FROM @Dv;
INSERT #R SELECT N'RF-07 historial registra cada cambio', CASE WHEN COUNT(*) >= 5 THEN 1 ELSE 0 END, CONCAT(COUNT(*), N'') FROM Ventas.PedidoHistorialEstado WHERE IDPedido = @IDPedido;
GO
/* Reserva vencida: se libera sola al correr el job, y el cobro tardio queda para reembolso. */
DECLARE @Cli INT = 6, @Dir INT = (SELECT IDDireccion FROM Clientes.Direccion WHERE IDUsuario = 6), @H BINARY(32) = 0x01, @L UNIQUEIDENTIFIER = NEWID(), @Var INT = (SELECT IDVariante FROM Catalogo.Variante WHERE SKU = 'PLY-BAS-L'),
        @IDCheckout BIGINT, @Total DECIMAL(18,2), @R1 INT, @R2 INT, @Sql NVARCHAR(MAX);
DECLARE @C TABLE (a BIGINT, b DECIMAL(18,2), c DECIMAL(18,2), d DECIMAL(18,2), e DECIMAL(18,2), f VARCHAR(12), g DATETIME2(3));
DECLARE @J TABLE (n INT);
EXEC Interno.SP_Carrito_EscribirLinea @Cli, NULL, @Var, 1, 0;
SELECT @R1 = SUM(Reservada) FROM Inventario.Existencia WHERE IDVariante = @Var;
INSERT @C EXEC Api.SP_Checkout_IniciarPago @Cli, @L, @H, 1, @Dir, NULL;
SELECT @IDCheckout = a, @Total = e FROM @C;
UPDATE Ventas.Checkout SET ExpiraEn = DATEADD(MINUTE, -1, SYSUTCDATETIME()) WHERE IDCheckout = @IDCheckout;
SET @Sql = CONCAT(N'EXEC Api.SP_Pedidos_CrearPedido ', @Cli, N', ', @IDCheckout, N', ''', NEWID(), N''', 0x01, 1, ''P-TARDE'', ', @Total, N';');
EXEC #Espera N'RF-06 pago tardio rechazado', @Sql, 51403;
INSERT #R SELECT N'RF-06 pago tardio queda para reembolso', CASE WHEN COUNT(*) = 1 THEN 1 ELSE 0 END, NULL FROM Ventas.Pago WHERE ReferenciaPasarela = 'P-TARDE' AND Estado = 'REEMBOLSO_PENDIENTE';
INSERT @J EXEC Job.SP_Inventario_LiberarReservasVencidas;
SELECT @R2 = SUM(Reservada) FROM Inventario.Existencia WHERE IDVariante = @Var;
INSERT #R VALUES (N'RF-07 reserva vencida libera existencia', CASE WHEN @R1 = @R2 THEN 1 ELSE 0 END, CONCAT(@R1, N'/', @R2));
EXEC Interno.SP_Carrito_EscribirLinea @Cli, NULL, @Var, 1, 0;
EXEC Api.SP_Carrito_EliminarItem @Cli, NULL, @Var;
GO
/* Cierre */
INSERT #R SELECT N'RF-03 existencia coincide con kardex', CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END, CONCAT(COUNT(*), N' descuadres') FROM Interno.VW_Inventario_ConciliacionKardex;
INSERT #R SELECT N'RF-09 cambios quedaron en bitacora', CASE WHEN COUNT(DISTINCT Modulo) >= 4 THEN 1 ELSE 0 END, CONCAT(COUNT(DISTINCT Modulo), N'') FROM Auditoria.Bitacora;
INSERT #R SELECT N'Sin errores inesperados registrados', CASE WHEN COUNT(*) = 0 THEN 1 ELSE 0 END, MAX(Mensaje) FROM Auditoria.ErrorBD WHERE Procedimiento IS NOT NULL AND Fecha > DATEADD(HOUR, -1, SYSUTCDATETIME()) AND Numero NOT IN (4712);

SELECT CASE Ok WHEN 1 THEN 'OK   ' ELSE 'FALLA' END AS Resultado, Prueba, ISNULL(Detalle, N'') AS Detalle FROM #R ORDER BY Ok, Prueba;
DECLARE @Fallas INT = (SELECT COUNT(*) FROM #R WHERE Ok = 0), @Msg NVARCHAR(100);
SET @Msg = CONCAT(@Fallas, N' prueba(s) fallaron de ', (SELECT COUNT(*) FROM #R));
IF @Fallas > 0 THROW 59999, @Msg, 1;
PRINT N'Todas las pruebas pasaron.';
GO
