/* 003 - Impuestos, catalogo, sucursales, bodegas, existencia y kardex. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
/* ---------- Impuestos: la tasa vive en datos y con vigencia, no en el codigo ---------- */
CREATE TABLE Catalogo.Impuesto (
    IDImpuesto SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Impuesto PRIMARY KEY,
    Codigo     VARCHAR(20)  NOT NULL CONSTRAINT UQ_Impuesto_Codigo UNIQUE,
    Nombre     NVARCHAR(60) NOT NULL
);
CREATE TABLE Catalogo.TasaImpuesto (
    IDTasaImpuesto INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TasaImpuesto PRIMARY KEY,
    IDImpuesto   SMALLINT     NOT NULL CONSTRAINT FK_TasaImpuesto_Impuesto REFERENCES Catalogo.Impuesto(IDImpuesto),
    Porcentaje   DECIMAL(5,2) NOT NULL CONSTRAINT CK_TasaImpuesto_Porcentaje CHECK (Porcentaje BETWEEN 0 AND 100),
    VigenteDesde DATETIME2(3) NOT NULL,
    VigenteHasta DATETIME2(3) NULL,
    CONSTRAINT UQ_TasaImpuesto UNIQUE (IDImpuesto, VigenteDesde),
    CONSTRAINT CK_TasaImpuesto_Rango CHECK (VigenteHasta IS NULL OR VigenteHasta > VigenteDesde)
);
GO
/* ---------- Catalogo ---------- */
CREATE TABLE Catalogo.Categoria (
    IDCategoria      INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Categoria PRIMARY KEY,
    IDCategoriaPadre INT           NULL CONSTRAINT FK_Categoria_Padre REFERENCES Catalogo.Categoria(IDCategoria),
    Nombre           NVARCHAR(100) NOT NULL,
    Slug             VARCHAR(120)  NOT NULL CONSTRAINT UQ_Categoria_Slug UNIQUE,
    Descripcion      NVARCHAR(500) NULL,
    Orden            SMALLINT      NOT NULL CONSTRAINT DF_Categoria_Orden DEFAULT 0,
    Activo           BIT           NOT NULL CONSTRAINT DF_Categoria_Activo DEFAULT 1,
    CreadoEn         DATETIME2(3)  NOT NULL CONSTRAINT DF_Categoria_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Categoria_Padre CHECK (IDCategoriaPadre IS NULL OR IDCategoriaPadre <> IDCategoria)
);
CREATE INDEX IX_Categoria_Padre ON Catalogo.Categoria (IDCategoriaPadre, Activo);
CREATE TABLE Catalogo.Marca (
    IDMarca INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Marca PRIMARY KEY,
    Nombre  NVARCHAR(100) NOT NULL CONSTRAINT UQ_Marca_Nombre UNIQUE,
    Slug    VARCHAR(120)  NOT NULL CONSTRAINT UQ_Marca_Slug UNIQUE,
    LogoUrl NVARCHAR(500) NULL,
    Activo  BIT NOT NULL CONSTRAINT DF_Marca_Activo DEFAULT 1
);
CREATE TABLE Catalogo.Producto (
    IDProducto  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Producto PRIMARY KEY,
    IDCategoria INT           NOT NULL CONSTRAINT FK_Producto_Categoria REFERENCES Catalogo.Categoria(IDCategoria),
    IDMarca     INT           NULL CONSTRAINT FK_Producto_Marca REFERENCES Catalogo.Marca(IDMarca),
    IDImpuesto  SMALLINT      NOT NULL CONSTRAINT FK_Producto_Impuesto REFERENCES Catalogo.Impuesto(IDImpuesto),
    Nombre      NVARCHAR(200) NOT NULL,
    Slug        VARCHAR(220)  NOT NULL CONSTRAINT UQ_Producto_Slug UNIQUE,
    Descripcion NVARCHAR(MAX) NULL,
    MesesGarantia SMALLINT    NOT NULL CONSTRAINT DF_Producto_Garantia DEFAULT 0
        CONSTRAINT CK_Producto_Garantia CHECK (MesesGarantia >= 0),
    Activo      BIT           NOT NULL CONSTRAINT DF_Producto_Activo DEFAULT 1,
    CreadoEn    DATETIME2(3)  NOT NULL CONSTRAINT DF_Producto_CreadoEn DEFAULT SYSUTCDATETIME(),
    ActualizadoEn DATETIME2(3) NOT NULL CONSTRAINT DF_Producto_ActualizadoEn DEFAULT SYSUTCDATETIME(),
    Version     ROWVERSION    NOT NULL
);
CREATE INDEX IX_Producto_Categoria ON Catalogo.Producto (IDCategoria, Activo) INCLUDE (Nombre, IDMarca);
CREATE INDEX IX_Producto_Marca ON Catalogo.Producto (IDMarca, Activo);
CREATE INDEX IX_Producto_Nombre ON Catalogo.Producto (Nombre) WHERE Activo = 1;
CREATE TABLE Catalogo.Variante (
    IDVariante INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Variante PRIMARY KEY,
    IDProducto INT         NOT NULL CONSTRAINT FK_Variante_Producto REFERENCES Catalogo.Producto(IDProducto),
    SKU        VARCHAR(40) NOT NULL CONSTRAINT UQ_Variante_SKU UNIQUE,
    PesoGramos INT         NULL CONSTRAINT CK_Variante_Peso CHECK (PesoGramos IS NULL OR PesoGramos > 0),
    Activo     BIT         NOT NULL CONSTRAINT DF_Variante_Activo DEFAULT 1,
    CreadoEn   DATETIME2(3) NOT NULL CONSTRAINT DF_Variante_CreadoEn DEFAULT SYSUTCDATETIME(),
    Version    ROWVERSION  NOT NULL
);
CREATE INDEX IX_Variante_Producto ON Catalogo.Variante (IDProducto, Activo);
-- Atributo sirve para ejes de variante (talla, color) y para fichas tecnicas (RAM, pantalla).
CREATE TABLE Catalogo.Atributo (
    IDAtributo INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Atributo PRIMARY KEY,
    Nombre     NVARCHAR(60) NOT NULL CONSTRAINT UQ_Atributo_Nombre UNIQUE
);
CREATE TABLE Catalogo.ValorAtributo (
    IDValorAtributo INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ValorAtributo PRIMARY KEY,
    IDAtributo INT NOT NULL CONSTRAINT FK_ValorAtributo_Atributo REFERENCES Catalogo.Atributo(IDAtributo),
    Valor      NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_ValorAtributo UNIQUE (IDAtributo, Valor)
);
CREATE TABLE Catalogo.VarianteValorAtributo (
    IDVariante      INT NOT NULL CONSTRAINT FK_VVA_Variante REFERENCES Catalogo.Variante(IDVariante),
    IDValorAtributo INT NOT NULL CONSTRAINT FK_VVA_Valor REFERENCES Catalogo.ValorAtributo(IDValorAtributo),
    CONSTRAINT PK_VarianteValorAtributo PRIMARY KEY (IDVariante, IDValorAtributo)
);
CREATE INDEX IX_VVA_Valor ON Catalogo.VarianteValorAtributo (IDValorAtributo);
CREATE TABLE Catalogo.EspecificacionProducto (
    IDProducto      INT NOT NULL CONSTRAINT FK_Especificacion_Producto REFERENCES Catalogo.Producto(IDProducto),
    IDValorAtributo INT NOT NULL CONSTRAINT FK_Especificacion_Valor REFERENCES Catalogo.ValorAtributo(IDValorAtributo),
    CONSTRAINT PK_EspecificacionProducto PRIMARY KEY (IDProducto, IDValorAtributo)
);
CREATE TABLE Catalogo.ImagenProducto (
    IDImagenProducto INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ImagenProducto PRIMARY KEY,
    IDProducto INT NOT NULL CONSTRAINT FK_Imagen_Producto REFERENCES Catalogo.Producto(IDProducto),
    IDVariante INT NULL CONSTRAINT FK_Imagen_Variante REFERENCES Catalogo.Variante(IDVariante),
    Url        NVARCHAR(500) NOT NULL,
    TextoAlt   NVARCHAR(200) NULL,
    Orden      SMALLINT NOT NULL CONSTRAINT DF_Imagen_Orden DEFAULT 0
);
CREATE INDEX IX_Imagen_Producto ON Catalogo.ImagenProducto (IDProducto, Orden);
-- Historial de precios: nunca se actualiza el monto, se cierra la vigencia y se abre otra.
-- El precio publicado incluye IVA.
CREATE TABLE Catalogo.PrecioVariante (
    IDPrecioVariante BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PrecioVariante PRIMARY KEY,
    IDVariante   INT           NOT NULL CONSTRAINT FK_Precio_Variante REFERENCES Catalogo.Variante(IDVariante),
    Precio       DECIMAL(18,2) NOT NULL CONSTRAINT CK_Precio_Monto CHECK (Precio >= 0),
    VigenteDesde DATETIME2(3)  NOT NULL,
    VigenteHasta DATETIME2(3)  NULL,
    IDUsuario    INT           NOT NULL CONSTRAINT FK_Precio_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    CONSTRAINT UQ_PrecioVariante UNIQUE (IDVariante, VigenteDesde),
    CONSTRAINT CK_Precio_Rango CHECK (VigenteHasta IS NULL OR VigenteHasta > VigenteDesde)
);
CREATE UNIQUE INDEX UX_Precio_Abierto ON Catalogo.PrecioVariante (IDVariante) INCLUDE (Precio, VigenteDesde) WHERE VigenteHasta IS NULL;
GO
/* ---------- Sucursales y bodegas ---------- */
CREATE TABLE Inventario.Sucursal (
    IDSucursal  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Sucursal PRIMARY KEY,
    Codigo      VARCHAR(20)   NOT NULL CONSTRAINT UQ_Sucursal_Codigo UNIQUE,
    Nombre      NVARCHAR(120) NOT NULL,
    IDMunicipio INT           NOT NULL CONSTRAINT FK_Sucursal_Municipio REFERENCES Clientes.Municipio(IDMunicipio),
    Direccion   NVARCHAR(250) NOT NULL,
    Telefono    VARCHAR(20)   NULL,
    Horario     NVARCHAR(200) NULL,
    PermiteRecoger BIT NOT NULL CONSTRAINT DF_Sucursal_Recoger DEFAULT 1,
    Activo      BIT NOT NULL CONSTRAINT DF_Sucursal_Activo DEFAULT 1
);
-- Bodega sin sucursal = centro de distribucion.
CREATE TABLE Inventario.Bodega (
    IDBodega   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Bodega PRIMARY KEY,
    IDSucursal INT           NULL CONSTRAINT FK_Bodega_Sucursal REFERENCES Inventario.Sucursal(IDSucursal),
    Codigo     VARCHAR(20)   NOT NULL CONSTRAINT UQ_Bodega_Codigo UNIQUE,
    Nombre     NVARCHAR(120) NOT NULL,
    PermiteVentaEnLinea BIT  NOT NULL CONSTRAINT DF_Bodega_VentaLinea DEFAULT 1,
    Prioridad  SMALLINT      NOT NULL CONSTRAINT DF_Bodega_Prioridad DEFAULT 100,
    Activo     BIT           NOT NULL CONSTRAINT DF_Bodega_Activo DEFAULT 1
);
CREATE INDEX IX_Bodega_Sucursal ON Inventario.Bodega (IDSucursal);
GO
/* ---------- Existencia y kardex ----------
   Existencia es el saldo materializado del kardex: permite un UPDATE atomico por fila bajo
   alta concurrencia. Los CHECK hacen imposible la sobreventa aunque falle un SP. */
CREATE TABLE Inventario.Existencia (
    IDVariante    INT NOT NULL CONSTRAINT FK_Existencia_Variante REFERENCES Catalogo.Variante(IDVariante),
    IDBodega      INT NOT NULL CONSTRAINT FK_Existencia_Bodega REFERENCES Inventario.Bodega(IDBodega),
    Fisica        INT NOT NULL CONSTRAINT DF_Existencia_Fisica DEFAULT 0,
    Reservada     INT NOT NULL CONSTRAINT DF_Existencia_Reservada DEFAULT 0,
    Disponible    AS (Fisica - Reservada) PERSISTED,
    CostoPromedio DECIMAL(18,4) NOT NULL CONSTRAINT DF_Existencia_Costo DEFAULT 0,
    StockMinimo   INT NOT NULL CONSTRAINT DF_Existencia_Minimo DEFAULT 0,
    ActualizadoEn DATETIME2(3) NOT NULL CONSTRAINT DF_Existencia_ActualizadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_Existencia PRIMARY KEY (IDVariante, IDBodega),
    CONSTRAINT CK_Existencia_Fisica CHECK (Fisica >= 0),
    CONSTRAINT CK_Existencia_Reservada CHECK (Reservada >= 0 AND Reservada <= Fisica),
    CONSTRAINT CK_Existencia_Costo CHECK (CostoPromedio >= 0),
    CONSTRAINT CK_Existencia_Minimo CHECK (StockMinimo >= 0)
);
CREATE INDEX IX_Existencia_Bodega ON Inventario.Existencia (IDBodega) INCLUDE (Fisica, Reservada);
CREATE TABLE Inventario.TipoMovimiento (
    IDTipoMovimiento TINYINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TipoMovimiento PRIMARY KEY,
    Codigo   VARCHAR(30)  NOT NULL CONSTRAINT UQ_TipoMovimiento_Codigo UNIQUE,
    Nombre   NVARCHAR(60) NOT NULL,
    Signo    SMALLINT     NOT NULL CONSTRAINT CK_TipoMovimiento_Signo CHECK (Signo IN (1,-1)),
    ExigeMotivo BIT       NOT NULL
);
-- Append-only: un trigger rechaza UPDATE y DELETE. Una correccion es otro movimiento.
CREATE TABLE Inventario.Kardex (
    IDKardex         BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Kardex PRIMARY KEY,
    IDVariante       INT      NOT NULL,
    IDBodega         INT      NOT NULL,
    IDTipoMovimiento TINYINT  NOT NULL CONSTRAINT FK_Kardex_Tipo REFERENCES Inventario.TipoMovimiento(IDTipoMovimiento),
    Cantidad         INT      NOT NULL,      -- con signo
    SaldoAnterior    INT      NOT NULL,
    SaldoNuevo       INT      NOT NULL,
    CostoUnitario    DECIMAL(18,4) NOT NULL,
    Motivo           NVARCHAR(300) NOT NULL,
    IDUsuario        INT      NOT NULL CONSTRAINT FK_Kardex_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    Fecha            DATETIME2(3) NOT NULL CONSTRAINT DF_Kardex_Fecha DEFAULT SYSUTCDATETIME(),
    ReferenciaDocumento NVARCHAR(60) NULL,
    IDGrupoMovimiento UNIQUEIDENTIFIER NULL, -- enlaza las dos patas de un traslado
    IDPedidoDetalle  BIGINT   NULL,          -- FK agregada en 004
    CONSTRAINT FK_Kardex_Existencia FOREIGN KEY (IDVariante, IDBodega) REFERENCES Inventario.Existencia(IDVariante, IDBodega),
    CONSTRAINT CK_Kardex_Cantidad CHECK (Cantidad <> 0),
    CONSTRAINT CK_Kardex_Saldo CHECK (SaldoNuevo = SaldoAnterior + Cantidad AND SaldoNuevo >= 0),
    CONSTRAINT CK_Kardex_Costo CHECK (CostoUnitario >= 0),
    CONSTRAINT CK_Kardex_Motivo CHECK (LEN(Motivo) > 0)
);
CREATE INDEX IX_Kardex_Variante ON Inventario.Kardex (IDVariante, IDBodega, Fecha DESC) INCLUDE (IDTipoMovimiento, Cantidad, SaldoNuevo);
CREATE INDEX IX_Kardex_Fecha ON Inventario.Kardex (Fecha DESC);
CREATE INDEX IX_Kardex_PedidoDetalle ON Inventario.Kardex (IDPedidoDetalle) WHERE IDPedidoDetalle IS NOT NULL;
GO
