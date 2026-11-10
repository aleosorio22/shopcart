import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { componer } from '../src/composition.js';
import { AppError } from '../src/core/errors/app-error.js';
import { crearApp } from '../src/core/http/app.js';
import { BcryptHasher, JwtEmisorTokens } from '../src/modules/auth/infrastructure/seguridad.adapters.js';
import { PasarelaSimulada } from '../src/modules/checkout/infrastructure/pasarela-simulada.js';
import { loggerSilencioso, SqlFalso } from './apoyo.js';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const ORIGEN = 'http://localhost:5173';
const tokens = new JwtEmisorTokens(SECRETO, 900);
const PERFIL = 'Api.SP_Seguridad_ObtenerPerfil';
const LLAVE = '6f1b6b1e-3c5c-4a8e-9d0a-3f2a1c9e7b11';

/** Almacen en memoria: las pruebas no escriben en disco. */
class AlmacenFalso {
  readonly guardados: Array<{ bytes: number; formato: string }> = [];
  async guardar(contenido: Buffer, formato: string): Promise<string> {
    this.guardados.push({ bytes: contenido.length, formato });
    return `/uploads/productos/prueba.${formato}`;
  }
}

function preparar(permisos: string[] = [], rol = 'CLIENTE') {
  const db = new SqlFalso().responder(PERFIL, [[{ Rol: rol }], permisos.map((Permiso) => ({ Permiso }))]);
  const almacen = new AlmacenFalso();
  const { routers } = componer({ db, hasher: new BcryptHasher(4), tokens, pasarela: new PasarelaSimulada(), logger: loggerSilencioso, diasVidaRefresh: 7, cookieSegura: true, almacenImagenes: almacen, limiteCredenciales: 3 });
  const app = crearApp({ origenes: [ORIGEN], proxies: 0, logger: loggerSilencioso, routers, verificarSalud: async () => undefined });
  return { db, app, almacen };
}

const bearer = (idUsuario = 4) => `Bearer ${tokens.emitir(idUsuario, 'CLIENTE')}`;

describe('autenticacion y autorizacion', () => {
  it('sin token responde 401', async () => {
    const { app } = preparar();
    const r = await request(app).get('/api/v1/pedidos/mios');
    expect(r.status).toBe(401);
    expect(r.body.success).toBe(false);
  });

  it('un token expirado responde 401 TOKEN_EXPIRADO', async () => {
    const { app } = preparar();
    const expirado = new JwtEmisorTokens(SECRETO, 60);
    const token = jwt.sign({ rol: 'CLIENTE' }, SECRETO, { algorithm: 'HS256', subject: '4', issuer: 'shopcart-api', audience: 'shopcart-web', expiresIn: -10 });
    expect(() => expirado.verificar(token)).toThrow(AppError);
    const r = await request(app).get('/api/v1/pedidos/mios').set('Authorization', `Bearer ${token}`);
    expect(r.status).toBe(401);
    expect(r.body.error.codigo).toBe('TOKEN_EXPIRADO');
  });

  it('rechaza un token firmado con otra clave o con alg none', async () => {
    const { app } = preparar();
    const ajeno = jwt.sign({}, 'otra-clave-distinta-de-mas-de-32-caracteres', { subject: '1', issuer: 'shopcart-api', audience: 'shopcart-web' });
    const sinFirma = jwt.sign({}, '', { algorithm: 'none', subject: '1', issuer: 'shopcart-api', audience: 'shopcart-web' });
    for (const token of [ajeno, sinFirma]) {
      const r = await request(app).get('/api/v1/pedidos/mios').set('Authorization', `Bearer ${token}`);
      expect(r.status).toBe(401);
    }
  });

  it('sin el permiso responde 403 y no toca la BD de negocio', async () => {
    const { app, db } = preparar();
    const r = await request(app).get('/api/v1/reportes/bitacora').set('Authorization', bearer());
    expect(r.status).toBe(403);
    expect(db.llamadasA('Api.SP_Bitacora_Consultar')).toHaveLength(0);
  });

  it('con el permiso responde con datos y paginacion', async () => {
    const { app, db } = preparar(['BITACORA_VER'], 'ADMINISTRADOR');
    db.responder('Api.SP_Bitacora_Consultar', [[{ IDBitacora: 1, TotalRegistros: 40 }]]);
    const r = await request(app).get('/api/v1/reportes/bitacora?modulo=PRECIOS&pagina=2').set('Authorization', bearer());
    expect(r.status).toBe(200);
    expect(r.body).toEqual({ success: true, data: [{ IDBitacora: 1 }], meta: { total: 40, pagina: 2, tamanoPagina: 20 } });
  });

  it('el limite de intentos de login responde 429', async () => {
    const { app } = preparar();
    const intentos = Array.from({ length: 4 }, () => request(app).post('/api/v1/auth/login').send({ correo: 'a@b.test', contrasena: 'x' }));
    const respuestas = await Promise.all(intentos);
    expect(respuestas.map((r) => r.status)).toContain(429);
  });
});

describe('sesion por cookie', () => {
  let contexto: ReturnType<typeof preparar>;

  beforeEach(async () => {
    contexto = preparar();
    contexto.db.responder('Api.SP_Seguridad_ObtenerCredenciales', [[{ IDUsuario: 4, Correo: 'a@b.test', HashContrasena: await bcrypt.hash('correcta', 4), Activo: true, BloqueadoHasta: null, Rol: 'CLIENTE' }]]);
  });

  it('el refresh token solo viaja en cookie HttpOnly, Secure y SameSite=Strict', async () => {
    const r = await request(contexto.app).post('/api/v1/auth/login').send({ correo: 'A@b.test', contrasena: 'correcta' });
    expect(r.status).toBe(200);
    const cookie = String(r.headers['set-cookie']);
    expect(cookie).toMatch(/sc_refresh=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/Secure/);
    expect(cookie).toMatch(/SameSite=Strict/);
    expect(JSON.stringify(r.body)).not.toContain('refreshToken');
    expect(r.body.data.accessToken).toBeTypeOf('string');
  });

  it('refresh sin cookie responde 401', async () => {
    const r = await request(contexto.app).post('/api/v1/auth/refresh');
    expect(r.status).toBe(401);
  });
});

describe('aislamiento entre clientes', () => {
  it('la identidad sale del token aunque el body diga otra cosa', async () => {
    const { app, db } = preparar();
    await request(app).post('/api/v1/clientes/direcciones').set('Authorization', bearer(4))
      .send({ idUsuario: 99, IDUsuario: 99, idMunicipio: 1, alias: 'Casa', destinatario: 'Ana', telefono: '55550000', linea1: 'Calle 1' });
    expect(db.llamadasA('Api.SP_Clientes_GuardarDireccion')[0]?.parametros.IDUsuario?.valor).toBe(4);
  });

  it('el query no permite ver los pedidos de otro cliente', async () => {
    const { app, db } = preparar();
    await request(app).get('/api/v1/pedidos/mios?idUsuario=99').set('Authorization', bearer(4));
    expect(db.llamadasA('Api.SP_Pedidos_ListarMisPedidos')[0]?.parametros.IDUsuario?.valor).toBe(4);
  });

  it('el carrito no acepta un id en la peticion: se deduce de la sesion', async () => {
    const { app, db } = preparar();
    await request(app).post('/api/v1/carrito/items').set('Authorization', bearer(4)).send({ idCarrito: 1, idVariante: 3, cantidad: 1 });
    const { parametros } = db.llamadasA('Api.SP_Carrito_AgregarItem')[0] ?? {};
    expect(parametros?.IDUsuario?.valor).toBe(4);
    expect(parametros).not.toHaveProperty('IDCarrito');
  });

  it('el invitado recibe una cookie y a la BD solo llega su hash', async () => {
    const { app, db } = preparar();
    const r = await request(app).post('/api/v1/carrito/items').send({ idVariante: 3 });
    expect(String(r.headers['set-cookie'])).toMatch(/sc_invitado=.+HttpOnly/);
    expect(db.llamadasA('Api.SP_Carrito_AgregarItem')[0]?.parametros.HashTokenInvitado?.valor).toBeInstanceOf(Buffer);
  });
});

describe('robustez HTTP', () => {
  it('datos invalidos responden 400 con detalle por campo', async () => {
    const { app } = preparar();
    const r = await request(app).post('/api/v1/auth/registro').send({ correo: 'no-es-correo', contrasena: 'corta' });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('DATOS_INVALIDOS');
    expect(r.body.error.detalles.map((d: { campo: string }) => d.campo)).toContain('correo');
  });

  it('checkout exige Idempotency-Key', async () => {
    const { app, db } = preparar();
    const r = await request(app).post('/api/v1/checkout').set('Authorization', bearer()).send({ idMetodoEnvio: 1, idDireccion: 1 });
    expect(r.status).toBe(400);
    expect(r.body.error.codigo).toBe('IDEMPOTENCY_KEY_REQUERIDA');
    expect(db.llamadasA('Api.SP_Checkout_IniciarPago')).toHaveLength(0);
  });

  it('checkout pasa la llave al SP', async () => {
    const { app, db } = preparar();
    db.responder('Api.SP_Checkout_IniciarPago', [[{ IDCheckout: 1, Total: 10 }]]);
    const r = await request(app).post('/api/v1/checkout').set('Authorization', bearer()).set('Idempotency-Key', LLAVE).send({ idMetodoEnvio: 1, idDireccion: 1 });
    expect(r.status).toBe(201);
    expect(db.llamadasA('Api.SP_Checkout_IniciarPago')[0]?.parametros.Llave?.valor).toBe(LLAVE);
  });

  it('una escritura desde un origen no permitido responde 403', async () => {
    const { app } = preparar();
    const r = await request(app).post('/api/v1/auth/logout').set('Origin', 'https://malicioso.test');
    expect(r.status).toBe(403);
  });

  it('un error interno no filtra detalles', async () => {
    const { app, db } = preparar();
    db.responder('Api.SP_Catalogo_ListarMarcas', () => {
      throw new Error('Login failed for user shopcart_api at 10.0.0.1');
    });
    const r = await request(app).get('/api/v1/catalogo/marcas');
    expect(r.status).toBe(500);
    expect(JSON.stringify(r.body)).not.toContain('shopcart_api');
    expect(r.body.error.requestId).toBeTruthy();
  });

  it('una ruta inexistente responde 404 consistente', async () => {
    const { app } = preparar();
    const r = await request(app).get('/api/v1/nada');
    expect(r.status).toBe(404);
    expect(r.body.error.codigo).toBe('NO_ENCONTRADO');
  });

  it('envia cabeceras de seguridad y oculta Express', async () => {
    const { app } = preparar();
    const r = await request(app).get('/health');
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });

  it('publica la documentacion OpenAPI', async () => {
    const { app } = preparar();
    const r = await request(app).get('/api/openapi.json');
    expect(r.status).toBe(200);
    expect(r.body.paths['/api/v1/checkout/{id}/pagar'].post.parameters.map((p: { name: string }) => p.name)).toContain('Idempotency-Key');
    expect(Object.keys(r.body.paths).length).toBeGreaterThan(50);
  });
});

describe('subida de imagenes', () => {
  const PNG = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]);
  const RUTA = '/api/v1/catalogo/imagenes/archivo';

  it('guarda una imagen valida y devuelve su URL', async () => {
    const { app, almacen } = preparar(['CATALOGO_GESTIONAR'], 'ADMINISTRADOR');
    const r = await request(app).post(RUTA).set('Authorization', bearer(2)).set('Origin', ORIGEN).set('Content-Type', 'image/png').send(PNG);
    expect(r.status).toBe(201);
    expect(r.body.data.url).toBe('/uploads/productos/prueba.png');
    expect(almacen.guardados).toEqual([{ bytes: PNG.length, formato: 'png' }]);
  });

  it('rechaza un archivo que solo dice ser imagen', async () => {
    const { app, almacen } = preparar(['CATALOGO_GESTIONAR'], 'ADMINISTRADOR');
    const r = await request(app).post(RUTA).set('Authorization', bearer(2)).set('Origin', ORIGEN).set('Content-Type', 'image/png').send(Buffer.from('<script>alert(1)</script>'));
    expect(r.status).toBe(400);
    expect(r.body.error.detalles[0].campo).toBe('archivo');
    expect(almacen.guardados).toHaveLength(0);
  });

  it('exige el permiso de catalogo', async () => {
    const { app, almacen } = preparar();
    const r = await request(app).post(RUTA).set('Authorization', bearer()).set('Origin', ORIGEN).set('Content-Type', 'image/png').send(PNG);
    expect(r.status).toBe(403);
    expect(almacen.guardados).toHaveLength(0);
  });

  it('rechaza imagenes de mas de 5 MB', async () => {
    const { app, almacen } = preparar(['CATALOGO_GESTIONAR'], 'ADMINISTRADOR');
    const grande = Buffer.concat([PNG, Buffer.alloc(5 * 1024 * 1024)]);
    const r = await request(app).post(RUTA).set('Authorization', bearer(2)).set('Origin', ORIGEN).set('Content-Type', 'image/png').send(grande);
    expect(r.status).toBe(413);
    expect(almacen.guardados).toHaveLength(0);
  });
});
