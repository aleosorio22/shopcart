/* 009 - RF-02 y RF-03. Sin SQL dinamico: el ordenamiento se resuelve con CASE. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_ListarCategorias @IncluirInactivas BIT = 0
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDCategoria, IDCategoriaPadre, Nombre, Slug, Descripcion, Orden, Activo
    FROM Catalogo.Categoria WHERE @IncluirInactivas = 1 OR Activo = 1
    ORDER BY Orden, Nombre;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarCategoria
    @IDUsuarioActor INT, @IDCategoria INT = NULL, @IDCategoriaPadre INT = NULL, @Nombre NVARCHAR(100), @Slug VARCHAR(120),
    @Descripcion NVARCHAR(500) = NULL, @Orden SMALLINT = 0, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        IF @IDCategoria IS NOT NULL AND @IDCategoriaPadre IN (SELECT IDCategoria FROM Interno.FU_Catalogo_Descendientes(@IDCategoria))
            EXEC Interno.SP_Error_Lanzar 51103;
        IF @IDCategoria IS NULL
        BEGIN
            INSERT Catalogo.Categoria (IDCategoriaPadre, Nombre, Slug, Descripcion, Orden, Activo)
            VALUES (@IDCategoriaPadre, @Nombre, @Slug, @Descripcion, @Orden, @Activo);
            SET @IDCategoria = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Catalogo.Categoria SET IDCategoriaPadre = @IDCategoriaPadre, Nombre = @Nombre, Slug = @Slug, Descripcion = @Descripcion, Orden = @Orden, Activo = @Activo
            WHERE IDCategoria = @IDCategoria;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDCategoria AS IDCategoria;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_EliminarCategoria @IDUsuarioActor INT, @IDCategoria INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        IF EXISTS (SELECT 1 FROM Catalogo.Categoria WHERE IDCategoriaPadre = @IDCategoria)
           OR EXISTS (SELECT 1 FROM Catalogo.Producto WHERE IDCategoria = @IDCategoria)
           OR EXISTS (SELECT 1 FROM Marketing.Cupon WHERE IDCategoria = @IDCategoria)
           OR EXISTS (SELECT 1 FROM Marketing.PromocionAlcance WHERE IDCategoria = @IDCategoria)
        BEGIN
            UPDATE Catalogo.Categoria SET Activo = 0 WHERE IDCategoria = @IDCategoria;
            SELECT 'DESACTIVADA' AS Resultado;
        END
        ELSE
        BEGIN
            DELETE Catalogo.Categoria WHERE IDCategoria = @IDCategoria;
            SELECT 'ELIMINADA' AS Resultado;
        END;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_ListarMarcas
AS
BEGIN
    SET NOCOUNT ON;
    SELECT IDMarca, Nombre, Slug, LogoUrl, Activo FROM Catalogo.Marca ORDER BY Nombre;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarMarca
    @IDUsuarioActor INT, @IDMarca INT = NULL, @Nombre NVARCHAR(100), @Slug VARCHAR(120), @LogoUrl NVARCHAR(500) = NULL, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        IF @IDMarca IS NULL
        BEGIN
            INSERT Catalogo.Marca (Nombre, Slug, LogoUrl, Activo) VALUES (@Nombre, @Slug, @LogoUrl, @Activo);
            SET @IDMarca = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Catalogo.Marca SET Nombre = @Nombre, Slug = @Slug, LogoUrl = @LogoUrl, Activo = @Activo WHERE IDMarca = @IDMarca;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDMarca AS IDMarca;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarProducto
    @IDUsuarioActor INT, @IDProducto INT = NULL, @IDCategoria INT, @IDMarca INT = NULL, @Nombre NVARCHAR(200), @Slug VARCHAR(220),
    @Descripcion NVARCHAR(MAX) = NULL, @MesesGarantia SMALLINT = 0, @CodigoImpuesto VARCHAR(20) = 'IVA', @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        DECLARE @IDImpuesto SMALLINT = (SELECT IDImpuesto FROM Catalogo.Impuesto WHERE Codigo = @CodigoImpuesto);
        IF @IDImpuesto IS NULL EXEC Interno.SP_Error_Lanzar 51006, N'Impuesto invalido.';
        IF @IDProducto IS NULL
        BEGIN
            INSERT Catalogo.Producto (IDCategoria, IDMarca, IDImpuesto, Nombre, Slug, Descripcion, MesesGarantia, Activo)
            VALUES (@IDCategoria, @IDMarca, @IDImpuesto, @Nombre, @Slug, @Descripcion, @MesesGarantia, @Activo);
            SET @IDProducto = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Catalogo.Producto
            SET IDCategoria = @IDCategoria, IDMarca = @IDMarca, IDImpuesto = @IDImpuesto, Nombre = @Nombre, Slug = @Slug,
                Descripcion = @Descripcion, MesesGarantia = @MesesGarantia, Activo = @Activo, ActualizadoEn = SYSUTCDATETIME()
            WHERE IDProducto = @IDProducto;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDProducto AS IDProducto;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- @AtributosJson: [1,5,9] con los IDValorAtributo de la variante. Reemplaza los anteriores.
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarVariante
    @IDUsuarioActor INT, @IDVariante INT = NULL, @IDProducto INT, @SKU VARCHAR(40), @Precio DECIMAL(18,2) = NULL,
    @PesoGramos INT = NULL, @Activo BIT = 1, @AtributosJson NVARCHAR(MAX) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        IF @AtributosJson IS NOT NULL AND ISJSON(@AtributosJson) = 0 EXEC Interno.SP_Error_Lanzar 51006, N'Atributos invalidos.';
        IF @Precio IS NOT NULL AND @Precio < 0 EXEC Interno.SP_Error_Lanzar 51102;
        IF @IDVariante IS NULL AND @Precio IS NULL EXEC Interno.SP_Error_Lanzar 51102;
        BEGIN TRAN;
        IF @IDVariante IS NULL
        BEGIN
            INSERT Catalogo.Variante (IDProducto, SKU, PesoGramos, Activo) VALUES (@IDProducto, @SKU, @PesoGramos, @Activo);
            SET @IDVariante = SCOPE_IDENTITY();
            INSERT Catalogo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario) VALUES (@IDVariante, @Precio, SYSUTCDATETIME(), @IDUsuarioActor);
        END
        ELSE
        BEGIN
            UPDATE Catalogo.Variante SET SKU = @SKU, PesoGramos = @PesoGramos, Activo = @Activo
            WHERE IDVariante = @IDVariante AND IDProducto = @IDProducto;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        IF @AtributosJson IS NOT NULL
        BEGIN
            DELETE Catalogo.VarianteValorAtributo WHERE IDVariante = @IDVariante;
            INSERT Catalogo.VarianteValorAtributo (IDVariante, IDValorAtributo)
            SELECT DISTINCT @IDVariante, CAST([value] AS INT) FROM OPENJSON(@AtributosJson);
        END;
        COMMIT;
        SELECT @IDVariante AS IDVariante;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51101;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- RF-02: el pedido guarda su propio precio, asi que cambiarlo aqui no altera pedidos pasados.
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_CambiarPrecio @IDUsuarioActor INT, @IDVariante INT, @Precio DECIMAL(18,2)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PRECIOS_GESTIONAR';
        IF @Precio IS NULL OR @Precio < 0 EXEC Interno.SP_Error_Lanzar 51102;
        DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME(), @Actual DECIMAL(18,2);
        BEGIN TRAN;
        SELECT @Actual = Precio FROM Catalogo.PrecioVariante WITH (UPDLOCK, HOLDLOCK) WHERE IDVariante = @IDVariante AND VigenteHasta IS NULL;
        IF @Actual IS NULL EXEC Interno.SP_Error_Lanzar 51007;
        IF @Actual <> @Precio
        BEGIN
            UPDATE Catalogo.PrecioVariante SET VigenteHasta = @Ahora WHERE IDVariante = @IDVariante AND VigenteHasta IS NULL;
            INSERT Catalogo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario) VALUES (@IDVariante, @Precio, @Ahora, @IDUsuarioActor);
        END;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_HistorialPrecios @IDUsuarioActor INT, @IDVariante INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PRECIOS_GESTIONAR';
    SELECT p.IDPrecioVariante, p.Precio, p.VigenteDesde, p.VigenteHasta, u.Correo AS CorreoUsuario
    FROM Catalogo.PrecioVariante p JOIN Seguridad.Usuario u ON u.IDUsuario = p.IDUsuario
    WHERE p.IDVariante = @IDVariante ORDER BY p.VigenteDesde DESC;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarImagen
    @IDUsuarioActor INT, @IDProducto INT, @IDVariante INT = NULL, @Url NVARCHAR(500), @TextoAlt NVARCHAR(200) = NULL, @Orden SMALLINT = 0
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        INSERT Catalogo.ImagenProducto (IDProducto, IDVariante, Url, TextoAlt, Orden) VALUES (@IDProducto, @IDVariante, @Url, @TextoAlt, @Orden);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS IDImagenProducto;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_EliminarImagen @IDUsuarioActor INT, @IDImagenProducto INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
    DELETE Catalogo.ImagenProducto WHERE IDImagenProducto = @IDImagenProducto;
    IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
END;
GO
-- RF-02: nunca hay borrado fisico. Toda variante tiene historial de precios y bitacora, que son
-- inmutables, asi que la baja es logica con o sin ventas. Sale de la tienda y de los carritos.
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_EliminarProducto @IDUsuarioActor INT, @IDProducto INT
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        BEGIN TRAN;
        IF NOT EXISTS (SELECT 1 FROM Catalogo.Producto WITH (UPDLOCK) WHERE IDProducto = @IDProducto) EXEC Interno.SP_Error_Lanzar 51007;
        UPDATE Catalogo.Producto SET Activo = 0, ActualizadoEn = SYSUTCDATETIME() WHERE IDProducto = @IDProducto;
        UPDATE Catalogo.Variante SET Activo = 0 WHERE IDProducto = @IDProducto AND Activo = 1;
        DELETE Ventas.CarritoDetalle WHERE IDVariante IN (SELECT IDVariante FROM Catalogo.Variante WHERE IDProducto = @IDProducto);
        COMMIT;
        SELECT 'DESACTIVADO' AS Resultado;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_BuscarProductos
    @Texto NVARCHAR(100) = NULL, @IDCategoria INT = NULL, @IDMarca INT = NULL, @PrecioMinimo DECIMAL(18,2) = NULL, @PrecioMaximo DECIMAL(18,2) = NULL,
    @SoloDisponibles BIT = 0, @SoloEnOferta BIT = 0, @Orden VARCHAR(20) = 'RECIENTES', @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    IF @Pagina < 1 SET @Pagina = 1;
    IF @TamanoPagina NOT BETWEEN 1 AND 100 SET @TamanoPagina = 20;
    -- Los comodines que escribe el usuario se buscan como texto literal.
    DECLARE @Patron NVARCHAR(320) = N'%' + REPLACE(REPLACE(REPLACE(@Texto, N'[', N'[[]'), N'%', N'[%]'), N'_', N'[_]') + N'%';

    WITH Base AS (
        SELECT p.IDProducto, p.Nombre, p.Slug, p.IDCategoria, c.Nombre AS Categoria, m.Nombre AS Marca, p.CreadoEn,
               r.PrecioDesde, r.PrecioListaDesde, r.Disponible, r.TienePromocion
        FROM Catalogo.Producto p
        JOIN Catalogo.Categoria c ON c.IDCategoria = p.IDCategoria
        LEFT JOIN Catalogo.Marca m ON m.IDMarca = p.IDMarca
        CROSS APPLY (
            SELECT MIN(pv.PrecioFinal) AS PrecioDesde, MIN(pv.PrecioLista) AS PrecioListaDesde, SUM(d.Disponible) AS Disponible,
                   MAX(CASE WHEN pv.IDPromocion IS NULL THEN 0 ELSE 1 END) AS TienePromocion
            FROM Catalogo.Variante v
            CROSS APPLY Interno.FU_Catalogo_PrecioVigente(v.IDVariante, @Ahora) pv
            CROSS APPLY Interno.FU_Inventario_Disponible(v.IDVariante, NULL) d
            WHERE v.IDProducto = p.IDProducto AND v.Activo = 1
        ) r
        WHERE p.Activo = 1 AND c.Activo = 1 AND r.PrecioDesde IS NOT NULL
          AND (@Texto IS NULL OR p.Nombre LIKE @Patron OR m.Nombre LIKE @Patron OR p.Descripcion LIKE @Patron)
          AND (@IDCategoria IS NULL OR p.IDCategoria IN (SELECT IDCategoria FROM Interno.FU_Catalogo_Descendientes(@IDCategoria)))
          AND (@IDMarca IS NULL OR p.IDMarca = @IDMarca)
    )
    SELECT b.IDProducto, b.Nombre, b.Slug, b.IDCategoria, b.Categoria, b.Marca, b.PrecioDesde, b.PrecioListaDesde, b.Disponible,
           i.Url AS ImagenUrl, COUNT(*) OVER () AS TotalRegistros
    FROM Base b
    OUTER APPLY (SELECT TOP (1) x.Url FROM Catalogo.ImagenProducto x WHERE x.IDProducto = b.IDProducto ORDER BY x.Orden) i
    WHERE (@PrecioMinimo IS NULL OR b.PrecioDesde >= @PrecioMinimo)
      AND (@PrecioMaximo IS NULL OR b.PrecioDesde <= @PrecioMaximo)
      AND (@SoloDisponibles = 0 OR b.Disponible > 0)
      AND (@SoloEnOferta = 0 OR b.TienePromocion = 1)
    ORDER BY CASE WHEN @Orden = 'PRECIO_ASC' THEN b.PrecioDesde END ASC,
             CASE WHEN @Orden = 'PRECIO_DESC' THEN b.PrecioDesde END DESC,
             CASE WHEN @Orden = 'NOMBRE' THEN b.Nombre END ASC,
             b.CreadoEn DESC, b.IDProducto DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_ObtenerProducto @IDProducto INT = NULL, @Slug VARCHAR(220) = NULL
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    SELECT @IDProducto = IDProducto FROM Catalogo.Producto
    WHERE Activo = 1 AND ((@IDProducto IS NOT NULL AND IDProducto = @IDProducto) OR (@IDProducto IS NULL AND Slug = @Slug));
    IF NOT EXISTS (SELECT 1 FROM Catalogo.Producto WHERE IDProducto = @IDProducto AND Activo = 1) EXEC Interno.SP_Error_Lanzar 51007;

    SELECT p.IDProducto, p.Nombre, p.Slug, p.Descripcion, p.MesesGarantia, p.IDCategoria, c.Nombre AS Categoria, p.IDMarca, m.Nombre AS Marca
    FROM Catalogo.Producto p JOIN Catalogo.Categoria c ON c.IDCategoria = p.IDCategoria
    LEFT JOIN Catalogo.Marca m ON m.IDMarca = p.IDMarca WHERE p.IDProducto = @IDProducto;

    SELECT v.IDVariante, v.SKU, pv.PrecioLista, pv.DescuentoUnitario, pv.PrecioFinal, d.Disponible,
           (SELECT a.Nombre AS Atributo, va.Valor FROM Catalogo.VarianteValorAtributo x
            JOIN Catalogo.ValorAtributo va ON va.IDValorAtributo = x.IDValorAtributo
            JOIN Catalogo.Atributo a ON a.IDAtributo = va.IDAtributo
            WHERE x.IDVariante = v.IDVariante FOR JSON PATH) AS AtributosJson
    FROM Catalogo.Variante v
    CROSS APPLY Interno.FU_Catalogo_PrecioVigente(v.IDVariante, @Ahora) pv
    CROSS APPLY Interno.FU_Inventario_Disponible(v.IDVariante, NULL) d
    WHERE v.IDProducto = @IDProducto AND v.Activo = 1 ORDER BY v.IDVariante;

    SELECT IDImagenProducto, IDVariante, Url, TextoAlt, Orden FROM Catalogo.ImagenProducto WHERE IDProducto = @IDProducto ORDER BY Orden;

    SELECT a.Nombre AS Atributo, va.Valor
    FROM Catalogo.EspecificacionProducto e
    JOIN Catalogo.ValorAtributo va ON va.IDValorAtributo = e.IDValorAtributo
    JOIN Catalogo.Atributo a ON a.IDAtributo = va.IDAtributo
    WHERE e.IDProducto = @IDProducto ORDER BY a.Nombre;
END;
GO
/* ---------- Inventario ---------- */
CREATE OR ALTER PROCEDURE Api.SP_Inventario_RegistrarEntrada
    @IDUsuarioActor INT, @IDVariante INT, @IDBodega INT, @Cantidad INT, @CostoUnitario DECIMAL(18,4), @Motivo NVARCHAR(300) = NULL, @ReferenciaDocumento NVARCHAR(60) = NULL
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
        BEGIN TRAN;
        EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodega, 'ENTRADA_COMPRA', @Cantidad, @Motivo, @IDUsuarioActor,
             @CostoUnitario = @CostoUnitario, @ReferenciaDocumento = @ReferenciaDocumento;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- @Cantidad con signo. Exige motivo y no puede dejar la existencia en negativo.
CREATE OR ALTER PROCEDURE Api.SP_Inventario_AjustarExistencia
    @IDUsuarioActor INT, @IDVariante INT, @IDBodega INT, @Cantidad INT, @Motivo NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
        IF @Cantidad = 0 EXEC Interno.SP_Error_Lanzar 51006, N'La cantidad no puede ser cero.';
        DECLARE @Tipo VARCHAR(30) = CASE WHEN @Cantidad > 0 THEN 'AJUSTE_ENTRADA' ELSE 'AJUSTE_SALIDA' END, @Absoluta INT = ABS(@Cantidad);
        BEGIN TRAN;
        EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodega, @Tipo, @Absoluta, @Motivo, @IDUsuarioActor;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- Las dos patas comparten IDGrupoMovimiento. El SELECT inicial toma ambos bloqueos en orden de
-- llave, asi dos traslados opuestos (A->B y B->A) no se cruzan en un deadlock.
CREATE OR ALTER PROCEDURE Api.SP_Inventario_TrasladarExistencia
    @IDUsuarioActor INT, @IDVariante INT, @IDBodegaOrigen INT, @IDBodegaDestino INT, @Cantidad INT, @Motivo NVARCHAR(300)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor, @Motivo;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
        IF @IDBodegaOrigen = @IDBodegaDestino EXEC Interno.SP_Error_Lanzar 51006, N'Las bodegas deben ser distintas.';
        DECLARE @Grupo UNIQUEIDENTIFIER = NEWID(), @Costo DECIMAL(18,4);
        BEGIN TRAN;
        SELECT @Costo = CostoPromedio FROM Inventario.Existencia WITH (UPDLOCK, ROWLOCK)
        WHERE IDVariante = @IDVariante AND IDBodega IN (@IDBodegaOrigen, @IDBodegaDestino) ORDER BY CASE WHEN IDBodega = @IDBodegaOrigen THEN 1 ELSE 0 END;
        EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodegaOrigen, 'TRASLADO_SALIDA', @Cantidad, @Motivo, @IDUsuarioActor, @IDGrupoMovimiento = @Grupo;
        EXEC Interno.SP_Inventario_RegistrarMovimiento @IDVariante, @IDBodegaDestino, 'TRASLADO_ENTRADA', @Cantidad, @Motivo, @IDUsuarioActor, @CostoUnitario = @Costo, @IDGrupoMovimiento = @Grupo;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_ConsultarExistencia
    @IDUsuarioActor INT, @Texto NVARCHAR(100) = NULL, @IDBodega INT = NULL, @SoloBajoMinimo BIT = 0, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
    SELECT IDVariante, SKU, IDProducto, NombreProducto, IDBodega, CodigoBodega, NombreBodega, Fisica, Reservada, Disponible, StockMinimo, CostoPromedio,
           COUNT(*) OVER () AS TotalRegistros
    FROM Interno.VW_Inventario_ExistenciaDisponible
    WHERE (@IDBodega IS NULL OR IDBodega = @IDBodega)
      AND (@SoloBajoMinimo = 0 OR Disponible <= StockMinimo)
      AND (@Texto IS NULL OR SKU LIKE @Texto + N'%' OR NombreProducto LIKE N'%' + @Texto + N'%')
    ORDER BY NombreProducto, SKU, IDBodega
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_ConsultarKardex
    @IDUsuarioActor INT, @IDVariante INT = NULL, @IDBodega INT = NULL, @Desde DATETIME2(3) = NULL, @Hasta DATETIME2(3) = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
    SELECT k.IDKardex, k.Fecha, v.SKU, k.IDBodega, b.Codigo AS Bodega, t.Codigo AS TipoMovimiento, k.Cantidad, k.SaldoAnterior, k.SaldoNuevo,
           k.CostoUnitario, k.Motivo, k.ReferenciaDocumento, u.Correo AS CorreoUsuario, COUNT(*) OVER () AS TotalRegistros
    FROM Inventario.Kardex k
    JOIN Catalogo.Variante v ON v.IDVariante = k.IDVariante
    JOIN Inventario.Bodega b ON b.IDBodega = k.IDBodega
    JOIN Inventario.TipoMovimiento t ON t.IDTipoMovimiento = k.IDTipoMovimiento
    JOIN Seguridad.Usuario u ON u.IDUsuario = k.IDUsuario
    WHERE (@IDVariante IS NULL OR k.IDVariante = @IDVariante) AND (@IDBodega IS NULL OR k.IDBodega = @IDBodega)
      AND (@Desde IS NULL OR k.Fecha >= @Desde) AND (@Hasta IS NULL OR k.Fecha < @Hasta)
    ORDER BY k.IDKardex DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_ConciliarKardex @IDUsuarioActor INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'INVENTARIO_GESTIONAR';
    SELECT IDVariante, IDBodega, Fisica, SumaKardex FROM Interno.VW_Inventario_ConciliacionKardex;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_ListarBodegas
AS
BEGIN
    SET NOCOUNT ON;
    SELECT b.IDBodega, b.Codigo, b.Nombre, b.PermiteVentaEnLinea, b.Prioridad, b.Activo, s.IDSucursal, s.Nombre AS Sucursal
    FROM Inventario.Bodega b LEFT JOIN Inventario.Sucursal s ON s.IDSucursal = b.IDSucursal ORDER BY b.Prioridad, b.Nombre;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_ListarSucursales @SoloRecoger BIT = 0, @IDVariante INT = NULL
AS
BEGIN
    SET NOCOUNT ON;
    SELECT s.IDSucursal, s.Codigo, s.Nombre, s.Direccion, s.Telefono, s.Horario, s.PermiteRecoger, m.Nombre AS Municipio, d.Nombre AS Departamento,
           CASE WHEN @IDVariante IS NULL THEN NULL ELSE x.Disponible END AS Disponible
    FROM Inventario.Sucursal s
    JOIN Clientes.Municipio m ON m.IDMunicipio = s.IDMunicipio
    JOIN Clientes.Departamento d ON d.IDDepartamento = m.IDDepartamento
    CROSS APPLY Interno.FU_Inventario_Disponible(@IDVariante, s.IDSucursal) x
    WHERE s.Activo = 1 AND (@SoloRecoger = 0 OR s.PermiteRecoger = 1)
    ORDER BY d.Nombre, s.Nombre;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_GuardarSucursal
    @IDUsuarioActor INT, @IDSucursal INT = NULL, @Codigo VARCHAR(20), @Nombre NVARCHAR(120), @IDMunicipio INT, @Direccion NVARCHAR(250),
    @Telefono VARCHAR(20) = NULL, @Horario NVARCHAR(200) = NULL, @PermiteRecoger BIT = 1, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CONFIG_GESTIONAR';
        IF @IDSucursal IS NULL
        BEGIN
            INSERT Inventario.Sucursal (Codigo, Nombre, IDMunicipio, Direccion, Telefono, Horario, PermiteRecoger, Activo)
            VALUES (@Codigo, @Nombre, @IDMunicipio, @Direccion, @Telefono, @Horario, @PermiteRecoger, @Activo);
            SET @IDSucursal = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Inventario.Sucursal SET Codigo = @Codigo, Nombre = @Nombre, IDMunicipio = @IDMunicipio, Direccion = @Direccion,
                Telefono = @Telefono, Horario = @Horario, PermiteRecoger = @PermiteRecoger, Activo = @Activo WHERE IDSucursal = @IDSucursal;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDSucursal AS IDSucursal;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Inventario_GuardarBodega
    @IDUsuarioActor INT, @IDBodega INT = NULL, @IDSucursal INT = NULL, @Codigo VARCHAR(20), @Nombre NVARCHAR(120),
    @PermiteVentaEnLinea BIT = 1, @Prioridad SMALLINT = 100, @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CONFIG_GESTIONAR';
        IF @IDBodega IS NULL
        BEGIN
            INSERT Inventario.Bodega (IDSucursal, Codigo, Nombre, PermiteVentaEnLinea, Prioridad, Activo)
            VALUES (@IDSucursal, @Codigo, @Nombre, @PermiteVentaEnLinea, @Prioridad, @Activo);
            SET @IDBodega = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Inventario.Bodega SET IDSucursal = @IDSucursal, Codigo = @Codigo, Nombre = @Nombre, PermiteVentaEnLinea = @PermiteVentaEnLinea,
                Prioridad = @Prioridad, Activo = @Activo WHERE IDBodega = @IDBodega;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDBodega AS IDBodega;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
