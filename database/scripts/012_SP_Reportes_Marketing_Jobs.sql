/* 012 - RF-08, RF-09, marketing, configuracion y tareas programadas. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
-- @Agrupacion: DIA, SEMANA (inicia lunes) o MES.
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_VentasPorPeriodo @IDUsuarioActor INT, @Desde DATE, @Hasta DATE, @Agrupacion VARCHAR(10) = 'DIA'
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    IF @Agrupacion NOT IN ('DIA', 'SEMANA', 'MES') EXEC Interno.SP_Error_Lanzar 51006, N'Agrupacion invalida.';
    SELECT p.Periodo, SUM(v.NumeroPedidos) AS NumeroPedidos, SUM(v.MontoNeto) AS MontoNeto
    FROM Interno.VW_Dashboard_VentasPorDia v
    -- 1900-01-01 fue lunes: el modulo no depende de SET DATEFIRST.
    CROSS APPLY (SELECT CASE @Agrupacion
                          WHEN 'DIA' THEN v.FechaLocal
                          WHEN 'SEMANA' THEN DATEADD(DAY, -(DATEDIFF(DAY, CAST('19000101' AS DATE), v.FechaLocal) % 7), v.FechaLocal)
                          ELSE DATEFROMPARTS(YEAR(v.FechaLocal), MONTH(v.FechaLocal), 1) END AS Periodo) p
    WHERE v.FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY p.Periodo
    ORDER BY p.Periodo;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_VentasPorCategoria @IDUsuarioActor INT, @Desde DATE, @Hasta DATE
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    SELECT IDCategoria, Categoria, SUM(Unidades) AS Unidades, SUM(MontoNeto) AS MontoNeto
    FROM Interno.VW_Dashboard_VentasPorCategoria
    WHERE FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY IDCategoria, Categoria
    ORDER BY MontoNeto DESC;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_TopProductos @IDUsuarioActor INT, @Desde DATE, @Hasta DATE, @Limite INT = 10
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    SELECT TOP (@Limite) l.IDProducto, p.Nombre, SUM(l.CantidadNeta) AS Unidades, SUM(l.MontoNeto) AS MontoNeto
    FROM Interno.VW_Reportes_VentaNetaLinea l JOIN Catalogo.Producto p ON p.IDProducto = l.IDProducto
    WHERE l.FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY l.IDProducto, p.Nombre
    HAVING SUM(l.CantidadNeta) > 0
    ORDER BY Unidades DESC, MontoNeto DESC;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_Resumen @IDUsuarioActor INT, @Desde DATE, @Hasta DATE
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    DECLARE @Pedidos BIGINT, @Monto DECIMAL(18,2);
    SELECT @Pedidos = ISNULL(SUM(NumeroPedidos), 0), @Monto = ISNULL(SUM(MontoNeto), 0)
    FROM Interno.VW_Dashboard_VentasPorDia WHERE FechaLocal BETWEEN @Desde AND @Hasta;
    SELECT @Pedidos AS NumeroPedidos, @Monto AS MontoNeto,
           CAST(CASE WHEN @Pedidos = 0 THEN 0 ELSE @Monto / @Pedidos END AS DECIMAL(18,2)) AS TicketPromedio,
           (SELECT COUNT(*) FROM Interno.VW_Carrito_Abandonado) AS CarritosAbandonados,
           (SELECT COUNT(*) FROM Interno.VW_Inventario_ExistenciaDisponible WHERE Disponible <= StockMinimo) AS VariantesBajoMinimo;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_CarritosAbandonados @IDUsuarioActor INT, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    SELECT IDCarrito, IDUsuario, Correo, UltimaActividad, MinutosInactivo, Lineas, Unidades, COUNT(*) OVER () AS TotalRegistros
    FROM Interno.VW_Carrito_Abandonado
    ORDER BY UltimaActividad DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
-- Extra: rentabilidad real con el costo congelado en cada venta.
CREATE OR ALTER PROCEDURE Api.SP_Dashboard_MargenPorProducto @IDUsuarioActor INT, @Desde DATE, @Hasta DATE, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'REPORTES_VER';
    SELECT l.IDProducto, p.Nombre, SUM(l.CantidadNeta) AS Unidades, SUM(l.MontoNeto) AS Venta, SUM(l.CostoNeto) AS Costo,
           SUM(l.MontoNeto) - SUM(l.CostoNeto) AS MargenBruto, COUNT(*) OVER () AS TotalRegistros
    FROM Interno.VW_Reportes_VentaNetaLinea l JOIN Catalogo.Producto p ON p.IDProducto = l.IDProducto
    WHERE l.FechaLocal BETWEEN @Desde AND @Hasta
    GROUP BY l.IDProducto, p.Nombre
    ORDER BY MargenBruto DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Bitacora_Consultar
    @IDUsuarioActor INT, @Modulo VARCHAR(30) = NULL, @Entidad VARCHAR(60) = NULL, @IDEntidad VARCHAR(60) = NULL,
    @Desde DATETIME2(3) = NULL, @Hasta DATETIME2(3) = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'BITACORA_VER';
    SELECT b.IDBitacora, b.Fecha, b.IDUsuario, u.Correo AS CorreoUsuario, b.Modulo, b.Entidad, b.IDEntidad, b.Accion, b.ValorAnterior, b.ValorNuevo, b.DireccionIP,
           COUNT(*) OVER () AS TotalRegistros
    FROM Auditoria.Bitacora b LEFT JOIN Seguridad.Usuario u ON u.IDUsuario = b.IDUsuario
    WHERE (@Modulo IS NULL OR b.Modulo = @Modulo) AND (@Entidad IS NULL OR b.Entidad = @Entidad) AND (@IDEntidad IS NULL OR b.IDEntidad = @IDEntidad)
      AND (@Desde IS NULL OR b.Fecha >= @Desde) AND (@Hasta IS NULL OR b.Fecha < @Hasta)
    ORDER BY b.IDBitacora DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
/* ---------- Marketing ---------- */
-- @AlcanceJson: [{"IDCategoria":1},{"IDMarca":2},{"IDProducto":3},{"IDVariante":4}]. Reemplaza el alcance.
CREATE OR ALTER PROCEDURE Api.SP_Marketing_GuardarPromocion
    @IDUsuarioActor INT, @IDPromocion INT = NULL, @Nombre NVARCHAR(120), @Slug VARCHAR(140), @TipoDescuento VARCHAR(10), @Valor DECIMAL(18,2),
    @VigenteDesde DATETIME2(3), @VigenteHasta DATETIME2(3), @Activo BIT = 1, @AlcanceJson NVARCHAR(MAX)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'MARKETING_GESTIONAR';
        IF ISJSON(@AlcanceJson) = 0 EXEC Interno.SP_Error_Lanzar 51006, N'Alcance invalido.';
        BEGIN TRAN;
        IF @IDPromocion IS NULL
        BEGIN
            INSERT Marketing.Promocion (Nombre, Slug, TipoDescuento, Valor, VigenteDesde, VigenteHasta, Activo)
            VALUES (@Nombre, @Slug, @TipoDescuento, @Valor, @VigenteDesde, @VigenteHasta, @Activo);
            SET @IDPromocion = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Marketing.Promocion SET Nombre = @Nombre, Slug = @Slug, TipoDescuento = @TipoDescuento, Valor = @Valor,
                VigenteDesde = @VigenteDesde, VigenteHasta = @VigenteHasta, Activo = @Activo WHERE IDPromocion = @IDPromocion;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
            DELETE Marketing.PromocionAlcance WHERE IDPromocion = @IDPromocion;
        END;
        INSERT Marketing.PromocionAlcance (IDPromocion, IDCategoria, IDMarca, IDProducto, IDVariante)
        SELECT @IDPromocion, IDCategoria, IDMarca, IDProducto, IDVariante
        FROM OPENJSON(@AlcanceJson) WITH (IDCategoria INT, IDMarca INT, IDProducto INT, IDVariante INT);
        COMMIT;
        SELECT @IDPromocion AS IDPromocion;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        IF ERROR_NUMBER() = 547 EXEC Interno.SP_Error_Lanzar 51006, N'Revise valor, vigencia y alcance de la promocion.';
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Marketing_ListarPromociones @IDUsuarioActor INT, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'MARKETING_GESTIONAR';
    SELECT p.IDPromocion, p.Nombre, p.Slug, p.TipoDescuento, p.Valor, p.VigenteDesde, p.VigenteHasta, p.Activo,
           (SELECT a.IDCategoria, a.IDMarca, a.IDProducto, a.IDVariante FROM Marketing.PromocionAlcance a WHERE a.IDPromocion = p.IDPromocion FOR JSON PATH) AS AlcanceJson,
           COUNT(*) OVER () AS TotalRegistros
    FROM Marketing.Promocion p
    ORDER BY p.IDPromocion DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Marketing_GuardarAnuncio
    @IDUsuarioActor INT, @IDAnuncio INT = NULL, @CodigoZona VARCHAR(40), @IDPromocion INT = NULL, @Titulo NVARCHAR(120), @Subtitulo NVARCHAR(200) = NULL,
    @ImagenEscritorioUrl NVARCHAR(500), @ImagenMovilUrl NVARCHAR(500) = NULL, @UrlDestino NVARCHAR(500), @Orden SMALLINT = 0,
    @VigenteDesde DATETIME2(3), @VigenteHasta DATETIME2(3), @Activo BIT = 1
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'MARKETING_GESTIONAR';
        DECLARE @IDZona SMALLINT = (SELECT IDZonaAnuncio FROM Marketing.ZonaAnuncio WHERE Codigo = @CodigoZona);
        IF @IDZona IS NULL EXEC Interno.SP_Error_Lanzar 51006, N'Zona invalida.';
        IF @IDAnuncio IS NULL
        BEGIN
            INSERT Marketing.Anuncio (IDZonaAnuncio, IDPromocion, Titulo, Subtitulo, ImagenEscritorioUrl, ImagenMovilUrl, UrlDestino, Orden, VigenteDesde, VigenteHasta, Activo)
            VALUES (@IDZona, @IDPromocion, @Titulo, @Subtitulo, @ImagenEscritorioUrl, @ImagenMovilUrl, @UrlDestino, @Orden, @VigenteDesde, @VigenteHasta, @Activo);
            SET @IDAnuncio = SCOPE_IDENTITY();
        END
        ELSE
        BEGIN
            UPDATE Marketing.Anuncio SET IDZonaAnuncio = @IDZona, IDPromocion = @IDPromocion, Titulo = @Titulo, Subtitulo = @Subtitulo, ImagenEscritorioUrl = @ImagenEscritorioUrl,
                ImagenMovilUrl = @ImagenMovilUrl, UrlDestino = @UrlDestino, Orden = @Orden, VigenteDesde = @VigenteDesde, VigenteHasta = @VigenteHasta, Activo = @Activo
            WHERE IDAnuncio = @IDAnuncio;
            IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
        END;
        SELECT @IDAnuncio AS IDAnuncio;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Marketing_ListarAnuncios @IDUsuarioActor INT, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'MARKETING_GESTIONAR';
    SELECT a.IDAnuncio, z.Codigo AS Zona, a.Titulo, a.UrlDestino, a.Orden, a.VigenteDesde, a.VigenteHasta, a.Activo,
           ISNULL(m.Impresiones, 0) AS Impresiones, ISNULL(m.Clics, 0) AS Clics, COUNT(*) OVER () AS TotalRegistros
    FROM Marketing.Anuncio a
    JOIN Marketing.ZonaAnuncio z ON z.IDZonaAnuncio = a.IDZonaAnuncio
    OUTER APPLY (SELECT SUM(x.Impresiones) AS Impresiones, SUM(x.Clics) AS Clics FROM Marketing.AnuncioMetrica x WHERE x.IDAnuncio = a.IDAnuncio) m
    ORDER BY a.IDAnuncio DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
-- Publico: lo que la tienda muestra ahora en una zona.
CREATE OR ALTER PROCEDURE Api.SP_Marketing_AnunciosVigentes @CodigoZona VARCHAR(40)
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    SELECT TOP (SELECT MaximoVisible FROM Marketing.ZonaAnuncio WHERE Codigo = @CodigoZona)
           a.IDAnuncio, a.Titulo, a.Subtitulo, a.ImagenEscritorioUrl, a.ImagenMovilUrl, a.UrlDestino
    FROM Marketing.Anuncio a JOIN Marketing.ZonaAnuncio z ON z.IDZonaAnuncio = a.IDZonaAnuncio
    WHERE z.Codigo = @CodigoZona AND a.Activo = 1 AND a.VigenteDesde <= @Ahora AND a.VigenteHasta > @Ahora
    ORDER BY a.Orden, a.IDAnuncio DESC;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Marketing_RegistrarEvento @IDAnuncio INT, @Evento VARCHAR(10)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        IF @Evento NOT IN ('IMPRESION', 'CLIC') EXEC Interno.SP_Error_Lanzar 51006, N'Evento invalido.';
        DECLARE @Hoy DATE = CAST(DATEADD(HOUR, -6, SYSUTCDATETIME()) AS DATE);
        DECLARE @I BIGINT = CASE WHEN @Evento = 'IMPRESION' THEN 1 ELSE 0 END, @C BIGINT = CASE WHEN @Evento = 'CLIC' THEN 1 ELSE 0 END;
        BEGIN TRAN;
        UPDATE Marketing.AnuncioMetrica WITH (UPDLOCK, HOLDLOCK) SET Impresiones = Impresiones + @I, Clics = Clics + @C WHERE IDAnuncio = @IDAnuncio AND Fecha = @Hoy;
        IF @@ROWCOUNT = 0 INSERT Marketing.AnuncioMetrica (IDAnuncio, Fecha, Impresiones, Clics) VALUES (@IDAnuncio, @Hoy, @I, @C);
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
/* ---------- Configuracion ---------- */
CREATE OR ALTER PROCEDURE Api.SP_Config_ListarParametros @IDUsuarioActor INT
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CONFIG_GESTIONAR';
    SELECT Clave, Valor, TipoDato, Descripcion, ActualizadoEn FROM Config.Parametro ORDER BY Clave;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Config_GuardarParametro @IDUsuarioActor INT, @Clave VARCHAR(60), @Valor NVARCHAR(200)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CONFIG_GESTIONAR';
        DECLARE @Tipo VARCHAR(10) = (SELECT TipoDato FROM Config.Parametro WHERE Clave = @Clave);
        IF @Tipo IS NULL EXEC Interno.SP_Error_Lanzar 51007;
        IF (@Tipo = 'INT' AND TRY_CAST(@Valor AS INT) IS NULL) OR (@Tipo = 'DECIMAL' AND TRY_CAST(@Valor AS DECIMAL(18,4)) IS NULL) OR (@Tipo = 'BIT' AND @Valor NOT IN (N'0', N'1'))
            EXEC Interno.SP_Error_Lanzar 51006, N'El valor no corresponde al tipo del parametro.';
        UPDATE Config.Parametro SET Valor = @Valor, ActualizadoEn = SYSUTCDATETIME() WHERE Clave = @Clave;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
-- El backend lo usa al arrancar para mapear codigos de error a HTTP.
CREATE OR ALTER PROCEDURE Api.SP_Config_ListarErrores
AS
BEGIN
    SET NOCOUNT ON;
    SELECT Codigo, CodigoNegocio, Mensaje, HttpStatus FROM Config.ErrorNegocio ORDER BY Codigo;
END;
GO
/* ---------- Tareas programadas ----------
   Invocar cada minuto desde SQL Agent o, en Express (sin Agent), desde un cron del backend. */
CREATE OR ALTER PROCEDURE Job.SP_Inventario_LiberarReservasVencidas @Lote INT = 200
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    DECLARE @IDCheckout BIGINT, @Procesados INT = 0, @Ahora DATETIME2(3);
    EXEC Interno.SP_Contexto_Establecer 1;
    WHILE @Procesados < @Lote
    BEGIN
        BEGIN TRY
            SET @IDCheckout = NULL;
            SET @Ahora = SYSUTCDATETIME();
            BEGIN TRAN;
            -- READPAST: un checkout que se esta pagando ahora mismo se salta, no se espera.
            SELECT TOP (1) @IDCheckout = IDCheckout FROM Ventas.Checkout WITH (UPDLOCK, READPAST, ROWLOCK)
            WHERE Estado = 'ACTIVO' AND ExpiraEn <= @Ahora ORDER BY ExpiraEn;
            IF @IDCheckout IS NULL
            BEGIN
                COMMIT;
                BREAK;
            END;
            EXEC Interno.SP_Checkout_Liberar @IDCheckout, 'EXPIRADO';
            COMMIT;
            SET @Procesados += 1;
        END TRY
        BEGIN CATCH
            IF @@TRANCOUNT > 0 ROLLBACK;
            EXEC Interno.SP_Error_Registrar;
            ;THROW;
        END CATCH
    END;
    SELECT @Procesados AS CheckoutsLiberados;
END;
GO
CREATE OR ALTER PROCEDURE Job.SP_Mantenimiento_Limpiar
AS
BEGIN
    SET NOCOUNT ON;
    DECLARE @Ahora DATETIME2(3) = SYSUTCDATETIME();
    DECLARE @Dias INT = (SELECT CAST(Valor AS INT) FROM Config.Parametro WHERE Clave = 'IDEMPOTENCIA_RETENCION_DIAS');
    DELETE TOP (5000) Seguridad.TokenRefresco WHERE ExpiraEn < DATEADD(DAY, -30, @Ahora);
    DELETE TOP (5000) Ventas.SolicitudIdempotente WHERE CreadoEn < DATEADD(DAY, -@Dias, @Ahora);
    DELETE TOP (5000) Ventas.EventoSalida WHERE ProcesadoEn < DATEADD(DAY, -30, @Ahora);
END;
GO
CREATE OR ALTER PROCEDURE Job.SP_Eventos_Leer @Lote INT = 50
AS
BEGIN
    SET NOCOUNT ON;
    SELECT TOP (@Lote) IDEventoSalida, TipoEvento, Contenido, CreadoEn FROM Ventas.EventoSalida WHERE ProcesadoEn IS NULL ORDER BY IDEventoSalida;
END;
GO
CREATE OR ALTER PROCEDURE Job.SP_Eventos_MarcarProcesado @IDEventoSalida BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    UPDATE Ventas.EventoSalida SET ProcesadoEn = SYSUTCDATETIME() WHERE IDEventoSalida = @IDEventoSalida AND ProcesadoEn IS NULL;
END;
GO
