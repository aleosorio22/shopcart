/* 016 - Procedimientos que el backend necesita ademas de los de 008 a 012. Solo agrega objetos. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
-- Cambiar la contrasena cierra todas las sesiones abiertas.
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_CambiarContrasena @IDUsuario INT, @HashContrasena VARCHAR(255)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuario;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuario;
        BEGIN TRAN;
        UPDATE Seguridad.Usuario SET HashContrasena = @HashContrasena, ActualizadoEn = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario;
        UPDATE Seguridad.TokenRefresco SET RevocadoEn = SYSUTCDATETIME() WHERE IDUsuario = @IDUsuario AND RevocadoEn IS NULL;
        COMMIT;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Seguridad_ObtenerCredencialesPorId @IDUsuario INT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT u.IDUsuario, u.Correo, u.HashContrasena, u.Activo, u.BloqueadoHasta, r.Codigo AS Rol
    FROM Seguridad.Usuario u JOIN Seguridad.Rol r ON r.IDRol = u.IDRol WHERE u.IDUsuario = @IDUsuario;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Checkout_Obtener @IDUsuario INT, @IDCheckout BIGINT
AS
BEGIN
    SET NOCOUNT ON;
    SELECT c.IDCheckout, c.Subtotal, c.DescuentoCupon, c.CostoEnvio, c.Total, c.Estado, c.ExpiraEn, p.IDPedido
    FROM Ventas.Checkout c LEFT JOIN Ventas.Pedido p ON p.IDCheckout = c.IDCheckout
    WHERE c.IDCheckout = @IDCheckout AND c.IDUsuario = @IDUsuario;
    IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_ListarProductosAdmin
    @IDUsuarioActor INT, @Texto NVARCHAR(100) = NULL, @IDCategoria INT = NULL, @Activo BIT = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
    SELECT p.IDProducto, p.Nombre, p.Slug, p.Activo, p.IDCategoria, c.Nombre AS Categoria, p.IDMarca, m.Nombre AS Marca, p.ActualizadoEn,
           (SELECT COUNT(*) FROM Catalogo.Variante v WHERE v.IDProducto = p.IDProducto) AS Variantes, COUNT(*) OVER () AS TotalRegistros
    FROM Catalogo.Producto p
    JOIN Catalogo.Categoria c ON c.IDCategoria = p.IDCategoria
    LEFT JOIN Catalogo.Marca m ON m.IDMarca = p.IDMarca
    WHERE (@Activo IS NULL OR p.Activo = @Activo) AND (@IDCategoria IS NULL OR p.IDCategoria = @IDCategoria)
      AND (@Texto IS NULL OR p.Nombre LIKE N'%' + @Texto + N'%')
    ORDER BY p.IDProducto DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY
    OPTION (RECOMPILE);
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_ListarAtributos
AS
BEGIN
    SET NOCOUNT ON;
    SELECT a.IDAtributo, a.Nombre AS Atributo, v.IDValorAtributo, v.Valor
    FROM Catalogo.Atributo a JOIN Catalogo.ValorAtributo v ON v.IDAtributo = a.IDAtributo
    ORDER BY a.Nombre, v.Valor;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_ListarReembolsos @IDUsuarioActor INT, @Estado VARCHAR(10) = NULL, @Pagina INT = 1, @TamanoPagina INT = 20
AS
BEGIN
    SET NOCOUNT ON;
    EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PEDIDOS_GESTIONAR';
    SELECT r.IDReembolso, r.IDPedido, p.NumeroPedido, r.IDDevolucion, r.Monto, r.Estado, r.Referencia, r.Fecha, COUNT(*) OVER () AS TotalRegistros
    FROM Ventas.Reembolso r JOIN Ventas.Pedido p ON p.IDPedido = r.IDPedido
    WHERE @Estado IS NULL OR r.Estado = @Estado
    ORDER BY r.IDReembolso DESC
    OFFSET (@Pagina - 1) * @TamanoPagina ROWS FETCH NEXT @TamanoPagina ROWS ONLY;
END;
GO
CREATE OR ALTER PROCEDURE Api.SP_Pedidos_ProcesarReembolso @IDUsuarioActor INT, @IDReembolso BIGINT, @Referencia VARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'PEDIDOS_GESTIONAR';
        UPDATE Ventas.Reembolso SET Estado = 'PROCESADO', Referencia = @Referencia WHERE IDReembolso = @IDReembolso AND Estado = 'PENDIENTE';
        IF @@ROWCOUNT = 0 EXEC Interno.SP_Error_Lanzar 51007;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
