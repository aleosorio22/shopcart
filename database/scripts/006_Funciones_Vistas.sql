/* 006 - Funciones tipo tabla (inline, para no penalizar el plan) y vistas. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
CREATE OR ALTER FUNCTION Interno.FU_Catalogo_Ancestros (@IDCategoria INT) RETURNS TABLE AS RETURN
    WITH c AS (
        SELECT IDCategoria, IDCategoriaPadre FROM Catalogo.Categoria WHERE IDCategoria = @IDCategoria
        UNION ALL
        SELECT p.IDCategoria, p.IDCategoriaPadre FROM Catalogo.Categoria p JOIN c ON p.IDCategoria = c.IDCategoriaPadre
    ) SELECT IDCategoria FROM c;
GO
CREATE OR ALTER FUNCTION Interno.FU_Catalogo_Descendientes (@IDCategoria INT) RETURNS TABLE AS RETURN
    WITH c AS (
        SELECT IDCategoria FROM Catalogo.Categoria WHERE IDCategoria = @IDCategoria
        UNION ALL
        SELECT h.IDCategoria FROM Catalogo.Categoria h JOIN c ON h.IDCategoriaPadre = c.IDCategoria
    ) SELECT IDCategoria FROM c;
GO
CREATE OR ALTER FUNCTION Interno.FU_Impuestos_TasaVigente (@IDImpuesto SMALLINT, @Ahora DATETIME2(3)) RETURNS TABLE AS RETURN
    SELECT TOP (1) t.Porcentaje
    FROM Catalogo.TasaImpuesto t
    WHERE t.IDImpuesto = @IDImpuesto AND t.VigenteDesde <= @Ahora AND (t.VigenteHasta IS NULL OR t.VigenteHasta > @Ahora)
    ORDER BY t.VigenteDesde DESC;
GO
-- Precio vigente con la mejor promocion aplicable para el cliente.
CREATE OR ALTER FUNCTION Interno.FU_Catalogo_PrecioVigente (@IDVariante INT, @Ahora DATETIME2(3)) RETURNS TABLE AS RETURN
    SELECT v.IDVariante, pv.Precio AS PrecioLista,
           ISNULL(pr.Descuento, 0) AS DescuentoUnitario,
           CAST(pv.Precio - ISNULL(pr.Descuento, 0) AS DECIMAL(18,2)) AS PrecioFinal,
           pr.IDPromocion
    FROM Catalogo.Variante v
    JOIN Catalogo.Producto p ON p.IDProducto = v.IDProducto
    CROSS APPLY (SELECT TOP (1) x.Precio FROM Catalogo.PrecioVariante x
                 WHERE x.IDVariante = v.IDVariante AND x.VigenteDesde <= @Ahora
                   AND (x.VigenteHasta IS NULL OR x.VigenteHasta > @Ahora)
                 ORDER BY x.VigenteDesde DESC) pv
    OUTER APPLY (
        SELECT TOP (1) m.IDPromocion, d.Descuento
        FROM Marketing.Promocion m
        CROSS APPLY (SELECT CAST(CASE WHEN c.Monto > pv.Precio THEN pv.Precio ELSE c.Monto END AS DECIMAL(18,2)) AS Descuento
                     FROM (SELECT CASE m.TipoDescuento WHEN 'PORCENTAJE' THEN ROUND(pv.Precio * m.Valor / 100, 2) ELSE m.Valor END AS Monto) c) d
        WHERE m.Activo = 1 AND m.VigenteDesde <= @Ahora AND m.VigenteHasta > @Ahora
          AND EXISTS (SELECT 1 FROM Marketing.PromocionAlcance a
                      WHERE a.IDPromocion = m.IDPromocion
                        AND (a.IDVariante = v.IDVariante OR a.IDProducto = p.IDProducto OR a.IDMarca = p.IDMarca
                             OR a.IDCategoria IN (SELECT IDCategoria FROM Interno.FU_Catalogo_Ancestros(p.IDCategoria))))
        ORDER BY d.Descuento DESC, m.IDPromocion
    ) pr
    WHERE v.IDVariante = @IDVariante;
GO
-- @IDSucursal NULL = venta en linea; con valor = solo bodegas de esa sucursal (recoger en tienda).
CREATE OR ALTER FUNCTION Interno.FU_Inventario_Disponible (@IDVariante INT, @IDSucursal INT) RETURNS TABLE AS RETURN
    SELECT ISNULL(SUM(e.Disponible), 0) AS Disponible
    FROM Inventario.Existencia e
    JOIN Inventario.Bodega b ON b.IDBodega = e.IDBodega
    WHERE e.IDVariante = @IDVariante AND b.Activo = 1
      AND ((@IDSucursal IS NULL AND b.PermiteVentaEnLinea = 1) OR b.IDSucursal = @IDSucursal);
GO
CREATE OR ALTER FUNCTION Interno.FU_Carrito_Lineas (@IDCarrito BIGINT, @Ahora DATETIME2(3)) RETURNS TABLE AS RETURN
    SELECT cd.IDCarritoDetalle, cd.IDVariante, v.SKU, p.IDProducto, p.Nombre AS NombreProducto, p.IDCategoria, p.IDImpuesto,
           cd.Cantidad, pr.PrecioLista, pr.DescuentoUnitario, pr.PrecioFinal, pr.IDPromocion,
           CAST(cd.Cantidad * pr.PrecioFinal AS DECIMAL(18,2)) AS Subtotal,
           d.Disponible,
           CAST(CASE WHEN v.Activo = 1 AND p.Activo = 1 THEN 1 ELSE 0 END AS BIT) AS Vendible
    FROM Ventas.CarritoDetalle cd
    JOIN Catalogo.Variante v ON v.IDVariante = cd.IDVariante
    JOIN Catalogo.Producto p ON p.IDProducto = v.IDProducto
    CROSS APPLY Interno.FU_Catalogo_PrecioVigente(cd.IDVariante, @Ahora) pr
    CROSS APPLY Interno.FU_Inventario_Disponible(cd.IDVariante, NULL) d
    WHERE cd.IDCarrito = @IDCarrito;
GO
-- El descuento nunca supera lo elegible, por lo que el total nunca baja de cero.
CREATE OR ALTER FUNCTION Interno.FU_Cupones_CalculoDescuento (@IDCupon INT, @IDCarrito BIGINT, @Ahora DATETIME2(3)) RETURNS TABLE AS RETURN
    SELECT c.IDCupon, t.Subtotal, e.Elegible,
           CAST(CASE WHEN f.Monto > e.Elegible THEN e.Elegible ELSE f.Monto END AS DECIMAL(18,2)) AS Descuento
    FROM Marketing.Cupon c
    CROSS APPLY (SELECT ISNULL(SUM(l.Subtotal), 0) AS Subtotal FROM Interno.FU_Carrito_Lineas(@IDCarrito, @Ahora) l) t
    CROSS APPLY (SELECT ISNULL(SUM(l.Subtotal), 0) AS Elegible
                 FROM Interno.FU_Carrito_Lineas(@IDCarrito, @Ahora) l
                 WHERE c.IDCategoria IS NULL
                    OR c.IDCategoria IN (SELECT IDCategoria FROM Interno.FU_Catalogo_Ancestros(l.IDCategoria))) e
    CROSS APPLY (SELECT CASE c.TipoDescuento WHEN 'PORCENTAJE' THEN ROUND(e.Elegible * c.Valor / 100, 2) ELSE c.Valor END AS Monto) b
    CROSS APPLY (SELECT CASE WHEN c.DescuentoMaximo IS NOT NULL AND b.Monto > c.DescuentoMaximo THEN c.DescuentoMaximo ELSE b.Monto END AS Monto) f
    WHERE c.IDCupon = @IDCupon;
GO
/* ---------- Vistas ---------- */
CREATE OR ALTER VIEW Interno.VW_Inventario_ExistenciaDisponible AS
    SELECT e.IDVariante, v.SKU, p.IDProducto, p.Nombre AS NombreProducto, e.IDBodega, b.Codigo AS CodigoBodega, b.Nombre AS NombreBodega,
           e.Fisica, e.Reservada, e.Disponible, e.StockMinimo, e.CostoPromedio
    FROM Inventario.Existencia e
    JOIN Catalogo.Variante v ON v.IDVariante = e.IDVariante
    JOIN Catalogo.Producto p ON p.IDProducto = v.IDProducto
    JOIN Inventario.Bodega b ON b.IDBodega = e.IDBodega;
GO
-- RF-03: debe devolver cero filas en todo momento.
CREATE OR ALTER VIEW Interno.VW_Inventario_ConciliacionKardex AS
    SELECT e.IDVariante, e.IDBodega, e.Fisica, ISNULL(k.SumaKardex, 0) AS SumaKardex
    FROM Inventario.Existencia e
    OUTER APPLY (SELECT SUM(x.Cantidad) AS SumaKardex FROM Inventario.Kardex x
                 WHERE x.IDVariante = e.IDVariante AND x.IDBodega = e.IDBodega) k
    WHERE e.Fisica <> ISNULL(k.SumaKardex, 0);
GO
CREATE OR ALTER VIEW Interno.VW_Pedidos_Historial AS
    SELECT h.IDPedidoHistorialEstado, h.IDPedido, ea.Codigo AS EstadoAnterior, en.Codigo AS EstadoNuevo,
           h.IDUsuario, u.Correo AS CorreoUsuario, h.Fecha, h.Motivo
    FROM Ventas.PedidoHistorialEstado h
    LEFT JOIN Ventas.EstadoPedido ea ON ea.IDEstadoPedido = h.IDEstadoAnterior
    JOIN Ventas.EstadoPedido en ON en.IDEstadoPedido = h.IDEstadoNuevo
    JOIN Seguridad.Usuario u ON u.IDUsuario = h.IDUsuario;
GO
-- Base de todos los reportes: pedidos completados, netos de devoluciones (RF-08).
CREATE OR ALTER VIEW Interno.VW_Reportes_VentaNetaLinea AS
    SELECT p.IDPedido, p.FechaLocal, p.IDUsuario, d.IDPedidoDetalle, d.IDVariante, d.SKU, d.NombreProducto,
           v.IDProducto, pr.IDCategoria,
           d.Cantidad - d.CantidadDevuelta AS CantidadNeta,
           d.TotalLinea - ISNULL(dv.MontoDevuelto, 0) AS MontoNeto,
           CAST((d.Cantidad - d.CantidadDevuelta) * d.CostoUnitario AS DECIMAL(18,2)) AS CostoNeto
    FROM Ventas.Pedido p
    JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido AND e.EsVentaReportable = 1
    JOIN Ventas.PedidoDetalle d ON d.IDPedido = p.IDPedido
    JOIN Catalogo.Variante v ON v.IDVariante = d.IDVariante
    JOIN Catalogo.Producto pr ON pr.IDProducto = v.IDProducto
    OUTER APPLY (SELECT SUM(x.Monto) AS MontoDevuelto FROM Ventas.DevolucionDetalle x WHERE x.IDPedidoDetalle = d.IDPedidoDetalle) dv;
GO
CREATE OR ALTER VIEW Interno.VW_Dashboard_VentasPorDia AS
    SELECT p.FechaLocal, COUNT_BIG(*) AS NumeroPedidos,
           SUM(p.Total - ISNULL(dv.Monto, 0)) AS MontoNeto
    FROM Ventas.Pedido p
    JOIN Ventas.EstadoPedido e ON e.IDEstadoPedido = p.IDEstadoPedido AND e.EsVentaReportable = 1
    OUTER APPLY (SELECT SUM(x.Monto) AS Monto FROM Ventas.Devolucion h
                 JOIN Ventas.DevolucionDetalle x ON x.IDDevolucion = h.IDDevolucion WHERE h.IDPedido = p.IDPedido) dv
    GROUP BY p.FechaLocal;
GO
CREATE OR ALTER VIEW Interno.VW_Dashboard_VentasPorCategoria AS
    SELECT l.FechaLocal, l.IDCategoria, c.Nombre AS Categoria, SUM(l.CantidadNeta) AS Unidades, SUM(l.MontoNeto) AS MontoNeto
    FROM Interno.VW_Reportes_VentaNetaLinea l
    JOIN Catalogo.Categoria c ON c.IDCategoria = l.IDCategoria
    GROUP BY l.FechaLocal, l.IDCategoria, c.Nombre;
GO
CREATE OR ALTER VIEW Interno.VW_Carrito_Abandonado AS
    SELECT c.IDCarrito, c.IDUsuario, u.Correo, c.UltimaActividad,
           DATEDIFF(MINUTE, c.UltimaActividad, SYSUTCDATETIME()) AS MinutosInactivo,
           n.Lineas, n.Unidades
    FROM Ventas.Carrito c
    LEFT JOIN Seguridad.Usuario u ON u.IDUsuario = c.IDUsuario
    CROSS APPLY (SELECT COUNT(*) AS Lineas, ISNULL(SUM(d.Cantidad), 0) AS Unidades FROM Ventas.CarritoDetalle d WHERE d.IDCarrito = c.IDCarrito) n
    WHERE c.Estado = 'ACTIVO' AND n.Lineas > 0
      AND c.UltimaActividad < DATEADD(MINUTE, -(SELECT CAST(Valor AS INT) FROM Config.Parametro WHERE Clave = 'CARRITO_ABANDONO_MINUTOS'), SYSUTCDATETIME());
GO
