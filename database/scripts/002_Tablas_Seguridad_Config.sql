/* 002 - Configuracion, errores, seguridad, clientes, ubicaciones y auditoria.
   Convencion: fechas en UTC con DATETIME2(3). Montos DECIMAL(18,2). */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
CREATE TABLE Config.Parametro (
    Clave        VARCHAR(60)   NOT NULL CONSTRAINT PK_Parametro PRIMARY KEY,
    Valor        NVARCHAR(200) NOT NULL,
    TipoDato     VARCHAR(10)   NOT NULL CONSTRAINT CK_Parametro_TipoDato CHECK (TipoDato IN ('INT','DECIMAL','TEXTO','BIT')),
    Descripcion  NVARCHAR(300) NOT NULL,
    ActualizadoEn DATETIME2(3) NOT NULL CONSTRAINT DF_Parametro_ActualizadoEn DEFAULT SYSUTCDATETIME()
);
-- Catalogo de errores de negocio: el backend traduce Codigo -> HttpStatus + CodigoNegocio.
CREATE TABLE Config.ErrorNegocio (
    Codigo        INT           NOT NULL CONSTRAINT PK_ErrorNegocio PRIMARY KEY,
    CodigoNegocio VARCHAR(50)   NOT NULL CONSTRAINT UQ_ErrorNegocio_CodigoNegocio UNIQUE,
    Mensaje       NVARCHAR(300) NOT NULL,
    HttpStatus    SMALLINT      NOT NULL CONSTRAINT CK_ErrorNegocio_HttpStatus CHECK (HttpStatus BETWEEN 400 AND 599),
    CONSTRAINT CK_ErrorNegocio_Codigo CHECK (Codigo BETWEEN 51000 AND 59999)
);
GO
/* ---------- Seguridad ---------- */
CREATE TABLE Seguridad.Rol (
    IDRol       SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Rol PRIMARY KEY,
    Codigo      VARCHAR(30)  NOT NULL CONSTRAINT UQ_Rol_Codigo UNIQUE,
    Nombre      NVARCHAR(60) NOT NULL
);
CREATE TABLE Seguridad.Permiso (
    IDPermiso   SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Permiso PRIMARY KEY,
    Codigo      VARCHAR(60)   NOT NULL CONSTRAINT UQ_Permiso_Codigo UNIQUE,
    Descripcion NVARCHAR(200) NOT NULL
);
CREATE TABLE Seguridad.RolPermiso (
    IDRol     SMALLINT NOT NULL CONSTRAINT FK_RolPermiso_Rol REFERENCES Seguridad.Rol(IDRol),
    IDPermiso SMALLINT NOT NULL CONSTRAINT FK_RolPermiso_Permiso REFERENCES Seguridad.Permiso(IDPermiso),
    CONSTRAINT PK_RolPermiso PRIMARY KEY (IDRol, IDPermiso)
);
CREATE TABLE Seguridad.Usuario (
    IDUsuario        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Usuario PRIMARY KEY,
    Correo           NVARCHAR(254) NOT NULL,
    HashContrasena   VARCHAR(255)  NOT NULL,   -- argon2/bcrypt generado en el backend
    Nombres          NVARCHAR(100) NOT NULL,
    Apellidos        NVARCHAR(100) NOT NULL,
    Telefono         VARCHAR(20)   NULL,
    IDRol            SMALLINT      NOT NULL CONSTRAINT FK_Usuario_Rol REFERENCES Seguridad.Rol(IDRol),
    Activo           BIT           NOT NULL CONSTRAINT DF_Usuario_Activo DEFAULT 1,
    IntentosFallidos TINYINT       NOT NULL CONSTRAINT DF_Usuario_Intentos DEFAULT 0,
    BloqueadoHasta   DATETIME2(3)  NULL,
    UltimoAcceso     DATETIME2(3)  NULL,
    CreadoEn         DATETIME2(3)  NOT NULL CONSTRAINT DF_Usuario_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn    DATETIME2(3)  NOT NULL CONSTRAINT DF_Usuario_ActualizadoEn DEFAULT SYSUTCDATETIME(),
    Version          ROWVERSION    NOT NULL,
    CONSTRAINT UQ_Usuario_Correo UNIQUE (Correo),
    CONSTRAINT CK_Usuario_Correo CHECK (Correo LIKE N'%_@_%._%')
);
CREATE INDEX IX_Usuario_Rol ON Seguridad.Usuario (IDRol, Activo);
-- Rotacion: cada token guarda su familia; reutilizar uno ya rotado revoca toda la familia.
-- Solo se guarda el SHA-256 del token, nunca el token.
CREATE TABLE Seguridad.TokenRefresco (
    IDTokenRefresco BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TokenRefresco PRIMARY KEY,
    IDUsuario    INT             NOT NULL CONSTRAINT FK_TokenRefresco_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    HashToken    BINARY(32)      NOT NULL CONSTRAINT UQ_TokenRefresco_Hash UNIQUE,
    Familia      UNIQUEIDENTIFIER NOT NULL,
    ExpiraEn     DATETIME2(3)    NOT NULL,
    RotadoEn     DATETIME2(3)    NULL,
    RevocadoEn   DATETIME2(3)    NULL,
    DireccionIP  VARCHAR(45)     NULL,
    AgenteUsuario NVARCHAR(300)  NULL,
    CreadoEn     DATETIME2(3)    NOT NULL CONSTRAINT DF_TokenRefresco_CreadoEn DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_TokenRefresco_Familia ON Seguridad.TokenRefresco (Familia);
CREATE INDEX IX_TokenRefresco_Usuario ON Seguridad.TokenRefresco (IDUsuario) WHERE RevocadoEn IS NULL;
CREATE INDEX IX_TokenRefresco_Expira ON Seguridad.TokenRefresco (ExpiraEn);
GO
/* ---------- Ubicaciones y clientes ---------- */
CREATE TABLE Clientes.Departamento (
    IDDepartamento SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Departamento PRIMARY KEY,
    Nombre NVARCHAR(60) NOT NULL CONSTRAINT UQ_Departamento_Nombre UNIQUE
);
CREATE TABLE Clientes.Municipio (
    IDMunicipio    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Municipio PRIMARY KEY,
    IDDepartamento SMALLINT NOT NULL CONSTRAINT FK_Municipio_Departamento REFERENCES Clientes.Departamento(IDDepartamento),
    Nombre         NVARCHAR(80) NOT NULL,
    CONSTRAINT UQ_Municipio UNIQUE (IDDepartamento, Nombre)
);
CREATE TABLE Clientes.Direccion (
    IDDireccion   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Direccion PRIMARY KEY,
    IDUsuario     INT           NOT NULL CONSTRAINT FK_Direccion_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    IDMunicipio   INT           NOT NULL CONSTRAINT FK_Direccion_Municipio REFERENCES Clientes.Municipio(IDMunicipio),
    Alias         NVARCHAR(40)  NOT NULL,
    Destinatario  NVARCHAR(150) NOT NULL,
    Telefono      VARCHAR(20)   NOT NULL,
    Linea1        NVARCHAR(200) NOT NULL,
    Linea2        NVARCHAR(200) NULL,
    Referencia    NVARCHAR(300) NULL,
    EsPredeterminada BIT NOT NULL CONSTRAINT DF_Direccion_Predeterminada DEFAULT 0,
    Activo        BIT NOT NULL CONSTRAINT DF_Direccion_Activo DEFAULT 1,
    CreadoEn      DATETIME2(3) NOT NULL CONSTRAINT DF_Direccion_CreadoEn DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Direccion_Usuario ON Clientes.Direccion (IDUsuario, Activo);
CREATE UNIQUE INDEX UX_Direccion_Predeterminada ON Clientes.Direccion (IDUsuario) WHERE EsPredeterminada = 1 AND Activo = 1;
-- Datos de facturacion reutilizables (NIT o CF). Extra para factura electronica FEL.
CREATE TABLE Clientes.DatoFiscal (
    IDDatoFiscal INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DatoFiscal PRIMARY KEY,
    IDUsuario    INT           NOT NULL CONSTRAINT FK_DatoFiscal_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    NIT          VARCHAR(15)   NOT NULL,
    NombreFiscal NVARCHAR(200) NOT NULL,
    Activo       BIT NOT NULL CONSTRAINT DF_DatoFiscal_Activo DEFAULT 1,
    CONSTRAINT UQ_DatoFiscal UNIQUE (IDUsuario, NIT)
);
GO
/* ---------- Auditoria ---------- */
CREATE TABLE Auditoria.Bitacora (
    IDBitacora    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bitacora PRIMARY KEY,
    Fecha         DATETIME2(3)  NOT NULL CONSTRAINT DF_Bitacora_Fecha DEFAULT SYSUTCDATETIME(),
    IDUsuario     INT           NULL CONSTRAINT FK_Bitacora_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    Modulo        VARCHAR(30)   NOT NULL,
    Entidad       VARCHAR(60)   NOT NULL,
    IDEntidad     VARCHAR(60)   NOT NULL,
    Accion        VARCHAR(20)   NOT NULL CONSTRAINT CK_Bitacora_Accion CHECK (Accion IN ('CREAR','MODIFICAR','DESACTIVAR','ELIMINAR')),
    ValorAnterior NVARCHAR(MAX) NULL,
    ValorNuevo    NVARCHAR(MAX) NULL,
    DireccionIP   VARCHAR(45)   NULL,
    CONSTRAINT CK_Bitacora_ValorAnteriorJson CHECK (ValorAnterior IS NULL OR ISJSON(ValorAnterior) = 1),
    CONSTRAINT CK_Bitacora_ValorNuevoJson CHECK (ValorNuevo IS NULL OR ISJSON(ValorNuevo) = 1)
);
CREATE INDEX IX_Bitacora_Modulo ON Auditoria.Bitacora (Modulo, Fecha DESC) INCLUDE (IDUsuario, Entidad, Accion);
CREATE INDEX IX_Bitacora_Entidad ON Auditoria.Bitacora (Entidad, IDEntidad, Fecha DESC);
-- Una FK vacia hacia Bitacora impide TRUNCATE TABLE, que no dispara triggers.
CREATE TABLE Auditoria.ProteccionBitacora (
    IDBitacora BIGINT NOT NULL CONSTRAINT PK_ProteccionBitacora PRIMARY KEY
        CONSTRAINT FK_ProteccionBitacora_Bitacora REFERENCES Auditoria.Bitacora(IDBitacora)
);
CREATE TABLE Auditoria.ErrorBD (
    IDErrorBD    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ErrorBD PRIMARY KEY,
    Fecha        DATETIME2(3)   NOT NULL CONSTRAINT DF_ErrorBD_Fecha DEFAULT SYSUTCDATETIME(),
    IDUsuario    INT            NULL,
    Numero       INT            NOT NULL,
    Severidad    INT            NOT NULL,
    Estado       INT            NOT NULL,
    Procedimiento NVARCHAR(200) NULL,
    Linea        INT            NULL,
    Mensaje      NVARCHAR(4000) NOT NULL
);
CREATE INDEX IX_ErrorBD_Fecha ON Auditoria.ErrorBD (Fecha DESC);
CREATE TABLE Auditoria.CambioEsquema (
    IDCambioEsquema BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CambioEsquema PRIMARY KEY,
    Fecha      DATETIME2(3)  NOT NULL CONSTRAINT DF_CambioEsquema_Fecha DEFAULT SYSUTCDATETIME(),
    Login      NVARCHAR(128) NOT NULL,
    Evento     NVARCHAR(100) NOT NULL,
    Objeto     NVARCHAR(256) NULL,
    Sentencia  NVARCHAR(MAX) NULL
);
GO
