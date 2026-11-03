// Prueba de punta a punta contra un API en marcha y una BD con la semilla.
// Uso: node tests/e2e/flujo-real.mjs [http://localhost:3000]
import { randomUUID } from 'node:crypto';

const BASE = `${process.argv[2] ?? 'http://localhost:3000'}/api/v1`;
const CONTRASENA = 'ShopCart#2026';
let fallas = 0;
let aciertos = 0;

function comprobar(nombre, condicion, detalle = '') {
  if (condicion) aciertos += 1;
  else fallas += 1;
  console.log(`${condicion ? 'OK   ' : 'FALLA'} ${nombre}${condicion ? '' : `  -> ${JSON.stringify(detalle)}`}`);
}

async function api(metodo, ruta, { token, body, llave, cookie } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (llave) headers['Idempotency-Key'] = llave;
  if (cookie) headers.Cookie = cookie;
  const r = await fetch(`${BASE}${ruta}`, { method: metodo, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  const texto = await r.text();
  return { status: r.status, json: texto ? JSON.parse(texto) : undefined, cookies: r.headers.getSetCookie() };
}

const codigo = (r) => r.json?.error?.codigo;

async function entrar(correo) {
  const r = await api('POST', '/auth/login', { body: { correo, contrasena: CONTRASENA } });
  if (r.status !== 200) throw new Error(`Login de ${correo}: ${r.status} ${JSON.stringify(r.json)}`);
  const id = r.json.data.usuario.idUsuario;
  const cookie = r.cookies.find((c) => c.startsWith('sc_refresh='))?.split(';')[0];
  return { token: r.json.data.accessToken, id, cookie };
}

async function vaciarCarrito(token) {
  const c = await api('GET', '/carrito', { token });
  for (const l of c.json.data.lineas) await api('DELETE', `/carrito/items/${l.IDVariante}`, { token });
  await api('DELETE', '/carrito/cupon', { token });
}

const direccionDe = async (token) => (await api('GET', '/clientes/direcciones', { token })).json.data[0].IDDireccion;
const skuVariante = async (slug, sku) => (await api('GET', `/catalogo/productos/${slug}`)).json.data.variantes.find((v) => v.SKU === sku);

async function pruebasAcceso(admin, operador, cliente) {
  console.log('\n# Acceso');
  comprobar('sin token responde 401', (await api('GET', '/pedidos/mios')).status === 401);
  comprobar('cliente sin permiso responde 403', (await api('GET', '/reportes/bitacora', { token: cliente.token })).status === 403);
  comprobar('operador no ve bitacora', (await api('GET', '/reportes/bitacora', { token: operador.token })).status === 403);
  comprobar('operador si ve inventario', (await api('GET', '/inventario/existencias', { token: operador.token })).status === 200);
  comprobar('admin ve bitacora', (await api('GET', '/reportes/bitacora?modulo=PRECIOS', { token: admin.token })).status === 200);
  comprobar('cliente no cambia precios', (await api('PUT', '/catalogo/variantes/1/precio', { token: cliente.token, body: { precio: 1 } })).status === 403);
}

async function pruebasCatalogo() {
  console.log('\n# Catalogo');
  const b = await api('GET', '/catalogo/productos?texto=samsung&tamanoPagina=5');
  comprobar('busqueda por texto', b.status === 200 && b.json.data.length >= 1, b.json);
  const orden = await api('GET', '/catalogo/productos?orden=PRECIO_ASC&soloDisponibles=true');
  const precios = orden.json.data.map((p) => p.PrecioDesde);
  comprobar('ordena por precio', precios.every((p, i) => i === 0 || precios[i - 1] <= p), precios);
  const promo = await api('GET', '/catalogo/productos/jbl-tune-520bt');
  comprobar('aplica la promocion automatica', promo.json.data.variantes[0].PrecioFinal === 381.65, promo.json.data.variantes[0]);
  const zona = await api('GET', '/marketing/anuncios/vigentes?zona=HOME_HERO');
  comprobar('anuncios vigentes', zona.status === 200 && zona.json.data.length >= 1, zona.json);
}

async function pruebasCompra(operador, c1, c2) {
  console.log('\n# Compra');
  await vaciarCarrito(c1.token);
  const mouse = await skuVariante('logitech-m185', 'MOU-M185-NEG');
  const playera = await skuVariante('playera-basics', 'PLY-BAS-M');
  await api('POST', '/carrito/items', { token: c1.token, body: { idVariante: mouse.IDVariante, cantidad: 3 } });
  await api('POST', '/carrito/items', { token: c1.token, body: { idVariante: playera.IDVariante, cantidad: 2 } });
  const exceso = await api('POST', '/carrito/items', { token: c1.token, body: { idVariante: playera.IDVariante, cantidad: 999 } });
  comprobar('no agrega mas que la existencia', codigo(exceso) === 'EXISTENCIA_INSUFICIENTE', exceso.json);
  const vencido = await api('POST', '/carrito/cupon', { token: c1.token, body: { codigo: 'VENCIDO' } });
  comprobar('cupon vencido con mensaje especifico', codigo(vencido) === 'CUPON_VENCIDO', vencido.json);

  const carrito = await api('GET', '/carrito', { token: c1.token });
  comprobar('subtotal sin error de redondeo', carrito.json.data.resumen.Subtotal === 457.97, carrito.json.data.resumen);

  const idDireccion = await direccionDe(c1.token);
  const ajena = await direccionDe(c2.token);
  const robo = await api('POST', '/checkout', { token: c1.token, llave: randomUUID(), body: { idMetodoEnvio: 1, idDireccion: ajena } });
  comprobar('no acepta direccion ajena', codigo(robo) === 'DESTINO_INVALIDO', robo.json);

  const llave = randomUUID();
  const inicio = await api('POST', '/checkout', { token: c1.token, llave, body: { idMetodoEnvio: 1, idDireccion } });
  const repetido = await api('POST', '/checkout', { token: c1.token, llave, body: { idMetodoEnvio: 1, idDireccion } });
  comprobar('iniciar pago crea checkout', inicio.status === 201, inicio.json);
  comprobar('repetir la llave da el mismo checkout', inicio.json.data?.IDCheckout === repetido.json.data?.IDCheckout, repetido.json);
  const distinto = await api('POST', '/checkout', { token: c1.token, llave, body: { idMetodoEnvio: 2, idSucursalRecoger: 1 } });
  comprobar('misma llave con otro contenido responde 409', codigo(distinto) === 'IDEMPOTENCIA_CONFLICTO', distinto.json);

  const id = inicio.json.data.IDCheckout;
  const rechazo = await api('POST', `/checkout/${id}/pagar`, { token: c1.token, llave: randomUUID(), body: { idMetodoPago: 1, tokenPago: 'tok_rechazada' } });
  comprobar('pago rechazado responde 402', rechazo.status === 402, rechazo.json);

  const pagar = (k) => api('POST', `/checkout/${id}/pagar`, { token: c1.token, llave: k, body: { idMetodoPago: 1, tokenPago: 'tok_visa' } });
  const llavePago = randomUUID();
  const pagos = await Promise.all([pagar(llavePago), pagar(llavePago), pagar(randomUUID())]);
  const pedidos = new Set(pagos.map((p) => p.json.data?.IDPedido));
  comprobar('doble clic: todos responden bien', pagos.every((p) => p.status === 201), pagos.map((p) => [p.status, p.json]));
  comprobar('doble clic: un solo pedido', pedidos.size === 1 && !pedidos.has(undefined), [...pedidos]);

  const idPedido = pagos[0].json.data.IDPedido;
  comprobar('pedido ajeno responde 404', (await api('GET', `/pedidos/${idPedido}`, { token: c2.token })).status === 404);
  const detalle = await api('GET', `/pedidos/${idPedido}`, { token: c1.token });
  const { pedido, lineas, historial } = detalle.json.data;
  const sumaLineas = Math.round(lineas.reduce((s, l) => s + l.TotalLinea, 0) * 100) / 100;
  comprobar('lineas y envio cuadran con el total', Math.round((sumaLineas + pedido.CostoEnvio) * 100) / 100 === pedido.Total, { sumaLineas, pedido });
  comprobar('base mas IVA da el total', Math.round((pedido.BaseImponible + pedido.IVA) * 100) / 100 === pedido.Total, pedido);
  comprobar('historial registra la creacion', historial.length === 1 && historial[0].EstadoNuevo === 'PAGADO', historial);

  console.log('\n# Ciclo del pedido');
  const estado = (e) => api('PATCH', `/pedidos/${idPedido}/estado`, { token: operador.token, body: { estado: e } });
  comprobar('salto de estado rechazado', codigo(await estado('ENTREGADO')) === 'TRANSICION_NO_PERMITIDA');
  comprobar('cliente no avanza estados', (await api('PATCH', `/pedidos/${idPedido}/estado`, { token: c1.token, body: { estado: 'EN_PREPARACION' } })).status === 403);
  await estado('EN_PREPARACION');
  await estado('DESPACHADO');
  const tarde = await api('POST', `/pedidos/${idPedido}/cancelar`, { token: operador.token, body: { motivo: 'Tarde' } });
  comprobar('no cancela despachado', codigo(tarde) === 'PEDIDO_NO_CANCELABLE', tarde.json);
  await estado('ENTREGADO');
  const linea = lineas.find((l) => l.SKU === 'MOU-M185-NEG');
  const excede = await api('POST', `/pedidos/${idPedido}/devoluciones`, { token: operador.token, body: { motivo: 'Excede', lineas: [{ idPedidoDetalle: linea.IDPedidoDetalle, cantidad: 4 }] } });
  comprobar('no devuelve mas de lo vendido', codigo(excede) === 'DEVOLUCION_EXCEDE', excede.json);
  const dev = await api('POST', `/pedidos/${idPedido}/devoluciones`, { token: operador.token, body: { motivo: 'Parcial', lineas: [{ idPedidoDetalle: linea.IDPedidoDetalle, cantidad: 1 }] } });
  comprobar('devolucion parcial', dev.status === 201 && dev.json.data.Estado === 'DEVUELTO_PARCIAL', dev.json);
}

async function pruebasConcurrencia(admin, clientes) {
  console.log('\n# Concurrencia: ultima unidad');
  const marca = Date.now();
  const categorias = (await api('GET', '/catalogo/categorias')).json.data;
  const creado = await api('POST', '/catalogo/productos', { token: admin.token, body: { idCategoria: categorias[0].IDCategoria, nombre: `Prueba ${marca}`, slug: `prueba-${marca}` } });
  const variante = await api('POST', `/catalogo/productos/${creado.json.data.idProducto}/variantes`, { token: admin.token, body: { sku: `PRB-${marca}`, precio: 100 } });
  const idVariante = variante.json.data.idVariante;
  const bodega = (await api('GET', '/inventario/bodegas', { token: admin.token })).json.data[0].IDBodega;
  await api('POST', '/inventario/entradas', { token: admin.token, body: { idVariante, idBodega: bodega, cantidad: 1, costoUnitario: 50 } });

  const direcciones = [];
  for (const c of clientes) {
    await vaciarCarrito(c.token);
    const r = await api('POST', '/carrito/items', { token: c.token, body: { idVariante, cantidad: 1 } });
    comprobar('los clientes pueden agregar la ultima unidad', r.status === 200, r.json);
    direcciones.push(await direccionDe(c.token));
  }
  const intentos = await Promise.all(clientes.map((c, i) => api('POST', '/checkout', { token: c.token, llave: randomUUID(), body: { idMetodoEnvio: 1, idDireccion: direcciones[i] } })));
  const ganadores = intentos.filter((r) => r.status === 201);
  comprobar('solo un cliente reserva la ultima unidad', ganadores.length === 1, intentos.map((r) => [r.status, r.json]));
  comprobar('los demas reciben un mensaje claro', intentos.filter((r) => r.status !== 201).every((r) => codigo(r) === 'EXISTENCIA_INSUFICIENTE'), intentos.map((r) => r.json));
  const existencia = (await api('GET', `/catalogo/productos/prueba-${marca}`)).json.data.variantes[0];
  comprobar('disponible queda en cero', existencia.Disponible === 0, existencia);
  const iGanador = intentos.findIndex((r) => r.status === 201);
  await api('DELETE', `/checkout/${intentos[iGanador].json.data.IDCheckout}`, { token: clientes[iGanador].token });
  const liberada = (await api('GET', `/catalogo/productos/prueba-${marca}`)).json.data.variantes[0];
  comprobar('cancelar el checkout libera la unidad', liberada.Disponible === 1, liberada);

  console.log('\n# Concurrencia: limite de cupon');
  const ahora = Date.now();
  const cupon = `PRB${marca}`;
  await api('POST', '/cupones', { token: admin.token, body: { codigo: cupon, tipoDescuento: 'MONTO', valor: 5, vigenteDesde: new Date(ahora - 60_000).toISOString(), vigenteHasta: new Date(ahora + 3_600_000).toISOString(), limiteTotal: 1 } });
  const mouse = await skuVariante('logitech-m185', 'MOU-M185-NEG');
  for (const c of clientes) {
    await vaciarCarrito(c.token);
    await api('POST', '/carrito/items', { token: c.token, body: { idVariante: mouse.IDVariante, cantidad: 1 } });
    await api('POST', '/carrito/cupon', { token: c.token, body: { codigo: cupon } });
  }
  const usos = await Promise.all(clientes.map((c, i) => api('POST', '/checkout', { token: c.token, llave: randomUUID(), body: { idMetodoEnvio: 1, idDireccion: direcciones[i] } })));
  comprobar('el limite total se respeta', usos.filter((r) => r.status === 201).length === 1, usos.map((r) => [r.status, r.json]));
  comprobar('los demas reciben cupon agotado', usos.filter((r) => r.status !== 201).every((r) => codigo(r) === 'CUPON_AGOTADO'), usos.map((r) => r.json));
  for (const [i, r] of usos.entries()) if (r.status === 201) await api('DELETE', `/checkout/${r.json.data.IDCheckout}`, { token: clientes[i].token });
  for (const c of clientes) await vaciarCarrito(c.token);
  await api('DELETE', `/catalogo/productos/${creado.json.data.idProducto}`, { token: admin.token });
}

async function pruebasSesion(sesion) {
  console.log('\n# Sesion');
  const uno = await api('POST', '/auth/refresh', { cookie: sesion.cookie });
  comprobar('refresh entrega nuevo access token', uno.status === 200 && Boolean(uno.json.data.accessToken), uno.json);
  const nueva = uno.cookies.find((c) => c.startsWith('sc_refresh='))?.split(';')[0];
  comprobar('el refresh token rota', nueva && nueva !== sesion.cookie);
  const robo = await api('POST', '/auth/refresh', { cookie: sesion.cookie });
  comprobar('reutilizar el token viejo se detecta', codigo(robo) === 'TOKEN_REUTILIZADO', robo.json);
  const familia = await api('POST', '/auth/refresh', { cookie: nueva });
  comprobar('la familia completa queda revocada', familia.status === 401, familia.json);
}

async function pruebasReportes(admin, operador) {
  console.log('\n# Reportes e integridad');
  const hoy = new Date();
  const hasta = new Date(hoy.getTime() + 86_400_000).toISOString().slice(0, 10);
  const desde = new Date(hoy.getTime() - 60 * 86_400_000).toISOString().slice(0, 10);
  const inicio = Date.now();
  const resumen = await api('GET', `/reportes/dashboard/resumen?desde=${desde}&hasta=${hasta}`, { token: admin.token });
  comprobar('resumen del dashboard', resumen.status === 200 && resumen.json.data.NumeroPedidos > 0, resumen.json);
  comprobar('responde en menos de 1 segundo', Date.now() - inicio < 1000, Date.now() - inicio);
  for (const [nombre, ruta] of [['ventas', `ventas?desde=${desde}&hasta=${hasta}&agrupacion=SEMANA`], ['categorias', `categorias?desde=${desde}&hasta=${hasta}`], ['top', `top-productos?desde=${desde}&hasta=${hasta}`], ['margen', `margen?desde=${desde}&hasta=${hasta}`], ['abandonados', 'carritos-abandonados']]) {
    const r = await api('GET', `/reportes/dashboard/${ruta}`, { token: admin.token });
    comprobar(`reporte ${nombre}`, r.status === 200, r.json);
  }
  const bitacora = await api('GET', '/reportes/bitacora?modulo=INVENTARIO&tamanoPagina=1', { token: admin.token });
  comprobar('la bitacora registro movimientos', bitacora.json.meta?.total > 0, bitacora.json);
  const conciliacion = await api('GET', '/inventario/conciliacion', { token: operador.token });
  comprobar('existencia coincide con kardex', conciliacion.json.data?.cuadrado === true, conciliacion.json);
}

const admin = await entrar('admin@shopcart.test');
const operador = await entrar('operador@shopcart.test');
const clientes = [await entrar('cliente1@shopcart.test'), await entrar('cliente2@shopcart.test'), await entrar('cliente3@shopcart.test')];
const [c1, c2] = clientes;

for (const bloque of [
  () => pruebasAcceso(admin, operador, c1),
  () => pruebasCatalogo(),
  () => pruebasCompra(operador, c1, c2),
  () => pruebasConcurrencia(admin, clientes),
  () => pruebasReportes(admin, operador),
  () => pruebasSesion(c2),
]) {
  try {
    await bloque();
  } catch (error) {
    fallas += 1;
    console.log(`FALLA bloque detenido: ${error.message}`);
  }
}

console.log(`\n${aciertos} correctas, ${fallas} fallas`);
process.exit(fallas ? 1 : 0);
