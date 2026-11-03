/* 004 - Marketing, carrito, checkout, pedidos, pagos, devoluciones.
   Los totales guardados en Checkout y Pedido son una instantanea legal y comercial: no se
   recalculan aunque cambien precios o tasas. Es la unica desnormalizacion de ventas, y es
   intencional (ver docs/Diseno_BD.md). Los CHECK garantizan que cuadran. */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
GO
USE ShopCart;
GO
/* ---------- Cupones (RF-05) ---------- */
CREATE TABLE Marketing.Cupon (
    IDCupon        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Cupon PRIMARY KEY,
    Codigo         VARCHAR(40)   NOT NULL CONSTRAINT UQ_Cupon_Codigo UNIQUE,
    Descripcion    NVARCHAR(200) NULL,
    TipoDescuento  VARCHAR(10)   NOT NULL CONSTRAINT CK_Cupon_Tipo CHECK (TipoDescuento IN ('PORCENTAJE','MONTO')),
    Valor          DECIMAL(18,2) NOT NULL,
    DescuentoMaximo DECIMAL(18,2) NULL,
    MontoMinimo    DECIMAL(18,2) NOT NULL CONSTRAINT DF_Cupon_Minimo DEFAULT 0,
    VigenteDesde   DATETIME2(3)  NOT NULL,
    VigenteHasta   DATETIME2(3)  NOT NULL,
    LimiteTotal    INT           NULL,
    LimitePorCliente INT         NOT NULL CONSTRAINT DF_Cupon_LimiteCliente DEFAULT 1,
    IDCategoria    INT           NULL CONSTRAINT FK_Cupon_Categoria REFERENCES Catalogo.Categoria(IDCategoria),  -- NULL = todo el carrito
    UsosActuales   INT           NOT NULL CONSTRAINT DF_Cupon_Usos DEFAULT 0,
    Activo         BIT           NOT NULL CONSTRAINT DF_Cupon_Activo DEFAULT 1,
    CreadoEn       DATETIME2(3)  NOT NULL CONSTRAINT DF_Cupon_CreadoEn DEFAULT SYSUTCDATETIME(),
    Version        ROWVERSION    NOT NULL,
    CONSTRAINT CK_Cupon_Valor CHECK (Valor > 0 AND (TipoDescuento <> 'PORCENTAJE' OR Valor <= 100)),
    CONSTRAINT CK_Cupon_Minimo CHECK (MontoMinimo >= 0),
    CONSTRAINT CK_Cupon_Maximo CHECK (DescuentoMaximo IS NULL OR DescuentoMaximo > 0),
    CONSTRAINT CK_Cupon_Vigencia CHECK (VigenteHasta > VigenteDesde),
    CONSTRAINT CK_Cupon_LimiteTotal CHECK (LimiteTotal IS NULL OR LimiteTotal > 0),
    CONSTRAINT CK_Cupon_LimiteCliente CHECK (LimitePorCliente > 0),
    -- Ultima barrera contra superar el limite total bajo concurrencia.
    CONSTRAINT CK_Cupon_Usos CHECK (UsosActuales >= 0 AND (LimiteTotal IS NULL OR UsosActuales <= LimiteTotal))
);
GO
/* ---------- Promociones automaticas (extra) ---------- */
CREATE TABLE Marketing.Promocion (
    IDPromocion   INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Promocion PRIMARY KEY,
    Nombre        NVARCHAR(120) NOT NULL,
    Slug          VARCHAR(140)  NOT NULL CONSTRAINT UQ_Promocion_Slug UNIQUE,
    TipoDescuento VARCHAR(10)   NOT NULL CONSTRAINT CK_Promocion_Tipo CHECK (TipoDescuento IN ('PORCENTAJE','MONTO')),
    Valor         DECIMAL(18,2) NOT NULL,
    VigenteDesde  DATETIME2(3)  NOT NULL,
    VigenteHasta  DATETIME2(3)  NOT NULL,
    Activo        BIT           NOT NULL CONSTRAINT DF_Promocion_Activo DEFAULT 1,
    CreadoEn      DATETIME2(3)  NOT NULL CONSTRAINT DF_Promocion_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Promocion_Valor CHECK (Valor > 0 AND (TipoDescuento <> 'PORCENTAJE' OR Valor <= 100)),
    CONSTRAINT CK_Promocion_Vigencia CHECK (VigenteHasta > VigenteDesde)
);
CREATE INDEX IX_Promocion_Vigencia ON Marketing.Promocion (VigenteDesde, VigenteHasta) WHERE Activo = 1;
-- Exactamente uno de los cuatro destinos por fila.
CREATE TABLE Marketing.PromocionAlcance (
    IDPromocionAlcance INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PromocionAlcance PRIMARY KEY,
    IDPromocion INT NOT NULL CONSTRAINT FK_Alcance_Promocion REFERENCES Marketing.Promocion(IDPromocion),
    IDCategoria INT NULL CONSTRAINT FK_Alcance_Categoria REFERENCES Catalogo.Categoria(IDCategoria),
    IDMarca     INT NULL CONSTRAINT FK_Alcance_Marca REFERENCES Catalogo.Marca(IDMarca),
    IDProducto  INT NULL CONSTRAINT FK_Alcance_Producto REFERENCES Catalogo.Producto(IDProducto),
    IDVariante  INT NULL CONSTRAINT FK_Alcance_Variante REFERENCES Catalogo.Variante(IDVariante),
    CONSTRAINT CK_Alcance_Unico CHECK (
        (CASE WHEN IDCategoria IS NULL THEN 0 ELSE 1 END + CASE WHEN IDMarca IS NULL THEN 0 ELSE 1 END
       + CASE WHEN IDProducto IS NULL THEN 0 ELSE 1 END + CASE WHEN IDVariante IS NULL THEN 0 ELSE 1 END) = 1)
);
CREATE INDEX IX_Alcance_Promocion ON Marketing.PromocionAlcance (IDPromocion);
CREATE INDEX IX_Alcance_Categoria ON Marketing.PromocionAlcance (IDCategoria) WHERE IDCategoria IS NOT NULL;
CREATE INDEX IX_Alcance_Marca ON Marketing.PromocionAlcance (IDMarca) WHERE IDMarca IS NOT NULL;
CREATE INDEX IX_Alcance_Producto ON Marketing.PromocionAlcance (IDProducto) WHERE IDProducto IS NOT NULL;
CREATE INDEX IX_Alcance_Variante ON Marketing.PromocionAlcance (IDVariante) WHERE IDVariante IS NOT NULL;
GO
/* ---------- Anuncios (extra) ---------- */
CREATE TABLE Marketing.ZonaAnuncio (
    IDZonaAnuncio SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_ZonaAnuncio PRIMARY KEY,
    Codigo   VARCHAR(40)  NOT NULL CONSTRAINT UQ_ZonaAnuncio_Codigo UNIQUE,
    Nombre   NVARCHAR(80) NOT NULL,
    MaximoVisible TINYINT NOT NULL CONSTRAINT DF_ZonaAnuncio_Max DEFAULT 10
        CONSTRAINT CK_ZonaAnuncio_Max CHECK (MaximoVisible > 0)
);
CREATE TABLE Marketing.Anuncio (
    IDAnuncio     INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Anuncio PRIMARY KEY,
    IDZonaAnuncio SMALLINT      NOT NULL CONSTRAINT FK_Anuncio_Zona REFERENCES Marketing.ZonaAnuncio(IDZonaAnuncio),
    IDPromocion   INT           NULL CONSTRAINT FK_Anuncio_Promocion REFERENCES Marketing.Promocion(IDPromocion),
    Titulo        NVARCHAR(120) NOT NULL,
    Subtitulo     NVARCHAR(200) NULL,
    ImagenEscritorioUrl NVARCHAR(500) NOT NULL,
    ImagenMovilUrl NVARCHAR(500) NULL,
    UrlDestino    NVARCHAR(500) NOT NULL,
    Orden         SMALLINT      NOT NULL CONSTRAINT DF_Anuncio_Orden DEFAULT 0,
    VigenteDesde  DATETIME2(3)  NOT NULL,
    VigenteHasta  DATETIME2(3)  NOT NULL,
    Activo        BIT           NOT NULL CONSTRAINT DF_Anuncio_Activo DEFAULT 1,
    CreadoEn      DATETIME2(3)  NOT NULL CONSTRAINT DF_Anuncio_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Anuncio_Vigencia CHECK (VigenteHasta > VigenteDesde)
);
CREATE INDEX IX_Anuncio_Zona ON Marketing.Anuncio (IDZonaAnuncio, Activo, VigenteDesde, VigenteHasta);
-- Agregado diario: evita una fila por impresion, que no escala.
CREATE TABLE Marketing.AnuncioMetrica (
    IDAnuncio   INT  NOT NULL CONSTRAINT FK_Metrica_Anuncio REFERENCES Marketing.Anuncio(IDAnuncio),
    Fecha       DATE NOT NULL,
    Impresiones BIGINT NOT NULL CONSTRAINT DF_Metrica_Impresiones DEFAULT 0,
    Clics       BIGINT NOT NULL CONSTRAINT DF_Metrica_Clics DEFAULT 0,
    CONSTRAINT PK_AnuncioMetrica PRIMARY KEY (IDAnuncio, Fecha)
);
GO
/* ---------- Envios y pagos ---------- */
CREATE TABLE Ventas.MetodoEnvio (
    IDMetodoEnvio SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MetodoEnvio PRIMARY KEY,
    Codigo  VARCHAR(30)  NOT NULL CONSTRAINT UQ_MetodoEnvio_Codigo UNIQUE,
    Nombre  NVARCHAR(80) NOT NULL,
    EsRecogerEnTienda BIT NOT NULL,
    Activo  BIT NOT NULL CONSTRAINT DF_MetodoEnvio_Activo DEFAULT 1
);
CREATE TABLE Ventas.TarifaEnvio (
    IDTarifaEnvio  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TarifaEnvio PRIMARY KEY,
    IDMetodoEnvio  SMALLINT NOT NULL CONSTRAINT FK_Tarifa_Metodo REFERENCES Ventas.MetodoEnvio(IDMetodoEnvio),
    IDDepartamento SMALLINT NOT NULL CONSTRAINT FK_Tarifa_Departamento REFERENCES Clientes.Departamento(IDDepartamento),
    Costo          DECIMAL(18,2) NOT NULL CONSTRAINT CK_Tarifa_Costo CHECK (Costo >= 0),
    MontoEnvioGratis DECIMAL(18,2) NULL CONSTRAINT CK_Tarifa_Gratis CHECK (MontoEnvioGratis IS NULL OR MontoEnvioGratis > 0),
    DiasEstimados  TINYINT NOT NULL,
    Activo         BIT NOT NULL CONSTRAINT DF_Tarifa_Activo DEFAULT 1,
    CONSTRAINT UQ_TarifaEnvio UNIQUE (IDMetodoEnvio, IDDepartamento)
);
CREATE TABLE Ventas.MetodoPago (
    IDMetodoPago SMALLINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_MetodoPago PRIMARY KEY,
    Codigo VARCHAR(30)  NOT NULL CONSTRAINT UQ_MetodoPago_Codigo UNIQUE,
    Nombre NVARCHAR(80) NOT NULL,
    Activo BIT NOT NULL CONSTRAINT DF_MetodoPago_Activo DEFAULT 1
);
GO
/* ---------- Carrito (RF-04) ---------- */
CREATE TABLE Ventas.Carrito (
    IDCarrito    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Carrito PRIMARY KEY,
    IDUsuario    INT         NULL CONSTRAINT FK_Carrito_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    HashTokenInvitado BINARY(32) NULL,
    IDCupon      INT         NULL CONSTRAINT FK_Carrito_Cupon REFERENCES Marketing.Cupon(IDCupon),
    Estado       VARCHAR(12) NOT NULL CONSTRAINT DF_Carrito_Estado DEFAULT 'ACTIVO'
        CONSTRAINT CK_Carrito_Estado CHECK (Estado IN ('ACTIVO','CONVERTIDO','FUSIONADO')),
    CreadoEn     DATETIME2(3) NOT NULL CONSTRAINT DF_Carrito_CreadoEn DEFAULT SYSUTCDATETIME(),
    UltimaActividad DATETIME2(3) NOT NULL CONSTRAINT DF_Carrito_Actividad DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Carrito_Dueno CHECK ((IDUsuario IS NULL AND HashTokenInvitado IS NOT NULL) OR (IDUsuario IS NOT NULL AND HashTokenInvitado IS NULL))
);
CREATE UNIQUE INDEX UX_Carrito_UsuarioActivo ON Ventas.Carrito (IDUsuario) WHERE Estado = 'ACTIVO' AND IDUsuario IS NOT NULL;
CREATE UNIQUE INDEX UX_Carrito_InvitadoActivo ON Ventas.Carrito (HashTokenInvitado) WHERE Estado = 'ACTIVO' AND HashTokenInvitado IS NOT NULL;
CREATE INDEX IX_Carrito_Actividad ON Ventas.Carrito (Estado, UltimaActividad) INCLUDE (IDUsuario);
CREATE TABLE Ventas.CarritoDetalle (
    IDCarritoDetalle BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CarritoDetalle PRIMARY KEY,
    IDCarrito  BIGINT NOT NULL CONSTRAINT FK_CarritoDetalle_Carrito REFERENCES Ventas.Carrito(IDCarrito),
    IDVariante INT    NOT NULL CONSTRAINT FK_CarritoDetalle_Variante REFERENCES Catalogo.Variante(IDVariante),
    Cantidad   INT    NOT NULL CONSTRAINT CK_CarritoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT UQ_CarritoDetalle UNIQUE (IDCarrito, IDVariante)
);
CREATE INDEX IX_CarritoDetalle_Variante ON Ventas.CarritoDetalle (IDVariante);
GO
/* ---------- Checkout (RF-06): congela precios y reserva por 15 minutos ---------- */
CREATE TABLE Ventas.Checkout (
    IDCheckout    BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Checkout PRIMARY KEY,
    IDCarrito     BIGINT       NOT NULL CONSTRAINT FK_Checkout_Carrito REFERENCES Ventas.Carrito(IDCarrito),
    IDUsuario     INT          NOT NULL CONSTRAINT FK_Checkout_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    IDMetodoEnvio SMALLINT     NOT NULL CONSTRAINT FK_Checkout_MetodoEnvio REFERENCES Ventas.MetodoEnvio(IDMetodoEnvio),
    IDDireccion   INT          NULL CONSTRAINT FK_Checkout_Direccion REFERENCES Clientes.Direccion(IDDireccion),
    IDSucursalRecoger INT      NULL CONSTRAINT FK_Checkout_Sucursal REFERENCES Inventario.Sucursal(IDSucursal),
    IDCupon       INT          NULL CONSTRAINT FK_Checkout_Cupon REFERENCES Marketing.Cupon(IDCupon),
    Subtotal      DECIMAL(18,2) NOT NULL,
    DescuentoCupon DECIMAL(18,2) NOT NULL,
    CostoEnvio    DECIMAL(18,2) NOT NULL,
    Total         DECIMAL(18,2) NOT NULL,
    Estado        VARCHAR(12)  NOT NULL CONSTRAINT DF_Checkout_Estado DEFAULT 'ACTIVO'
        CONSTRAINT CK_Checkout_Estado CHECK (Estado IN ('ACTIVO','COMPLETADO','EXPIRADO','CANCELADO')),
    ExpiraEn      DATETIME2(3) NOT NULL,
    CreadoEn      DATETIME2(3) NOT NULL CONSTRAINT DF_Checkout_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT CK_Checkout_Destino CHECK ((IDDireccion IS NULL AND IDSucursalRecoger IS NOT NULL) OR (IDDireccion IS NOT NULL AND IDSucursalRecoger IS NULL)),
    CONSTRAINT CK_Checkout_Montos CHECK (Subtotal >= 0 AND DescuentoCupon >= 0 AND DescuentoCupon <= Subtotal AND CostoEnvio >= 0),
    CONSTRAINT CK_Checkout_Total CHECK (Total = Subtotal - DescuentoCupon + CostoEnvio AND Total >= 0)
);
CREATE UNIQUE INDEX UX_Checkout_CarritoActivo ON Ventas.Checkout (IDCarrito) WHERE Estado = 'ACTIVO';
CREATE INDEX IX_Checkout_Expira ON Ventas.Checkout (ExpiraEn) WHERE Estado = 'ACTIVO';
CREATE INDEX IX_Checkout_Usuario ON Ventas.Checkout (IDUsuario, CreadoEn DESC);
CREATE TABLE Ventas.CheckoutDetalle (
    IDCheckoutDetalle BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CheckoutDetalle PRIMARY KEY,
    IDCheckout     BIGINT NOT NULL CONSTRAINT FK_CheckoutDetalle_Checkout REFERENCES Ventas.Checkout(IDCheckout),
    IDVariante     INT    NOT NULL CONSTRAINT FK_CheckoutDetalle_Variante REFERENCES Catalogo.Variante(IDVariante),
    IDPromocion    INT    NULL CONSTRAINT FK_CheckoutDetalle_Promocion REFERENCES Marketing.Promocion(IDPromocion),
    Cantidad       INT    NOT NULL CONSTRAINT CK_CheckoutDetalle_Cantidad CHECK (Cantidad > 0),
    PrecioLista    DECIMAL(18,2) NOT NULL,
    DescuentoPromocion DECIMAL(18,2) NOT NULL,  -- por unidad
    PrecioUnitario DECIMAL(18,2) NOT NULL,
    DescuentoCupon DECIMAL(18,2) NOT NULL,      -- prorrateado a la linea
    TasaIVA        DECIMAL(5,2)  NOT NULL,
    CONSTRAINT UQ_CheckoutDetalle UNIQUE (IDCheckout, IDVariante),
    CONSTRAINT CK_CheckoutDetalle_Precio CHECK (PrecioUnitario = PrecioLista - DescuentoPromocion AND PrecioUnitario >= 0 AND DescuentoCupon >= 0)
);
CREATE TABLE Inventario.Reserva (
    IDReserva  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reserva PRIMARY KEY,
    IDCheckout BIGINT NOT NULL CONSTRAINT FK_Reserva_Checkout REFERENCES Ventas.Checkout(IDCheckout),
    IDVariante INT    NOT NULL,
    IDBodega   INT    NOT NULL,
    Cantidad   INT    NOT NULL CONSTRAINT CK_Reserva_Cantidad CHECK (Cantidad > 0),
    Estado     VARCHAR(10) NOT NULL CONSTRAINT DF_Reserva_Estado DEFAULT 'ACTIVA'
        CONSTRAINT CK_Reserva_Estado CHECK (Estado IN ('ACTIVA','CONSUMIDA','LIBERADA')),
    ExpiraEn   DATETIME2(3) NOT NULL,
    CreadoEn   DATETIME2(3) NOT NULL CONSTRAINT DF_Reserva_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT FK_Reserva_Existencia FOREIGN KEY (IDVariante, IDBodega) REFERENCES Inventario.Existencia(IDVariante, IDBodega),
    CONSTRAINT UQ_Reserva UNIQUE (IDCheckout, IDVariante, IDBodega)
);
CREATE INDEX IX_Reserva_Variante ON Inventario.Reserva (IDVariante, IDBodega) WHERE Estado = 'ACTIVA';
GO
/* ---------- Pedidos (RF-07): maquina de estados en datos ---------- */
CREATE TABLE Ventas.EstadoPedido (
    IDEstadoPedido TINYINT NOT NULL CONSTRAINT PK_EstadoPedido PRIMARY KEY,
    Codigo   VARCHAR(30)  NOT NULL CONSTRAINT UQ_EstadoPedido_Codigo UNIQUE,
    Nombre   NVARCHAR(60) NOT NULL,
    EsVentaReportable BIT NOT NULL,  -- pedido completado para RF-08
    EsCancelable      BIT NOT NULL
);
CREATE TABLE Ventas.TransicionEstadoPedido (
    IDEstadoOrigen  TINYINT NOT NULL CONSTRAINT FK_Transicion_Origen REFERENCES Ventas.EstadoPedido(IDEstadoPedido),
    IDEstadoDestino TINYINT NOT NULL CONSTRAINT FK_Transicion_Destino REFERENCES Ventas.EstadoPedido(IDEstadoPedido),
    CONSTRAINT PK_TransicionEstadoPedido PRIMARY KEY (IDEstadoOrigen, IDEstadoDestino),
    CONSTRAINT CK_Transicion_Distinto CHECK (IDEstadoOrigen <> IDEstadoDestino)
);
CREATE SEQUENCE Ventas.SecNumeroPedido AS BIGINT START WITH 100001 INCREMENT BY 1 CACHE 50;
CREATE TABLE Ventas.Pedido (
    IDPedido      BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Pedido PRIMARY KEY,
    NumeroPedido  VARCHAR(20)  NOT NULL CONSTRAINT UQ_Pedido_Numero UNIQUE,
    IDUsuario     INT          NOT NULL CONSTRAINT FK_Pedido_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    IDCheckout    BIGINT       NOT NULL CONSTRAINT FK_Pedido_Checkout REFERENCES Ventas.Checkout(IDCheckout)
        CONSTRAINT UQ_Pedido_Checkout UNIQUE,          -- un checkout nunca produce dos pedidos
    IDEstadoPedido TINYINT     NOT NULL CONSTRAINT FK_Pedido_Estado REFERENCES Ventas.EstadoPedido(IDEstadoPedido),
    IDMetodoEnvio SMALLINT     NOT NULL CONSTRAINT FK_Pedido_MetodoEnvio REFERENCES Ventas.MetodoEnvio(IDMetodoEnvio),
    IDSucursalRecoger INT      NULL CONSTRAINT FK_Pedido_Sucursal REFERENCES Inventario.Sucursal(IDSucursal),
    IDCupon       INT          NULL CONSTRAINT FK_Pedido_Cupon REFERENCES Marketing.Cupon(IDCupon),
    Subtotal      DECIMAL(18,2) NOT NULL,
    DescuentoCupon DECIMAL(18,2) NOT NULL,
    CostoEnvio    DECIMAL(18,2) NOT NULL,
    Total         DECIMAL(18,2) NOT NULL,
    BaseImponible DECIMAL(18,2) NOT NULL,
    IVA           DECIMAL(18,2) NOT NULL,
    NITFactura    VARCHAR(15)   NOT NULL CONSTRAINT DF_Pedido_NIT DEFAULT 'CF',
    NombreFactura NVARCHAR(200) NOT NULL,
    FechaPedido   DATETIME2(3)  NOT NULL CONSTRAINT DF_Pedido_Fecha DEFAULT SYSUTCDATETIME(),
    FechaLocal    AS CAST(DATEADD(HOUR, -6, FechaPedido) AS DATE) PERSISTED,  -- Guatemala es UTC-6 fijo
    Version       ROWVERSION   NOT NULL,
    CONSTRAINT CK_Pedido_Montos CHECK (Subtotal >= 0 AND DescuentoCupon >= 0 AND DescuentoCupon <= Subtotal AND CostoEnvio >= 0),
    CONSTRAINT CK_Pedido_Total CHECK (Total = Subtotal - DescuentoCupon + CostoEnvio AND Total >= 0),
    CONSTRAINT CK_Pedido_Impuesto CHECK (BaseImponible + IVA = Total AND BaseImponible >= 0 AND IVA >= 0)
);
CREATE INDEX IX_Pedido_Usuario ON Ventas.Pedido (IDUsuario, FechaPedido DESC);
CREATE INDEX IX_Pedido_Estado ON Ventas.Pedido (IDEstadoPedido, FechaPedido DESC);
CREATE INDEX IX_Pedido_FechaLocal ON Ventas.Pedido (FechaLocal) INCLUDE (IDEstadoPedido, Total, IDUsuario);
CREATE TABLE Ventas.PedidoDetalle (
    IDPedidoDetalle BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PedidoDetalle PRIMARY KEY,
    IDPedido       BIGINT NOT NULL CONSTRAINT FK_PedidoDetalle_Pedido REFERENCES Ventas.Pedido(IDPedido),
    IDVariante     INT    NOT NULL CONSTRAINT FK_PedidoDetalle_Variante REFERENCES Catalogo.Variante(IDVariante),
    IDPromocion    INT    NULL CONSTRAINT FK_PedidoDetalle_Promocion REFERENCES Marketing.Promocion(IDPromocion),
    SKU            VARCHAR(40)   NOT NULL,   -- instantanea
    NombreProducto NVARCHAR(200) NOT NULL,   -- instantanea
    Cantidad       INT    NOT NULL,
    PrecioLista    DECIMAL(18,2) NOT NULL,
    DescuentoPromocion DECIMAL(18,2) NOT NULL,
    PrecioUnitario DECIMAL(18,2) NOT NULL,
    DescuentoCupon DECIMAL(18,2) NOT NULL,
    TotalLinea     DECIMAL(18,2) NOT NULL,
    TasaIVA        DECIMAL(5,2)  NOT NULL,
    BaseLinea      DECIMAL(18,2) NOT NULL,
    IVALinea       DECIMAL(18,2) NOT NULL,
    CostoUnitario  DECIMAL(18,4) NOT NULL,   -- para margen real
    CantidadDevuelta INT NOT NULL CONSTRAINT DF_PedidoDetalle_Devuelta DEFAULT 0,
    CONSTRAINT UQ_PedidoDetalle UNIQUE (IDPedido, IDVariante),
    CONSTRAINT CK_PedidoDetalle_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT CK_PedidoDetalle_Precio CHECK (PrecioUnitario = PrecioLista - DescuentoPromocion AND PrecioUnitario >= 0),
    CONSTRAINT CK_PedidoDetalle_Total CHECK (TotalLinea = Cantidad * PrecioUnitario - DescuentoCupon AND TotalLinea >= 0),
    CONSTRAINT CK_PedidoDetalle_Impuesto CHECK (BaseLinea + IVALinea = TotalLinea),
    -- No se puede devolver mas de lo vendido en la linea.
    CONSTRAINT CK_PedidoDetalle_Devuelta CHECK (CantidadDevuelta BETWEEN 0 AND Cantidad)
);
CREATE INDEX IX_PedidoDetalle_Variante ON Ventas.PedidoDetalle (IDVariante) INCLUDE (Cantidad, TotalLinea, CantidadDevuelta);
ALTER TABLE Inventario.Kardex ADD CONSTRAINT FK_Kardex_PedidoDetalle FOREIGN KEY (IDPedidoDetalle) REFERENCES Ventas.PedidoDetalle(IDPedidoDetalle);
-- De que bodega salio cada unidad: una linea puede surtirse desde varias.
CREATE TABLE Ventas.PedidoAsignacion (
    IDPedidoDetalle BIGINT NOT NULL CONSTRAINT FK_Asignacion_Detalle REFERENCES Ventas.PedidoDetalle(IDPedidoDetalle),
    IDBodega        INT    NOT NULL CONSTRAINT FK_Asignacion_Bodega REFERENCES Inventario.Bodega(IDBodega),
    Cantidad        INT    NOT NULL CONSTRAINT CK_Asignacion_Cantidad CHECK (Cantidad > 0),
    CONSTRAINT PK_PedidoAsignacion PRIMARY KEY (IDPedidoDetalle, IDBodega)
);
-- Copia de la direccion: el cliente puede editar la suya sin alterar pedidos pasados.
CREATE TABLE Ventas.PedidoDireccion (
    IDPedido     BIGINT NOT NULL CONSTRAINT PK_PedidoDireccion PRIMARY KEY
        CONSTRAINT FK_PedidoDireccion_Pedido REFERENCES Ventas.Pedido(IDPedido),
    IDMunicipio  INT           NOT NULL CONSTRAINT FK_PedidoDireccion_Municipio REFERENCES Clientes.Municipio(IDMunicipio),
    Destinatario NVARCHAR(150) NOT NULL,
    Telefono     VARCHAR(20)   NOT NULL,
    Linea1       NVARCHAR(200) NOT NULL,
    Linea2       NVARCHAR(200) NULL,
    Referencia   NVARCHAR(300) NULL
);
CREATE TABLE Ventas.PedidoHistorialEstado (
    IDPedidoHistorialEstado BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PedidoHistorialEstado PRIMARY KEY,
    IDPedido         BIGINT  NOT NULL CONSTRAINT FK_Historial_Pedido REFERENCES Ventas.Pedido(IDPedido),
    IDEstadoAnterior TINYINT NULL CONSTRAINT FK_Historial_Anterior REFERENCES Ventas.EstadoPedido(IDEstadoPedido),
    IDEstadoNuevo    TINYINT NOT NULL CONSTRAINT FK_Historial_Nuevo REFERENCES Ventas.EstadoPedido(IDEstadoPedido),
    IDUsuario        INT     NOT NULL CONSTRAINT FK_Historial_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    Fecha            DATETIME2(3) NOT NULL CONSTRAINT DF_Historial_Fecha DEFAULT SYSUTCDATETIME(),
    Motivo           NVARCHAR(300) NULL
);
CREATE INDEX IX_Historial_Pedido ON Ventas.PedidoHistorialEstado (IDPedido, Fecha);
GO
/* ---------- Pagos, cupon usado, idempotencia ---------- */
CREATE TABLE Ventas.Pago (
    IDPago       BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Pago PRIMARY KEY,
    IDCheckout   BIGINT       NOT NULL CONSTRAINT FK_Pago_Checkout REFERENCES Ventas.Checkout(IDCheckout),
    IDMetodoPago SMALLINT     NOT NULL CONSTRAINT FK_Pago_Metodo REFERENCES Ventas.MetodoPago(IDMetodoPago),
    Monto        DECIMAL(18,2) NOT NULL CONSTRAINT CK_Pago_Monto CHECK (Monto >= 0),
    Estado       VARCHAR(20)  NOT NULL CONSTRAINT CK_Pago_Estado CHECK (Estado IN ('APROBADO','RECHAZADO','REEMBOLSO_PENDIENTE')),
    ReferenciaPasarela VARCHAR(100) NOT NULL,
    Mensaje      NVARCHAR(300) NULL,
    Fecha        DATETIME2(3) NOT NULL CONSTRAINT DF_Pago_Fecha DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_Pago_Referencia UNIQUE (ReferenciaPasarela)
);
CREATE INDEX IX_Pago_Checkout ON Ventas.Pago (IDCheckout);
-- A nivel de motor: un checkout no puede tener dos cobros aprobados.
CREATE UNIQUE INDEX UX_Pago_AprobadoPorCheckout ON Ventas.Pago (IDCheckout) WHERE Estado = 'APROBADO';
CREATE TABLE Ventas.CuponUso (
    IDCuponUso BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_CuponUso PRIMARY KEY,
    IDCupon    INT    NOT NULL CONSTRAINT FK_CuponUso_Cupon REFERENCES Marketing.Cupon(IDCupon),
    IDUsuario  INT    NOT NULL CONSTRAINT FK_CuponUso_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    IDCheckout BIGINT NOT NULL CONSTRAINT FK_CuponUso_Checkout REFERENCES Ventas.Checkout(IDCheckout)
        CONSTRAINT UQ_CuponUso_Checkout UNIQUE,    -- solo un cupon por pedido
    IDPedido   BIGINT NULL CONSTRAINT FK_CuponUso_Pedido REFERENCES Ventas.Pedido(IDPedido),
    Monto      DECIMAL(18,2) NOT NULL CONSTRAINT CK_CuponUso_Monto CHECK (Monto >= 0),
    Estado     VARCHAR(10) NOT NULL CONSTRAINT CK_CuponUso_Estado CHECK (Estado IN ('RESERVADO','CONFIRMADO','REVERTIDO')),
    Fecha      DATETIME2(3) NOT NULL CONSTRAINT DF_CuponUso_Fecha DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_CuponUso_Cliente ON Ventas.CuponUso (IDCupon, IDUsuario) INCLUDE (Estado);
CREATE TABLE Ventas.SolicitudIdempotente (
    IDSolicitudIdempotente BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_SolicitudIdempotente PRIMARY KEY,
    Operacion     VARCHAR(40)      NOT NULL,
    IDUsuario     INT              NOT NULL CONSTRAINT FK_Solicitud_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    Llave         UNIQUEIDENTIFIER NOT NULL,
    HashSolicitud BINARY(32)       NOT NULL,  -- misma llave con otro contenido = error 409
    IDRecurso     BIGINT           NOT NULL,
    CreadoEn      DATETIME2(3)     NOT NULL CONSTRAINT DF_Solicitud_CreadoEn DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UQ_SolicitudIdempotente UNIQUE (Operacion, IDUsuario, Llave)
);
CREATE INDEX IX_Solicitud_CreadoEn ON Ventas.SolicitudIdempotente (CreadoEn);
GO
/* ---------- Devoluciones, reembolsos, factura y eventos ---------- */
CREATE TABLE Ventas.Devolucion (
    IDDevolucion BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Devolucion PRIMARY KEY,
    IDPedido     BIGINT        NOT NULL CONSTRAINT FK_Devolucion_Pedido REFERENCES Ventas.Pedido(IDPedido),
    IDUsuario    INT           NOT NULL CONSTRAINT FK_Devolucion_Usuario REFERENCES Seguridad.Usuario(IDUsuario),
    Motivo       NVARCHAR(300) NOT NULL,
    Fecha        DATETIME2(3)  NOT NULL CONSTRAINT DF_Devolucion_Fecha DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Devolucion_Pedido ON Ventas.Devolucion (IDPedido);
CREATE TABLE Ventas.DevolucionDetalle (
    IDDevolucionDetalle BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_DevolucionDetalle PRIMARY KEY,
    IDDevolucion    BIGINT NOT NULL CONSTRAINT FK_DevolucionDetalle_Devolucion REFERENCES Ventas.Devolucion(IDDevolucion),
    IDPedidoDetalle BIGINT NOT NULL CONSTRAINT FK_DevolucionDetalle_Detalle REFERENCES Ventas.PedidoDetalle(IDPedidoDetalle),
    IDBodega        INT    NOT NULL CONSTRAINT FK_DevolucionDetalle_Bodega REFERENCES Inventario.Bodega(IDBodega),
    Cantidad        INT    NOT NULL CONSTRAINT CK_DevolucionDetalle_Cantidad CHECK (Cantidad > 0),
    Monto           DECIMAL(18,2) NOT NULL CONSTRAINT CK_DevolucionDetalle_Monto CHECK (Monto >= 0),
    ReingresaInventario BIT NOT NULL,   -- 0 = producto danado, no vuelve a la venta
    CONSTRAINT UQ_DevolucionDetalle UNIQUE (IDDevolucion, IDPedidoDetalle)
);
CREATE INDEX IX_DevolucionDetalle_Detalle ON Ventas.DevolucionDetalle (IDPedidoDetalle) INCLUDE (Cantidad, Monto);
CREATE TABLE Ventas.Reembolso (
    IDReembolso  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Reembolso PRIMARY KEY,
    IDPedido     BIGINT NOT NULL CONSTRAINT FK_Reembolso_Pedido REFERENCES Ventas.Pedido(IDPedido),
    IDDevolucion BIGINT NULL CONSTRAINT FK_Reembolso_Devolucion REFERENCES Ventas.Devolucion(IDDevolucion),
    Monto        DECIMAL(18,2) NOT NULL CONSTRAINT CK_Reembolso_Monto CHECK (Monto >= 0),
    Estado       VARCHAR(10) NOT NULL CONSTRAINT DF_Reembolso_Estado DEFAULT 'PENDIENTE'
        CONSTRAINT CK_Reembolso_Estado CHECK (Estado IN ('PENDIENTE','PROCESADO')),
    Referencia   VARCHAR(100) NULL,
    Fecha        DATETIME2(3) NOT NULL CONSTRAINT DF_Reembolso_Fecha DEFAULT SYSUTCDATETIME()
);
CREATE INDEX IX_Reembolso_Pedido ON Ventas.Reembolso (IDPedido);
CREATE INDEX IX_Reembolso_Pendiente ON Ventas.Reembolso (Fecha) WHERE Estado = 'PENDIENTE';
-- Factura electronica FEL: la certificacion la hace un proveedor externo.
CREATE TABLE Ventas.Factura (
    IDFactura   BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_Factura PRIMARY KEY,
    IDPedido    BIGINT NOT NULL CONSTRAINT FK_Factura_Pedido REFERENCES Ventas.Pedido(IDPedido)
        CONSTRAINT UQ_Factura_Pedido UNIQUE,
    NumeroAutorizacion VARCHAR(40) NULL,
    Serie       VARCHAR(20) NULL,
    Numero      VARCHAR(20) NULL,
    Estado      VARCHAR(12) NOT NULL CONSTRAINT DF_Factura_Estado DEFAULT 'PENDIENTE'
        CONSTRAINT CK_Factura_Estado CHECK (Estado IN ('PENDIENTE','CERTIFICADA','ANULADA')),
    FechaCertificacion DATETIME2(3) NULL
);
-- Patron outbox: correos y tiempo real se publican despues del commit, sin riesgo de avisar
-- de un pedido que hizo rollback.
CREATE TABLE Ventas.EventoSalida (
    IDEventoSalida BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_EventoSalida PRIMARY KEY,
    TipoEvento  VARCHAR(50)   NOT NULL,
    Contenido   NVARCHAR(MAX) NOT NULL CONSTRAINT CK_EventoSalida_Json CHECK (ISJSON(Contenido) = 1),
    CreadoEn    DATETIME2(3)  NOT NULL CONSTRAINT DF_EventoSalida_CreadoEn DEFAULT SYSUTCDATETIME(),
    ProcesadoEn DATETIME2(3)  NULL
);
CREATE INDEX IX_EventoSalida_Pendiente ON Ventas.EventoSalida (IDEventoSalida) WHERE ProcesadoEn IS NULL;
GO
