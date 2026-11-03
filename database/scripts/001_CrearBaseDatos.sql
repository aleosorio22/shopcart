/* 001 - Base de datos y opciones de concurrencia.
   Modern_Spanish_100_CI_AI: busquedas sin distinguir mayusculas ni acentos.
   READ_COMMITTED_SNAPSHOT: los lectores no bloquean a los escritores (catalogo y reportes
   no compiten con el checkout). Las lecturas que deciden se protegen con UPDLOCK. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
IF DB_ID(N'ShopCart') IS NULL
    CREATE DATABASE ShopCart COLLATE Modern_Spanish_100_CI_AI;
GO
ALTER DATABASE ShopCart SET READ_COMMITTED_SNAPSHOT ON WITH ROLLBACK IMMEDIATE;
ALTER DATABASE ShopCart SET ALLOW_SNAPSHOT_ISOLATION ON;
ALTER DATABASE ShopCart SET RECOVERY FULL;
ALTER DATABASE ShopCart SET PAGE_VERIFY CHECKSUM;
ALTER DATABASE ShopCart SET AUTO_UPDATE_STATISTICS_ASYNC ON;
ALTER DATABASE ShopCart SET QUERY_STORE = ON;
GO
USE ShopCart;
GO
/* Todos los esquemas pertenecen a dbo: el encadenamiento de propiedad permite que un SP
   de Api lea tablas sobre las que el rol de la aplicacion no tiene ningun permiso. */
IF SCHEMA_ID(N'Config')    IS NULL EXEC (N'CREATE SCHEMA Config AUTHORIZATION dbo');
IF SCHEMA_ID(N'Seguridad') IS NULL EXEC (N'CREATE SCHEMA Seguridad AUTHORIZATION dbo');
IF SCHEMA_ID(N'Clientes')  IS NULL EXEC (N'CREATE SCHEMA Clientes AUTHORIZATION dbo');
IF SCHEMA_ID(N'Catalogo')  IS NULL EXEC (N'CREATE SCHEMA Catalogo AUTHORIZATION dbo');
IF SCHEMA_ID(N'Inventario') IS NULL EXEC (N'CREATE SCHEMA Inventario AUTHORIZATION dbo');
IF SCHEMA_ID(N'Ventas')    IS NULL EXEC (N'CREATE SCHEMA Ventas AUTHORIZATION dbo');
IF SCHEMA_ID(N'Marketing') IS NULL EXEC (N'CREATE SCHEMA Marketing AUTHORIZATION dbo');
IF SCHEMA_ID(N'Auditoria') IS NULL EXEC (N'CREATE SCHEMA Auditoria AUTHORIZATION dbo');
IF SCHEMA_ID(N'Api')       IS NULL EXEC (N'CREATE SCHEMA Api AUTHORIZATION dbo');
IF SCHEMA_ID(N'Interno')   IS NULL EXEC (N'CREATE SCHEMA Interno AUTHORIZATION dbo');
IF SCHEMA_ID(N'Job')       IS NULL EXEC (N'CREATE SCHEMA Job AUTHORIZATION dbo');
GO
IF OBJECT_ID(N'Config.VersionEsquema') IS NULL
    CREATE TABLE Config.VersionEsquema (
        Script      NVARCHAR(200) NOT NULL CONSTRAINT PK_VersionEsquema PRIMARY KEY,
        AplicadoEn  DATETIME2(3)  NOT NULL CONSTRAINT DF_VersionEsquema_AplicadoEn DEFAULT SYSUTCDATETIME()
    );
GO
