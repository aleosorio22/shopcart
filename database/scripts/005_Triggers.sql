/* 005 - Reglas que deben sobrevivir aunque un SP tenga un error:
   inmutabilidad, maquina de estados y bitacora (RF-07, RF-09). */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
/* ---------- Tablas append-only ---------- */
CREATE OR ALTER TRIGGER Auditoria.TR_Bitacora_Inmutable ON Auditoria.Bitacora AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    ;THROW 51507, N'La bitacora no puede modificarse ni eliminarse.', 1;
END;
GO
CREATE OR ALTER TRIGGER Inventario.TR_Kardex_Inmutable ON Inventario.Kardex AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    ;THROW 51204, N'El kardex no puede modificarse ni eliminarse.', 1;
END;
GO
CREATE OR ALTER TRIGGER Ventas.TR_PedidoHistorialEstado_Inmutable ON Ventas.PedidoHistorialEstado AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    ;THROW 51505, N'El historial de estados no puede modificarse.', 1;
END;
GO
CREATE OR ALTER TRIGGER Catalogo.TR_PrecioVariante_Inmutable ON Catalogo.PrecioVariante AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF NOT EXISTS (SELECT 1 FROM inserted) OR UPDATE(Precio) OR UPDATE(VigenteDesde) OR UPDATE(IDVariante)
        THROW 51506, N'Un precio historico no se modifica: se cierra su vigencia y se crea otro.', 1;
END;
GO
CREATE OR ALTER TRIGGER Ventas.TR_PedidoDetalle_Inmutable ON Ventas.PedidoDetalle AFTER UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF NOT EXISTS (SELECT 1 FROM inserted) OR UPDATE(Cantidad) OR UPDATE(PrecioLista) OR UPDATE(DescuentoPromocion)
       OR UPDATE(PrecioUnitario) OR UPDATE(DescuentoCupon) OR UPDATE(TotalLinea) OR UPDATE(BaseLinea)
       OR UPDATE(IVALinea) OR UPDATE(TasaIVA) OR UPDATE(CostoUnitario) OR UPDATE(IDVariante)
        THROW 51505, N'El detalle de un pedido queda congelado al momento de la compra.', 1;
END;
GO
/* ---------- Pedido: congelado y con maquina de estados ---------- */
CREATE OR ALTER TRIGGER Ventas.TR_Pedido_Estado ON Ventas.Pedido AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF NOT EXISTS (SELECT 1 FROM inserted)
        THROW 51505, N'Un pedido no se elimina.', 1;
    IF EXISTS (SELECT 1 FROM deleted) AND (UPDATE(Subtotal) OR UPDATE(DescuentoCupon) OR UPDATE(CostoEnvio)
        OR UPDATE(Total) OR UPDATE(BaseImponible) OR UPDATE(IVA) OR UPDATE(IDUsuario) OR UPDATE(IDCheckout) OR UPDATE(FechaPedido))
        THROW 51505, N'Los montos de un pedido quedan congelados al momento de la compra.', 1;

    IF EXISTS (SELECT 1 FROM inserted i JOIN deleted d ON d.IDPedido = i.IDPedido
               WHERE i.IDEstadoPedido <> d.IDEstadoPedido
                 AND NOT EXISTS (SELECT 1 FROM Ventas.TransicionEstadoPedido t
                                 WHERE t.IDEstadoOrigen = d.IDEstadoPedido AND t.IDEstadoDestino = i.IDEstadoPedido))
        THROW 51501, N'Transicion de estado no permitida.', 1;

    INSERT Ventas.PedidoHistorialEstado (IDPedido, IDEstadoAnterior, IDEstadoNuevo, IDUsuario, Motivo)
    SELECT i.IDPedido, d.IDEstadoPedido, i.IDEstadoPedido,
           COALESCE(CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), i.IDUsuario),
           CAST(SESSION_CONTEXT(N'Motivo') AS NVARCHAR(300))
    FROM inserted i LEFT JOIN deleted d ON d.IDPedido = i.IDPedido
    WHERE d.IDPedido IS NULL OR d.IDEstadoPedido <> i.IDEstadoPedido;

    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'PEDIDOS', 'Pedido', CAST(i.IDPedido AS VARCHAR(60)),
           CASE WHEN d.IDPedido IS NULL THEN 'CREAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDPedido IS NULL THEN NULL ELSE (SELECT d.IDEstadoPedido FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           (SELECT i.NumeroPedido, i.IDEstadoPedido, i.Total FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i LEFT JOIN deleted d ON d.IDPedido = i.IDPedido
    WHERE d.IDPedido IS NULL OR d.IDEstadoPedido <> i.IDEstadoPedido;
END;
GO
/* ---------- Bitacora por entidad (RF-09) ---------- */
CREATE OR ALTER TRIGGER Catalogo.TR_Categoria_Auditoria ON Catalogo.Categoria AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CATALOGO', 'Categoria', CAST(COALESCE(i.IDCategoria, d.IDCategoria) AS VARCHAR(60)),
           CASE WHEN d.IDCategoria IS NULL THEN 'CREAR' WHEN i.IDCategoria IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDCategoria IS NULL THEN NULL ELSE (SELECT d.Nombre, d.Slug, d.IDCategoriaPadre, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDCategoria IS NULL THEN NULL ELSE (SELECT i.Nombre, i.Slug, i.IDCategoriaPadre, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDCategoria = i.IDCategoria;
END;
GO
CREATE OR ALTER TRIGGER Catalogo.TR_Producto_Auditoria ON Catalogo.Producto AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CATALOGO', 'Producto', CAST(COALESCE(i.IDProducto, d.IDProducto) AS VARCHAR(60)),
           CASE WHEN d.IDProducto IS NULL THEN 'CREAR' WHEN i.IDProducto IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDProducto IS NULL THEN NULL ELSE (SELECT d.Nombre, d.Slug, d.IDCategoria, d.IDMarca, d.IDImpuesto, d.MesesGarantia, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDProducto IS NULL THEN NULL ELSE (SELECT i.Nombre, i.Slug, i.IDCategoria, i.IDMarca, i.IDImpuesto, i.MesesGarantia, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDProducto = i.IDProducto;
END;
GO
CREATE OR ALTER TRIGGER Catalogo.TR_Variante_Auditoria ON Catalogo.Variante AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CATALOGO', 'Variante', CAST(COALESCE(i.IDVariante, d.IDVariante) AS VARCHAR(60)),
           CASE WHEN d.IDVariante IS NULL THEN 'CREAR' WHEN i.IDVariante IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDVariante IS NULL THEN NULL ELSE (SELECT d.IDProducto, d.SKU, d.PesoGramos, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDVariante IS NULL THEN NULL ELSE (SELECT i.IDProducto, i.SKU, i.PesoGramos, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDVariante = i.IDVariante;
END;
GO
CREATE OR ALTER TRIGGER Catalogo.TR_PrecioVariante_Auditoria ON Catalogo.PrecioVariante AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT i.IDUsuario, 'PRECIOS', 'PrecioVariante', CAST(i.IDVariante AS VARCHAR(60)),
           CASE WHEN a.Precio IS NULL THEN 'CREAR' ELSE 'MODIFICAR' END,
           CASE WHEN a.Precio IS NULL THEN NULL ELSE (SELECT a.Precio FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           (SELECT i.Precio, i.VigenteDesde FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i
    OUTER APPLY (SELECT TOP (1) p.Precio FROM Catalogo.PrecioVariante p
                 WHERE p.IDVariante = i.IDVariante AND p.VigenteDesde < i.VigenteDesde
                 ORDER BY p.VigenteDesde DESC) a;
END;
GO
-- Cada movimiento de existencia queda en la bitacora ademas del kardex.
CREATE OR ALTER TRIGGER Inventario.TR_Kardex_Auditoria ON Inventario.Kardex AFTER INSERT AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT i.IDUsuario, 'INVENTARIO', 'Existencia', CONCAT(i.IDVariante, '-', i.IDBodega), 'MODIFICAR',
           (SELECT i.SaldoAnterior FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           (SELECT i.SaldoNuevo, i.Cantidad, i.IDTipoMovimiento, i.Motivo, i.IDKardex FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i;
END;
GO
-- UsosActuales queda fuera: cambia en cada venta y su trazabilidad esta en Ventas.CuponUso.
CREATE OR ALTER TRIGGER Marketing.TR_Cupon_Auditoria ON Marketing.Cupon AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    IF EXISTS (SELECT 1 FROM inserted) AND EXISTS (SELECT 1 FROM deleted) AND UPDATE(UsosActuales) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CUPONES', 'Cupon', CAST(COALESCE(i.IDCupon, d.IDCupon) AS VARCHAR(60)),
           CASE WHEN d.IDCupon IS NULL THEN 'CREAR' WHEN i.IDCupon IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDCupon IS NULL THEN NULL ELSE (SELECT d.Codigo, d.TipoDescuento, d.Valor, d.DescuentoMaximo, d.MontoMinimo, d.VigenteDesde, d.VigenteHasta, d.LimiteTotal, d.LimitePorCliente, d.IDCategoria, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDCupon IS NULL THEN NULL ELSE (SELECT i.Codigo, i.TipoDescuento, i.Valor, i.DescuentoMaximo, i.MontoMinimo, i.VigenteDesde, i.VigenteHasta, i.LimiteTotal, i.LimitePorCliente, i.IDCategoria, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDCupon = i.IDCupon;
END;
GO
CREATE OR ALTER TRIGGER Marketing.TR_Promocion_Auditoria ON Marketing.Promocion AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'MARKETING', 'Promocion', CAST(COALESCE(i.IDPromocion, d.IDPromocion) AS VARCHAR(60)),
           CASE WHEN d.IDPromocion IS NULL THEN 'CREAR' WHEN i.IDPromocion IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDPromocion IS NULL THEN NULL ELSE (SELECT d.Nombre, d.TipoDescuento, d.Valor, d.VigenteDesde, d.VigenteHasta, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDPromocion IS NULL THEN NULL ELSE (SELECT i.Nombre, i.TipoDescuento, i.Valor, i.VigenteDesde, i.VigenteHasta, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDPromocion = i.IDPromocion;
END;
GO
CREATE OR ALTER TRIGGER Marketing.TR_Anuncio_Auditoria ON Marketing.Anuncio AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'MARKETING', 'Anuncio', CAST(COALESCE(i.IDAnuncio, d.IDAnuncio) AS VARCHAR(60)),
           CASE WHEN d.IDAnuncio IS NULL THEN 'CREAR' WHEN i.IDAnuncio IS NULL THEN 'ELIMINAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDAnuncio IS NULL THEN NULL ELSE (SELECT d.Titulo, d.IDZonaAnuncio, d.UrlDestino, d.VigenteDesde, d.VigenteHasta, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDAnuncio IS NULL THEN NULL ELSE (SELECT i.Titulo, i.IDZonaAnuncio, i.UrlDestino, i.VigenteDesde, i.VigenteHasta, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDAnuncio = i.IDAnuncio;
END;
GO
-- HashContrasena nunca entra a la bitacora. Solo se audita lo que un humano cambia.
CREATE OR ALTER TRIGGER Seguridad.TR_Usuario_Auditoria ON Seguridad.Usuario AFTER INSERT, UPDATE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) RETURN;
    IF EXISTS (SELECT 1 FROM deleted) AND NOT (UPDATE(Correo) OR UPDATE(IDRol) OR UPDATE(Activo) OR UPDATE(Nombres) OR UPDATE(Apellidos) OR UPDATE(HashContrasena)) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'USUARIOS', 'Usuario', CAST(i.IDUsuario AS VARCHAR(60)),
           CASE WHEN d.IDUsuario IS NULL THEN 'CREAR' WHEN d.Activo = 1 AND i.Activo = 0 THEN 'DESACTIVAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDUsuario IS NULL THEN NULL ELSE (SELECT d.Correo, d.IDRol, d.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           (SELECT i.Correo, i.IDRol, i.Activo FOR JSON PATH, WITHOUT_ARRAY_WRAPPER),
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i LEFT JOIN deleted d ON d.IDUsuario = i.IDUsuario;
END;
GO
CREATE OR ALTER TRIGGER Config.TR_Parametro_Auditoria ON Config.Parametro AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CONFIG', 'Parametro', COALESCE(i.Clave, d.Clave),
           CASE WHEN d.Clave IS NULL THEN 'CREAR' WHEN i.Clave IS NULL THEN 'ELIMINAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.Clave IS NULL THEN NULL ELSE (SELECT d.Valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.Clave IS NULL THEN NULL ELSE (SELECT i.Valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.Clave = i.Clave;
END;
GO
