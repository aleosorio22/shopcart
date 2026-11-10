import type { Router } from 'express';
import rateLimit from 'express-rate-limit';
import type { RequestHandler } from 'express';
import type { Logger } from 'pino';
import type { SqlGateway } from './core/db/sql-gateway.js';
import { crearRouter, type RutaDefinida } from './core/http/route.js';
import { AuthService } from './modules/auth/application/auth.service.js';
import type { EmisorTokens, HasherContrasena } from './modules/auth/domain/auth.ports.js';
import { rutasAuth } from './modules/auth/http/auth.routes.js';
import { AuthSqlRepository } from './modules/auth/infrastructure/auth.sql-repository.js';
import { CarritoService } from './modules/carrito/application/carrito.service.js';
import { rutasCarrito } from './modules/carrito/http/carrito.routes.js';
import { CarritoSqlRepository } from './modules/carrito/infrastructure/carrito.sql-repository.js';
import { CatalogoService } from './modules/catalogo/application/catalogo.service.js';
import { rutasCatalogo } from './modules/catalogo/http/catalogo.routes.js';
import { CatalogoSqlRepository } from './modules/catalogo/infrastructure/catalogo.sql-repository.js';
import type { AlmacenImagenes } from './modules/catalogo/domain/catalogo.js';
import { CheckoutService } from './modules/checkout/application/checkout.service.js';
import type { PasarelaPago } from './modules/checkout/domain/checkout.js';
import { rutasCheckout } from './modules/checkout/http/checkout.routes.js';
import { CheckoutSqlRepository } from './modules/checkout/infrastructure/checkout.sql-repository.js';
import { ClientesService } from './modules/clientes/application/clientes.service.js';
import { rutasClientes } from './modules/clientes/http/clientes.routes.js';
import { ClientesSqlRepository } from './modules/clientes/infrastructure/clientes.sql-repository.js';
import { ConfiguracionService } from './modules/configuracion/application/configuracion.service.js';
import { rutasConfiguracion } from './modules/configuracion/http/configuracion.routes.js';
import { ConfiguracionSqlRepository } from './modules/configuracion/infrastructure/configuracion.sql-repository.js';
import { CuponesService } from './modules/cupones/application/cupones.service.js';
import { rutasCupones } from './modules/cupones/http/cupones.routes.js';
import { CuponesSqlRepository } from './modules/cupones/infrastructure/cupones.sql-repository.js';
import { InventarioService } from './modules/inventario/application/inventario.service.js';
import { rutasInventario } from './modules/inventario/http/inventario.routes.js';
import { InventarioSqlRepository } from './modules/inventario/infrastructure/inventario.sql-repository.js';
import { MarketingService } from './modules/marketing/application/marketing.service.js';
import { rutasMarketing } from './modules/marketing/http/marketing.routes.js';
import { MarketingSqlRepository } from './modules/marketing/infrastructure/marketing.sql-repository.js';
import { PedidosService } from './modules/pedidos/application/pedidos.service.js';
import { rutasPedidos } from './modules/pedidos/http/pedidos.routes.js';
import { PedidosSqlRepository } from './modules/pedidos/infrastructure/pedidos.sql-repository.js';
import { ReportesService } from './modules/reportes/application/reportes.service.js';
import { rutasReportes } from './modules/reportes/http/reportes.routes.js';
import { ReportesSqlRepository } from './modules/reportes/infrastructure/reportes.sql-repository.js';
import { UsuariosService } from './modules/usuarios/application/usuarios.service.js';
import { rutasUsuarios } from './modules/usuarios/http/usuarios.routes.js';
import { UsuariosSqlRepository } from './modules/usuarios/infrastructure/usuarios.sql-repository.js';

const API = '/api/v1';
const MINUTO = 60_000;

export interface Dependencias {
  db: SqlGateway;
  hasher: HasherContrasena;
  tokens: EmisorTokens;
  pasarela: PasarelaPago;
  logger: Logger;
  diasVidaRefresh: number;
  cookieSegura: boolean;
  almacenImagenes: AlmacenImagenes;
  limiteCredenciales?: number;
}

const limitar = (limit: number): RequestHandler =>
  rateLimit({ windowMs: MINUTO, limit, standardHeaders: 'draft-8', legacyHeaders: false, message: { success: false, error: { codigo: 'DEMASIADAS_SOLICITUDES', mensaje: 'Demasiados intentos. Espere un momento.' } } });

/** Raiz de composicion: el unico lugar que conoce las implementaciones concretas. */
export function componer({ db, hasher, tokens, pasarela, logger, diasVidaRefresh, cookieSegura, almacenImagenes, limiteCredenciales = 10 }: Dependencias) {
  const carrito = new CarritoService(new CarritoSqlRepository(db));
  const fusion = {
    // Fallar al unir carritos no debe impedir que alguien entre a su cuenta.
    fusionar: (idUsuario: number, hash: Buffer) => carrito.fusionar(idUsuario, hash).catch((err: unknown) => logger.error({ err, idUsuario }, 'No se pudo fusionar el carrito')),
  };
  const auth = new AuthService(new AuthSqlRepository(db), hasher, tokens, fusion, { diasVidaRefresh });
  const usuarios = new UsuariosService(new UsuariosSqlRepository(db), hasher, (id) => auth.invalidarSesion(id));

  const rutas: ReadonlyArray<readonly [string, string, RutaDefinida[]]> = [
    ['/auth', 'Autenticacion', rutasAuth({ servicio: auth, cookieSegura, limitadorCredenciales: limitar(limiteCredenciales), limitadorRefresh: limitar(limiteCredenciales * 3) })],
    ['/usuarios', 'Usuarios', rutasUsuarios(usuarios)],
    ['/clientes', 'Clientes', rutasClientes(new ClientesService(new ClientesSqlRepository(db)))],
    ['/catalogo', 'Catalogo', rutasCatalogo(new CatalogoService(new CatalogoSqlRepository(db), almacenImagenes))],
    ['/inventario', 'Inventario', rutasInventario(new InventarioService(new InventarioSqlRepository(db)))],
    ['/carrito', 'Carrito', rutasCarrito(carrito, cookieSegura)],
    ['/cupones', 'Cupones', rutasCupones(new CuponesService(new CuponesSqlRepository(db)))],
    ['/checkout', 'Checkout', rutasCheckout(new CheckoutService(new CheckoutSqlRepository(db), pasarela))],
    ['/pedidos', 'Pedidos', rutasPedidos(new PedidosService(new PedidosSqlRepository(db)))],
    ['/reportes', 'Reportes', rutasReportes(new ReportesService(new ReportesSqlRepository(db)))],
    ['/marketing', 'Marketing', rutasMarketing(new MarketingService(new MarketingSqlRepository(db)))],
    ['/configuracion', 'Configuracion', rutasConfiguracion(new ConfiguracionService(new ConfiguracionSqlRepository(db)))],
  ];

  const routers: Array<{ prefijo: string; router: Router }> = rutas.map(([modulo, etiqueta, definiciones]) => {
    const prefijo = `${API}${modulo}`;
    return { prefijo, router: crearRouter(prefijo, etiqueta, definiciones, auth) };
  });
  return { routers, auth };
}
