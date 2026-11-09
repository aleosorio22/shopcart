/* 018 - Fotos de demostracion para los productos de la semilla.
   Los archivos viven en frontend/public/img/productos (fotos libres de Unsplash).
   Se puede ejecutar varias veces: no duplica una imagen ya registrada. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
SET NOCOUNT ON;
DECLARE @Imagenes TABLE (Slug VARCHAR(220), SKU VARCHAR(40) NULL, Url NVARCHAR(500), TextoAlt NVARCHAR(200), Orden SMALLINT);
INSERT @Imagenes VALUES
 ('asus-vivobook-15',   NULL,            N'/img/productos/notebook-1.webp',        N'Notebook abierta sobre un escritorio blanco', 0),
 ('asus-vivobook-15',   NULL,            N'/img/productos/notebook-2.webp',        N'Detalle del teclado de la notebook', 1),
 ('samsung-galaxy-a55', NULL,            N'/img/productos/celular-1.webp',         N'Celular con pantalla encendida', 0),
 ('samsung-galaxy-a55', NULL,            N'/img/productos/celular-2.webp',         N'Celular negro sobre una mesa', 1),
 ('jbl-tune-520bt',     'AUD-T520-NEG',  N'/img/productos/audifonos-1.webp',       N'Audifonos inalambricos negros', 0),
 ('jbl-tune-520bt',     'AUD-T520-BLA',  N'/img/productos/audifonos-blancos.webp', N'Audifonos blancos', 1),
 ('logitech-m185',      NULL,            N'/img/productos/mouse-1.webp',           N'Mouse inalambrico', 0),
 ('playera-basics',     NULL,            N'/img/productos/playera-1.webp',         N'Playera blanca de cuello redondo', 0),
 ('playera-basics',     NULL,            N'/img/productos/playera-2.webp',         N'Playera blanca doblada', 1);

INSERT Catalogo.ImagenProducto (IDProducto, IDVariante, Url, TextoAlt, Orden)
SELECT p.IDProducto, v.IDVariante, i.Url, i.TextoAlt, i.Orden
FROM @Imagenes i
JOIN Catalogo.Producto p ON p.Slug = i.Slug
LEFT JOIN Catalogo.Variante v ON v.SKU = i.SKU AND v.IDProducto = p.IDProducto
WHERE NOT EXISTS (SELECT 1 FROM Catalogo.ImagenProducto x WHERE x.IDProducto = p.IDProducto AND x.Url = i.Url);
GO
