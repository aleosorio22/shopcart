/* 017 - Alta de valores de atributo (un color, una talla o una capacidad nueva) desde el panel. Solo agrega objetos. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
-- Los valores de atributo entran a la bitacora como el resto del catalogo.
CREATE OR ALTER TRIGGER Catalogo.TR_ValorAtributo_Auditoria ON Catalogo.ValorAtributo AFTER INSERT, UPDATE, DELETE AS
BEGIN
    SET NOCOUNT ON;
    IF NOT EXISTS (SELECT 1 FROM inserted) AND NOT EXISTS (SELECT 1 FROM deleted) RETURN;
    INSERT Auditoria.Bitacora (IDUsuario, Modulo, Entidad, IDEntidad, Accion, ValorAnterior, ValorNuevo, DireccionIP)
    SELECT CAST(SESSION_CONTEXT(N'IDUsuario') AS INT), 'CATALOGO', 'ValorAtributo', CAST(COALESCE(i.IDValorAtributo, d.IDValorAtributo) AS VARCHAR(60)),
           CASE WHEN d.IDValorAtributo IS NULL THEN 'CREAR' WHEN i.IDValorAtributo IS NULL THEN 'ELIMINAR' ELSE 'MODIFICAR' END,
           CASE WHEN d.IDValorAtributo IS NULL THEN NULL ELSE (SELECT d.IDAtributo, d.Valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CASE WHEN i.IDValorAtributo IS NULL THEN NULL ELSE (SELECT i.IDAtributo, i.Valor FOR JSON PATH, WITHOUT_ARRAY_WRAPPER) END,
           CAST(SESSION_CONTEXT(N'DireccionIP') AS VARCHAR(45))
    FROM inserted i FULL JOIN deleted d ON d.IDValorAtributo = i.IDValorAtributo;
END;
GO
-- Agrega un valor a un atributo existente. Un valor repetido (sin importar mayusculas) responde VALOR_DUPLICADO.
CREATE OR ALTER PROCEDURE Api.SP_Catalogo_GuardarValorAtributo
    @IDUsuarioActor INT, @IDAtributo INT, @Valor NVARCHAR(100)
AS
BEGIN
    SET NOCOUNT ON; SET XACT_ABORT ON;
    BEGIN TRY
        EXEC Interno.SP_Contexto_Establecer @IDUsuarioActor;
        EXEC Interno.SP_Seguridad_ExigirPermiso @IDUsuarioActor, 'CATALOGO_GESTIONAR';
        SET @Valor = LTRIM(RTRIM(@Valor));
        IF @Valor IS NULL OR @Valor = N'' EXEC Interno.SP_Error_Lanzar 51006;
        IF NOT EXISTS (SELECT 1 FROM Catalogo.Atributo WHERE IDAtributo = @IDAtributo) EXEC Interno.SP_Error_Lanzar 51007;

        INSERT Catalogo.ValorAtributo (IDAtributo, Valor) VALUES (@IDAtributo, @Valor);
        SELECT CAST(SCOPE_IDENTITY() AS INT) AS IDValorAtributo;
    END TRY
    BEGIN CATCH
        IF @@TRANCOUNT > 0 ROLLBACK;
        IF ERROR_NUMBER() IN (2601, 2627) EXEC Interno.SP_Error_Lanzar 51105;
        EXEC Interno.SP_Error_Registrar;
        ;THROW;
    END CATCH
END;
GO
