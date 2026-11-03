/* 013 - Minimo privilegio. La aplicacion solo ejecuta el esquema Api y no toca ninguna tabla.
   Las contrasenas llegan como variables de sqlcmd y nunca se guardan en el repositorio. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE master;
GO
IF SUSER_ID(N'shopcart_api') IS NULL CREATE LOGIN shopcart_api WITH PASSWORD = N'$(API_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = ShopCart;
IF SUSER_ID(N'shopcart_jobs') IS NULL CREATE LOGIN shopcart_jobs WITH PASSWORD = N'$(JOBS_PASSWORD)', CHECK_POLICY = ON, DEFAULT_DATABASE = ShopCart;
GO
USE ShopCart;
GO
IF DATABASE_PRINCIPAL_ID(N'RolApiShopCart') IS NULL CREATE ROLE RolApiShopCart AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID(N'RolJobsShopCart') IS NULL CREATE ROLE RolJobsShopCart AUTHORIZATION dbo;
IF DATABASE_PRINCIPAL_ID(N'RolAuditorShopCart') IS NULL CREATE ROLE RolAuditorShopCart AUTHORIZATION dbo;
GO
GRANT EXECUTE ON SCHEMA::Api TO RolApiShopCart;
GRANT EXECUTE ON SCHEMA::Job TO RolJobsShopCart;
GRANT SELECT ON SCHEMA::Auditoria TO RolAuditorShopCart;

DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Config TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Seguridad TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Clientes TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Catalogo TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Inventario TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Ventas TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Marketing TO RolApiShopCart;
DENY SELECT, INSERT, UPDATE, DELETE ON SCHEMA::Auditoria TO RolApiShopCart;
DENY EXECUTE, SELECT ON SCHEMA::Interno TO RolApiShopCart;
DENY INSERT, UPDATE, DELETE ON SCHEMA::Auditoria TO RolAuditorShopCart;
GO
IF DATABASE_PRINCIPAL_ID(N'shopcart_api') IS NULL CREATE USER shopcart_api FOR LOGIN shopcart_api;
IF DATABASE_PRINCIPAL_ID(N'shopcart_jobs') IS NULL CREATE USER shopcart_jobs FOR LOGIN shopcart_jobs;
ALTER ROLE RolApiShopCart ADD MEMBER shopcart_api;
ALTER ROLE RolJobsShopCart ADD MEMBER shopcart_jobs;
GO
/* Registra todo cambio de estructura, incluido quien intente desactivar un trigger de auditoria.
   Un sysadmin puede saltarse esto: en produccion se complementa con SQL Server Audit. */
CREATE OR ALTER TRIGGER TR_Auditoria_CambioEsquema ON DATABASE FOR DDL_DATABASE_LEVEL_EVENTS AS
BEGIN
    SET NOCOUNT ON;
    SET ARITHABORT ON;
    DECLARE @E XML = EVENTDATA();
    INSERT Auditoria.CambioEsquema (Login, Evento, Objeto, Sentencia)
    VALUES (ORIGINAL_LOGIN(),
            @E.value('(/EVENT_INSTANCE/EventType)[1]', 'NVARCHAR(100)'),
            CONCAT(@E.value('(/EVENT_INSTANCE/SchemaName)[1]', 'NVARCHAR(128)'), N'.', @E.value('(/EVENT_INSTANCE/ObjectName)[1]', 'NVARCHAR(128)')),
            @E.value('(/EVENT_INSTANCE/TSQLCommand/CommandText)[1]', 'NVARCHAR(MAX)'));
END;
GO
