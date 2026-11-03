/* 014 - Datos semilla reproducibles. Los pedidos se generan con los mismos SP de produccion,
   asi kardex, cupones, bitacora e historial quedan consistentes.
   Contrasena de prueba de todos los usuarios: ShopCart#2026 (bcrypt). */
SET ANSI_NULLS ON;
SET QUOTED_IDENTIFIER ON;
SET NOCOUNT ON;
GO
USE ShopCart;
GO
INSERT Config.Parametro (Clave, Valor, TipoDato, Descripcion) VALUES
 ('RESERVA_MINUTOS', N'15', 'INT', N'Minutos que dura la reserva de existencia en el checkout'),
 ('CARRITO_ABANDONO_MINUTOS', N'1440', 'INT', N'Minutos sin actividad para considerar un carrito abandonado'),
 ('LOGIN_INTENTOS_MAXIMOS', N'5', 'INT', N'Intentos fallidos antes de bloquear la cuenta'),
 ('LOGIN_BLOQUEO_MINUTOS', N'15', 'INT', N'Minutos de bloqueo tras exceder los intentos'),
 ('IDEMPOTENCIA_RETENCION_DIAS', N'7', 'INT', N'Dias que se conservan las llaves de idempotencia');

INSERT Config.ErrorNegocio (Codigo, CodigoNegocio, Mensaje, HttpStatus) VALUES
 (51000,'ACCESO_DENEGADO',N'No tiene permiso para esta accion.',403),
 (51002,'USUARIO_INACTIVO',N'El usuario no existe o esta inactivo.',403),
 (51003,'CORREO_DUPLICADO',N'Ya existe una cuenta con ese correo.',409),
 (51004,'TOKEN_INVALIDO',N'La sesion no es valida o expiro.',401),
 (51005,'TOKEN_REUTILIZADO',N'Se detecto reutilizacion del token; inicie sesion de nuevo.',401),
 (51006,'DATOS_INVALIDOS',N'Los datos enviados no son validos.',400),
 (51007,'NO_ENCONTRADO',N'El recurso no existe.',404),
 (51101,'SKU_DUPLICADO',N'El SKU ya existe.',409),
 (51102,'PRECIO_INVALIDO',N'El precio no es valido.',400),
 (51103,'CATEGORIA_CICLO',N'Una categoria no puede depender de si misma ni de sus subcategorias.',409),
 (51104,'VARIANTE_NO_DISPONIBLE',N'El producto ya no esta disponible.',409),
 (51105,'VALOR_DUPLICADO',N'Ya existe un registro con ese codigo o slug.',409),
 (51201,'EXISTENCIA_INSUFICIENTE',N'No hay existencia suficiente.',409),
 (51202,'MOTIVO_REQUERIDO',N'Debe indicar un motivo.',400),
 (51203,'SALDO_NEGATIVO',N'El movimiento dejaria la existencia en negativo o por debajo de lo reservado.',409),
 (51204,'KARDEX_INMUTABLE',N'El kardex no puede modificarse ni eliminarse.',409),
 (51301,'CUPON_NO_EXISTE',N'El cupon no existe.',404),
 (51302,'CUPON_INACTIVO',N'El cupon no esta activo.',409),
 (51303,'CUPON_NO_VIGENTE',N'El cupon aun no esta vigente.',409),
 (51304,'CUPON_VENCIDO',N'El cupon esta vencido.',409),
 (51305,'CUPON_AGOTADO',N'El cupon ya alcanzo su limite de usos.',409),
 (51306,'CUPON_LIMITE_CLIENTE',N'Ya alcanzo el limite de usos de este cupon.',409),
 (51307,'CUPON_MONTO_MINIMO',N'La compra no alcanza el monto minimo del cupon.',409),
 (51308,'CUPON_NO_APLICA',N'El cupon no aplica a los productos del carrito.',409),
 (51401,'IDEMPOTENCIA_CONFLICTO',N'La llave de idempotencia ya se uso con otra solicitud.',409),
 (51402,'CARRITO_VACIO',N'El carrito esta vacio.',409),
 (51403,'CHECKOUT_EXPIRADO',N'La reserva expiro. Si se realizo un cobro, sera reembolsado.',410),
 (51404,'CHECKOUT_NO_ACTIVO',N'El checkout no esta activo.',409),
 (51405,'ENVIO_NO_DISPONIBLE',N'El metodo de envio no esta disponible para este destino.',409),
 (51406,'DESTINO_INVALIDO',N'La direccion o sucursal de entrega no es valida.',400),
 (51408,'MONTO_PAGO_DISTINTO',N'El monto cobrado no coincide con el total.',409),
 (51501,'TRANSICION_NO_PERMITIDA',N'Transicion de estado no permitida.',409),
 (51502,'PEDIDO_NO_CANCELABLE',N'El pedido ya fue despachado y no puede cancelarse.',409),
 (51503,'DEVOLUCION_EXCEDE',N'No se puede devolver mas de lo vendido en la linea.',409),
 (51504,'PEDIDO_NO_DEVOLVIBLE',N'Solo se pueden devolver pedidos entregados.',409),
 (51505,'PEDIDO_INMUTABLE',N'El pedido queda congelado al momento de la compra.',409),
 (51506,'PRECIO_INMUTABLE',N'Un precio historico no se modifica.',409),
 (51507,'BITACORA_INMUTABLE',N'La bitacora no puede modificarse ni eliminarse.',409);

INSERT Seguridad.Rol (Codigo, Nombre) VALUES ('CLIENTE',N'Cliente'),('OPERADOR',N'Operador'),('ADMINISTRADOR',N'Administrador');
INSERT Seguridad.Permiso (Codigo, Descripcion) VALUES
 ('PEDIDOS_GESTIONAR',N'Preparar, despachar, cancelar y devolver pedidos'),
 ('INVENTARIO_GESTIONAR',N'Entradas, ajustes y traslados'),
 ('CATALOGO_GESTIONAR',N'Categorias, marcas y productos'),
 ('PRECIOS_GESTIONAR',N'Cambiar precios'),
 ('CUPONES_GESTIONAR',N'Administrar cupones'),
 ('USUARIOS_GESTIONAR',N'Administrar usuarios'),
 ('REPORTES_VER',N'Ver dashboard y reportes'),
 ('BITACORA_VER',N'Consultar la bitacora'),
 ('MARKETING_GESTIONAR',N'Promociones y anuncios'),
 ('CONFIG_GESTIONAR',N'Parametros, sucursales, bodegas y tarifas');
INSERT Seguridad.RolPermiso (IDRol, IDPermiso)
SELECT r.IDRol, p.IDPermiso FROM Seguridad.Rol r CROSS JOIN Seguridad.Permiso p
WHERE r.Codigo = 'ADMINISTRADOR' OR (r.Codigo = 'OPERADOR' AND p.Codigo IN ('PEDIDOS_GESTIONAR','INVENTARIO_GESTIONAR'));

DECLARE @H VARCHAR(255) = '$2b$10$r/SXTKTUcSJ0ZJ6dfXIXsOkAZUXUqKcEcABfhwF7wZqAD6qHAiBL.';
-- IDUsuario 1 es el actor de tareas automaticas; su hash invalido impide iniciar sesion.
INSERT Seguridad.Usuario (Correo, HashContrasena, Nombres, Apellidos, IDRol)
SELECT v.Correo, v.Hash, v.Nombres, v.Apellidos, r.IDRol
FROM (VALUES (1,N'sistema@shopcart.test','!',N'Sistema',N'ShopCart','ADMINISTRADOR'),
             (2,N'admin@shopcart.test',@H,N'Ana',N'Administradora','ADMINISTRADOR'),
             (3,N'operador@shopcart.test',@H,N'Oscar',N'Operador','OPERADOR'),
             (4,N'cliente1@shopcart.test',@H,N'Carla',N'Perez','CLIENTE'),
             (5,N'cliente2@shopcart.test',@H,N'Luis',N'Garcia','CLIENTE'),
             (6,N'cliente3@shopcart.test',@H,N'Marta',N'Lopez','CLIENTE')) v(Orden,Correo,Hash,Nombres,Apellidos,Rol)
JOIN Seguridad.Rol r ON r.Codigo = v.Rol
ORDER BY v.Orden;

INSERT Clientes.Departamento (Nombre) VALUES (N'Alta Verapaz'),(N'Baja Verapaz'),(N'Chimaltenango'),(N'Chiquimula'),(N'El Progreso'),(N'Escuintla'),(N'Guatemala'),
 (N'Huehuetenango'),(N'Izabal'),(N'Jalapa'),(N'Jutiapa'),(N'Petén'),(N'Quetzaltenango'),(N'Quiché'),(N'Retalhuleu'),(N'Sacatepéquez'),(N'San Marcos'),(N'Santa Rosa'),(N'Sololá'),(N'Suchitepéquez'),(N'Totonicapán'),(N'Zacapa');
INSERT Clientes.Municipio (IDDepartamento, Nombre)
SELECT d.IDDepartamento, v.Municipio FROM (VALUES (N'Guatemala',N'Guatemala'),(N'Guatemala',N'Mixco'),(N'Guatemala',N'Villa Nueva'),(N'Quetzaltenango',N'Quetzaltenango'),(N'Escuintla',N'Escuintla'),(N'Sacatepéquez',N'Antigua Guatemala'),(N'Alta Verapaz',N'Cobán'),(N'Izabal',N'Puerto Barrios'),(N'Petén',N'Flores')) v(Departamento,Municipio)
JOIN Clientes.Departamento d ON d.Nombre = v.Departamento;

INSERT Catalogo.Impuesto (Codigo, Nombre) VALUES ('IVA',N'IVA 12 %'),('EXENTO',N'Exento');
INSERT Catalogo.TasaImpuesto (IDImpuesto, Porcentaje, VigenteDesde)
SELECT IDImpuesto, CASE Codigo WHEN 'IVA' THEN 12 ELSE 0 END, '2000-01-01' FROM Catalogo.Impuesto;

INSERT Inventario.TipoMovimiento (Codigo, Nombre, Signo, ExigeMotivo) VALUES
 ('ENTRADA_COMPRA',N'Entrada por compra',1,0),('SALIDA_VENTA',N'Salida por venta',-1,0),('AJUSTE_ENTRADA',N'Ajuste positivo',1,1),('AJUSTE_SALIDA',N'Ajuste negativo',-1,1),
 ('DEVOLUCION',N'Devolucion de cliente',1,1),('CANCELACION',N'Cancelacion de pedido',1,1),('TRASLADO_SALIDA',N'Traslado, salida',-1,1),('TRASLADO_ENTRADA',N'Traslado, entrada',1,1);

INSERT Ventas.EstadoPedido (IDEstadoPedido, Codigo, Nombre, EsVentaReportable, EsCancelable) VALUES
 (1,'PAGADO',N'Pagado',0,1),(2,'EN_PREPARACION',N'En preparacion',0,1),(3,'LISTO_RECOGER',N'Listo para recoger',0,1),(4,'DESPACHADO',N'Despachado',0,0),
 (5,'ENTREGADO',N'Entregado',1,0),(6,'CANCELADO',N'Cancelado',0,0),(7,'DEVUELTO_PARCIAL',N'Devuelto parcialmente',1,0),(8,'DEVUELTO_TOTAL',N'Devuelto totalmente',0,0);
INSERT Ventas.TransicionEstadoPedido (IDEstadoOrigen, IDEstadoDestino) VALUES (1,2),(1,6),(2,3),(2,4),(2,6),(3,5),(3,6),(4,5),(5,7),(5,8),(7,8);

INSERT Ventas.MetodoPago (Codigo, Nombre) VALUES ('TARJETA',N'Tarjeta de credito o debito');
INSERT Ventas.MetodoEnvio (Codigo, Nombre, EsRecogerEnTienda) VALUES ('DOMICILIO',N'Envio a domicilio',0),('RECOGER',N'Recoger en tienda',1);
INSERT Ventas.TarifaEnvio (IDMetodoEnvio, IDDepartamento, Costo, MontoEnvioGratis, DiasEstimados)
SELECT m.IDMetodoEnvio, d.IDDepartamento, CASE d.Nombre WHEN N'Guatemala' THEN 25 ELSE 45 END, 1000, CASE d.Nombre WHEN N'Guatemala' THEN 1 ELSE 3 END
FROM Ventas.MetodoEnvio m CROSS JOIN Clientes.Departamento d WHERE m.Codigo = 'DOMICILIO';

DECLARE @MGua INT = (SELECT IDMunicipio FROM Clientes.Municipio WHERE Nombre = N'Guatemala'), @MXela INT = (SELECT IDMunicipio FROM Clientes.Municipio WHERE Nombre = N'Quetzaltenango');
INSERT Inventario.Sucursal (Codigo, Nombre, IDMunicipio, Direccion, Telefono, Horario) VALUES
 ('SUC-Z10',N'Tienda Zona 10',@MGua,N'Diagonal 6, zona 10','22000001',N'L-S 9:00-19:00'),
 ('SUC-XELA',N'Tienda Xela',@MXela,N'Calle Rodolfo Robles, zona 1','77000001',N'L-S 9:00-18:00');
INSERT Inventario.Bodega (IDSucursal, Codigo, Nombre, PermiteVentaEnLinea, Prioridad)
SELECT NULL,'CD-01',N'Centro de distribucion',1,10
UNION ALL SELECT IDSucursal,'BOD-Z10',N'Bodega Zona 10',1,20 FROM Inventario.Sucursal WHERE Codigo = 'SUC-Z10'
UNION ALL SELECT IDSucursal,'BOD-XELA',N'Bodega Xela',1,30 FROM Inventario.Sucursal WHERE Codigo = 'SUC-XELA';

INSERT Catalogo.Categoria (Nombre, Slug, Orden) VALUES (N'Computación','computacion',1),(N'Celulares','celulares',2),(N'Audio','audio',3),(N'Ropa','ropa',4);
INSERT Catalogo.Categoria (IDCategoriaPadre, Nombre, Slug, Orden)
SELECT IDCategoria, N'Notebooks','notebooks',1 FROM Catalogo.Categoria WHERE Slug = 'computacion'
UNION ALL SELECT IDCategoria, N'Accesorios','accesorios-computo',2 FROM Catalogo.Categoria WHERE Slug = 'computacion';
INSERT Catalogo.Marca (Nombre, Slug) VALUES (N'Asus','asus'),(N'Samsung','samsung'),(N'JBL','jbl'),(N'Logitech','logitech'),(N'ShopCart Basics','shopcart-basics');
INSERT Catalogo.Atributo (Nombre) VALUES (N'Color'),(N'Talla'),(N'Almacenamiento'),(N'RAM');
INSERT Catalogo.ValorAtributo (IDAtributo, Valor)
SELECT a.IDAtributo, v.Valor FROM (VALUES (N'Color',N'Negro'),(N'Color',N'Blanco'),(N'Color',N'Azul'),(N'Talla',N'S'),(N'Talla',N'M'),(N'Talla',N'L'),(N'Almacenamiento',N'128 GB'),(N'Almacenamiento',N'256 GB'),(N'Almacenamiento',N'512 GB'),(N'RAM',N'8 GB'),(N'RAM',N'16 GB')) v(Atributo,Valor)
JOIN Catalogo.Atributo a ON a.Nombre = v.Atributo;

DECLARE @IVA SMALLINT = (SELECT IDImpuesto FROM Catalogo.Impuesto WHERE Codigo = 'IVA');
INSERT Catalogo.Producto (IDCategoria, IDMarca, IDImpuesto, Nombre, Slug, Descripcion, MesesGarantia)
SELECT c.IDCategoria, m.IDMarca, @IVA, v.Nombre, v.Slug, v.Descripcion, v.Garantia
FROM (VALUES ('notebooks','asus',N'Notebook Asus Vivobook 15','asus-vivobook-15',N'Notebook de 15.6 pulgadas para trabajo y estudio.',12),
             ('celulares','samsung',N'Samsung Galaxy A55','samsung-galaxy-a55',N'Pantalla AMOLED y camara de 50 MP.',12),
             ('audio','jbl',N'Audifonos JBL Tune 520BT','jbl-tune-520bt',N'Audifonos inalambricos con 57 horas de bateria.',6),
             ('accesorios-computo','logitech',N'Mouse Logitech M185','logitech-m185',N'Mouse inalambrico compacto.',6),
             ('ropa','shopcart-basics',N'Playera ShopCart Basics','playera-basics',N'Playera de algodon.',0)) v(Categoria,Marca,Nombre,Slug,Descripcion,Garantia)
JOIN Catalogo.Categoria c ON c.Slug = v.Categoria JOIN Catalogo.Marca m ON m.Slug = v.Marca;

DECLARE @V TABLE (SKU VARCHAR(40), Slug VARCHAR(220), Precio DECIMAL(18,2), Costo DECIMAL(18,4), Valores NVARCHAR(100), Stock INT);
INSERT @V VALUES ('NB-VIVO-8-256','asus-vivobook-15',5999.00,4500,N'8 GB|256 GB',20),('NB-VIVO-16-512','asus-vivobook-15',7499.00,5700,N'16 GB|512 GB',12),
 ('CEL-A55-128-NEG','samsung-galaxy-a55',3299.00,2500,N'128 GB|Negro',30),('CEL-A55-256-AZU','samsung-galaxy-a55',3699.00,2800,N'256 GB|Azul',18),
 ('AUD-T520-NEG','jbl-tune-520bt',449.00,290,N'Negro',50),('AUD-T520-BLA','jbl-tune-520bt',449.00,290,N'Blanco',40),
 ('MOU-M185-NEG','logitech-m185',99.99,55.5,N'Negro',100),
 ('PLY-BAS-S','playera-basics',79.00,35,N'S',60),('PLY-BAS-M','playera-basics',79.00,35,N'M',60),('PLY-BAS-L','playera-basics',79.00,35,N'L',60);
INSERT Catalogo.Variante (IDProducto, SKU) SELECT p.IDProducto, v.SKU FROM @V v JOIN Catalogo.Producto p ON p.Slug = v.Slug;
INSERT Catalogo.PrecioVariante (IDVariante, Precio, VigenteDesde, IDUsuario)
SELECT c.IDVariante, v.Precio, '2026-01-01', 2 FROM @V v JOIN Catalogo.Variante c ON c.SKU = v.SKU;
INSERT Catalogo.VarianteValorAtributo (IDVariante, IDValorAtributo)
SELECT DISTINCT c.IDVariante, va.IDValorAtributo FROM @V v JOIN Catalogo.Variante c ON c.SKU = v.SKU
CROSS APPLY STRING_SPLIT(v.Valores, N'|') s JOIN Catalogo.ValorAtributo va ON va.Valor = s.[value];

DECLARE @IDV INT, @Stock INT, @Costo DECIMAL(18,4), @CD INT = (SELECT IDBodega FROM Inventario.Bodega WHERE Codigo = 'CD-01'), @Z10 INT = (SELECT IDBodega FROM Inventario.Bodega WHERE Codigo = 'BOD-Z10'), @Mitad INT;
DECLARE cs CURSOR LOCAL FAST_FORWARD FOR SELECT c.IDVariante, v.Stock, v.Costo FROM @V v JOIN Catalogo.Variante c ON c.SKU = v.SKU;
OPEN cs;
FETCH NEXT FROM cs INTO @IDV, @Stock, @Costo;
WHILE @@FETCH_STATUS = 0
BEGIN
    SET @Mitad = @Stock / 2;
    EXEC Interno.SP_Inventario_RegistrarMovimiento @IDV, @CD, 'ENTRADA_COMPRA', @Stock, N'Inventario inicial', 2, @CostoUnitario = @Costo, @ReferenciaDocumento = N'INI-0001';
    EXEC Interno.SP_Inventario_RegistrarMovimiento @IDV, @Z10, 'ENTRADA_COMPRA', @Mitad, N'Inventario inicial', 2, @CostoUnitario = @Costo, @ReferenciaDocumento = N'INI-0001';
    FETCH NEXT FROM cs INTO @IDV, @Stock, @Costo;
END;
CLOSE cs; DEALLOCATE cs;

DECLARE @Hoy DATETIME2(3) = SYSUTCDATETIME();
INSERT Marketing.Cupon (Codigo, Descripcion, TipoDescuento, Valor, MontoMinimo, VigenteDesde, VigenteHasta, LimiteTotal, LimitePorCliente, IDCategoria)
SELECT 'BIENVENIDA10',N'10 % en tu primera compra','PORCENTAJE',10,100,DATEADD(YEAR,-1,@Hoy),DATEADD(YEAR,1,@Hoy),1000,1,NULL
UNION ALL SELECT 'AUDIO50',N'Q50 en audio','MONTO',50,300,DATEADD(YEAR,-1,@Hoy),DATEADD(YEAR,1,@Hoy),100,2,IDCategoria FROM Catalogo.Categoria WHERE Slug = 'audio'
UNION ALL SELECT 'VENCIDO',N'Cupon de prueba vencido','PORCENTAJE',20,0,DATEADD(YEAR,-2,@Hoy),DATEADD(YEAR,-1,@Hoy),10,1,NULL;
INSERT Marketing.Promocion (Nombre, Slug, TipoDescuento, Valor, VigenteDesde, VigenteHasta)
VALUES (N'Semana del audio','semana-audio','PORCENTAJE',15,DATEADD(DAY,-7,@Hoy),DATEADD(MONTH,3,@Hoy));
INSERT Marketing.PromocionAlcance (IDPromocion, IDMarca) SELECT p.IDPromocion, m.IDMarca FROM Marketing.Promocion p CROSS JOIN Catalogo.Marca m WHERE p.Slug = 'semana-audio' AND m.Slug = 'jbl';
INSERT Marketing.ZonaAnuncio (Codigo, Nombre, MaximoVisible) VALUES ('HOME_HERO',N'Carrusel principal',6),('HOME_TIRA',N'Tira bajo el carrusel',3),('CATEGORIA_LATERAL',N'Lateral de categoria',2);
INSERT Marketing.Anuncio (IDZonaAnuncio, IDPromocion, Titulo, Subtitulo, ImagenEscritorioUrl, UrlDestino, VigenteDesde, VigenteHasta)
SELECT z.IDZonaAnuncio, p.IDPromocion, N'Semana del audio', N'15 % en JBL', N'/img/anuncios/audio.webp', N'/promociones/semana-audio', p.VigenteDesde, p.VigenteHasta
FROM Marketing.ZonaAnuncio z CROSS JOIN Marketing.Promocion p WHERE z.Codigo = 'HOME_HERO';

INSERT Clientes.Direccion (IDUsuario, IDMunicipio, Alias, Destinatario, Telefono, Linea1, EsPredeterminada)
SELECT u.IDUsuario, @MGua, N'Casa', CONCAT(u.Nombres, N' ', u.Apellidos), '55550000', N'4a avenida 10-20, zona 1', 1
FROM Seguridad.Usuario u WHERE u.Correo LIKE N'cliente%';
GO
/* Historial de pedidos con el flujo real. */
DECLARE @i INT = 1, @Cliente INT, @Var INT, @Dir INT, @IDCheckout BIGINT, @Total DECIMAL(18,2), @IDPedido BIGINT, @Env SMALLINT = (SELECT IDMetodoEnvio FROM Ventas.MetodoEnvio WHERE Codigo = 'DOMICILIO'),
        @Pago SMALLINT = (SELECT IDMetodoPago FROM Ventas.MetodoPago WHERE Codigo = 'TARJETA'), @Ref VARCHAR(100), @H BINARY(32) = HASHBYTES('SHA2_256', 'semilla'), @Llave UNIQUEIDENTIFIER, @Det BIGINT, @J NVARCHAR(200);
DECLARE @Salida TABLE (a BIGINT, b DECIMAL(18,2), c DECIMAL(18,2), d DECIMAL(18,2), e DECIMAL(18,2), f VARCHAR(12), g DATETIME2(3));
WHILE @i <= 24
BEGIN
    SET @Cliente = 4 + (@i % 3);
    SELECT @Var = IDVariante FROM Catalogo.Variante ORDER BY IDVariante OFFSET (@i % 10) ROWS FETCH NEXT 1 ROWS ONLY;
    SELECT @Dir = IDDireccion FROM Clientes.Direccion WHERE IDUsuario = @Cliente;
    EXEC Interno.SP_Carrito_EscribirLinea @Cliente, NULL, @Var, 1, 1;
    SET @Llave = NEWID();
    DELETE @Salida;
    INSERT @Salida EXEC Api.SP_Checkout_IniciarPago @Cliente, @Llave, @H, @Env, @Dir, NULL;
    SELECT @IDCheckout = a, @Total = e FROM @Salida;
    SET @Ref = CONCAT('SEMILLA-', @i);
    SET @Llave = NEWID();
    DECLARE @P TABLE (IDPedido BIGINT, Numero VARCHAR(20), Total DECIMAL(18,2), Estado VARCHAR(30));
    DELETE @P;
    INSERT @P EXEC Api.SP_Pedidos_CrearPedido @Cliente, @IDCheckout, @Llave, @H, @Pago, @Ref, @Total;
    SELECT @IDPedido = IDPedido FROM @P;
    IF @i % 8 = 0
        EXEC Api.SP_Pedidos_CancelarPedido 3, @IDPedido, N'Cancelado por el cliente';
    ELSE IF @i % 5 <> 0
    BEGIN
        EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'EN_PREPARACION';
        EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'DESPACHADO';
        EXEC Api.SP_Pedidos_CambiarEstado 3, @IDPedido, 'ENTREGADO';
        IF @i % 7 = 0
        BEGIN
            SELECT @Det = IDPedidoDetalle FROM Ventas.PedidoDetalle WHERE IDPedido = @IDPedido;
            SET @J = CONCAT(N'[{"IDPedidoDetalle":', @Det, N',"Cantidad":1,"ReingresaInventario":true}]');
            DECLARE @D TABLE (a BIGINT, b DECIMAL(18,2), c VARCHAR(30));
            INSERT @D EXEC Api.SP_Pedidos_CrearDevolucion 3, @IDPedido, N'Cliente insatisfecho', @J;
        END;
    END;
    SET @i += 1;
END;
GO
-- Unica excepcion a la inmutabilidad: repartir la semilla en 47 dias para que el dashboard tenga historia.
DISABLE TRIGGER Ventas.TR_Pedido_Estado ON Ventas.Pedido;
UPDATE Ventas.Pedido SET FechaPedido = DATEADD(DAY, -(IDPedido * 2 - 1), FechaPedido);
ENABLE TRIGGER Ventas.TR_Pedido_Estado ON Ventas.Pedido;
GO
