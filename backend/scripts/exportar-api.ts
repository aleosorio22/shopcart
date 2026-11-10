// Genera docs/api/openapi.yml y la coleccion de Bruno desde las rutas reales.
// Uso: npm run docs:api
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import pino from 'pino';
import { stringify } from 'yaml';
import { componer } from '../src/composition.js';
import type { SqlGateway } from '../src/core/db/sql-gateway.js';
import { documentoOpenApi } from '../src/core/http/openapi.js';
import { BcryptHasher, JwtEmisorTokens } from '../src/modules/auth/infrastructure/seguridad.adapters.js';
import { PasarelaSimulada } from '../src/modules/checkout/infrastructure/pasarela-simulada.js';

type Esquema = Record<string, unknown>;
interface Parametro {
  name: string;
  in: 'path' | 'query' | 'header';
  required: boolean;
  schema: Esquema;
}
interface Operacion {
  tags: string[];
  summary: string;
  security: unknown[];
  parameters: Parametro[];
  requestBody?: { content: { 'application/json': { schema: Esquema } } };
}

const SALIDA = join(import.meta.dirname, '..', 'docs', 'api');
const COLECCION = join(SALIDA, 'bruno');
const CONTRASENA_SEMILLA = 'ShopCart#2026';

const EJEMPLOS: Record<string, unknown> = {
  correo: 'cliente1@shopcart.test', contrasena: CONTRASENA_SEMILLA, actual: CONTRASENA_SEMILLA, nueva: 'NuevaClave2026', telefono: '55550000',
  slug: 'ejemplo-api', sku: 'EJ-001', codigo: 'EJEMPLO10', codigoZona: 'HOME_HERO', zona: 'HOME_HERO', clave: 'RESERVA_MINUTOS', referencia: 'REF-001',
  nit: 'CF', tokenPago: 'tok_visa', desde: '2026-09-01', hasta: '2026-12-31', vigenteDesde: '2026-01-01T00:00:00.000Z', vigenteHasta: '2027-01-01T00:00:00.000Z',
  precio: 100, valor: 10, costo: 25, costoUnitario: 50, cantidad: 1, diasEstimados: 2, url: 'https://example.com/imagen.webp', valoresAtributo: [1], alcance: [{ idMarca: 1 }],
  lineas: [{ idPedidoDetalle: 1, cantidad: 1 }], estado: 'EN_PREPARACION', evento: 'IMPRESION',
};

/** Cuerpos que no se deducen del esquema porque dependen de reglas entre campos. */
const CUERPOS: Record<string, unknown> = {
  'post /api/v1/auth/login': { correo: 'cliente1@shopcart.test', contrasena: CONTRASENA_SEMILLA },
  'post /api/v1/auth/registro': { correo: 'nuevo@shopcart.test', contrasena: 'ClaveSegura2026', nombres: 'Nuevo', apellidos: 'Cliente' },
  'post /api/v1/checkout': { idMetodoEnvio: 1, idDireccion: 1 },
  'post /api/v1/checkout/{id}/pagar': { idMetodoPago: 1, tokenPago: 'tok_visa', nitFactura: 'CF' },
};

const VARIABLES_DE_RUTA: Record<string, string> = { 'post /api/v1/checkout/{id}/pagar': '{{idCheckout}}', 'delete /api/v1/checkout/{id}': '{{idCheckout}}' };

function ejemplo(nombre: string, esquema: Esquema): unknown {
  if (nombre in EJEMPLOS) return EJEMPLOS[nombre];
  if (esquema.default !== undefined) return esquema.default;
  if (Array.isArray(esquema.enum)) return esquema.enum[0];
  if (nombre.startsWith('id')) return 1;
  if (esquema.type === 'boolean') return true;
  if (esquema.type === 'integer' || esquema.type === 'number') return 1;
  if (esquema.type === 'array') return [];
  if (esquema.format === 'date-time') return '2026-01-01T00:00:00.000Z';
  return 'Ejemplo';
}

function cuerpoDe(clave: string, esquema: Esquema | undefined): unknown {
  if (clave in CUERPOS) return CUERPOS[clave];
  const partes = esquema ? [esquema, ...((esquema.allOf ?? []) as Esquema[])] : [];
  const propiedades = Object.assign({}, ...partes.map((p) => (p.properties ?? {}) as Esquema)) as Record<string, Esquema>;
  const obligatorios = partes.flatMap((p) => (p.required ?? []) as string[]);
  return Object.fromEntries(obligatorios.map((nombre) => [nombre, ejemplo(nombre, propiedades[nombre] ?? {})]));
}

const sangrar = (texto: string) => texto.split('\n').map((linea) => `  ${linea}`).join('\n');
const bloque = (nombre: string, lineas: string[]) => (lineas.length ? `${nombre} {\n${lineas.map((l) => `  ${l}`).join('\n')}\n}\n\n` : '');
const archivoDe = (texto: string) => texto.normalize('NFD').replace(/[^\w ]/g, '').trim().replace(/ +/g, '-').toLowerCase();

interface Peticion {
  nombre: string;
  metodo: string;
  ruta: string;
  orden: number;
  operacion: Operacion;
  cuerpo?: unknown;
  scriptRespuesta?: string;
}

function archivoBruno({ nombre, metodo, ruta, orden, operacion, cuerpo, scriptRespuesta }: Peticion): string {
  const clave = `${metodo} ${ruta}`;
  const ruteable = ruta.replace(/\{(\w+)\}/g, ':$1');
  const parametros = operacion.parameters;
  const deRuta = parametros.filter((p) => p.in === 'path').map((p) => `${p.name}: ${VARIABLES_DE_RUTA[clave] ?? ejemplo(p.name, p.schema)}`);
  const deQuery = parametros.filter((p) => p.in === 'query').map((p) => `${p.required ? '' : '~'}${p.name}: ${String(ejemplo(p.name, p.schema))}`);
  const activos = parametros.filter((p) => p.in === 'query' && p.required).map((p) => `${p.name}=${String(ejemplo(p.name, p.schema))}`);
  const url = `{{baseUrl}}${ruteable}${activos.length ? `?${activos.join('&')}` : ''}`;
  const cabeceras = parametros.filter((p) => p.in === 'header').map((p) => `${p.name}: {{idempotencyKey}}`);
  const auth = operacion.security.length ? 'inherit' : 'none';

  return [
    `meta {\n  name: ${nombre}\n  type: http\n  seq: ${orden}\n}\n\n`,
    `${metodo} {\n  url: ${url}\n  body: ${cuerpo === undefined ? 'none' : 'json'}\n  auth: ${auth}\n}\n\n`,
    bloque('params:path', deRuta),
    bloque('params:query', deQuery),
    bloque('headers', cabeceras),
    cuerpo === undefined ? '' : `body:json {\n${sangrar(JSON.stringify(cuerpo, null, 2))}\n}\n\n`,
    scriptRespuesta ? `script:post-response {\n${sangrar(scriptRespuesta)}\n}\n\n` : '',
    `docs {\n  ${operacion.summary}\n}\n`,
  ].join('');
}

const guardarToken = "if (res.status === 200 || res.status === 201) {\n  bru.setVar('accessToken', res.body.data.accessToken);\n}";

function scriptDe(clave: string): string | undefined {
  if (['post /api/v1/auth/login', 'post /api/v1/auth/registro', 'post /api/v1/auth/refresh'].includes(clave)) return guardarToken;
  if (clave === 'post /api/v1/checkout') return "if (res.status === 201) {\n  bru.setVar('idCheckout', res.body.data.IDCheckout);\n}";
  return undefined;
}

function escribir(ruta: string, contenido: string): void {
  mkdirSync(dirname(ruta), { recursive: true });
  writeFileSync(ruta, contenido);
}

function exportarBruno(documento: { paths: Record<string, Record<string, Operacion>> }): number {
  rmSync(COLECCION, { recursive: true, force: true });
  escribir(join(COLECCION, 'bruno.json'), `${JSON.stringify({ version: '1', name: 'ShopCart API', type: 'collection', ignore: ['node_modules', '.git'] }, null, 2)}\n`);
  escribir(join(COLECCION, 'environments', 'Local.bru'), 'vars {\n  baseUrl: http://localhost:3000\n}\n');
  escribir(join(COLECCION, 'collection.bru'), [
    'auth {\n  mode: bearer\n}\n\n',
    'auth:bearer {\n  token: {{accessToken}}\n}\n\n',
    "script:pre-request {\n  const uuid = 'xxxxxxxx-xxxx-4xxx-8xxx-xxxxxxxxxxxx'.replace(/x/g, () => Math.floor(Math.random() * 16).toString(16));\n  bru.setVar('idempotencyKey', uuid);\n}\n",
  ].join(''));

  const contadores = new Map<string, number>();
  const agregar = (carpeta: string, peticion: Omit<Peticion, 'orden'>) => {
    const orden = (contadores.get(carpeta) ?? 0) + 1;
    contadores.set(carpeta, orden);
    const contenido = archivoBruno({ ...peticion, orden });
    escribir(join(COLECCION, carpeta, `${String(orden).padStart(2, '0')}-${archivoDe(peticion.nombre)}.bru`), contenido);
  };

  for (const [ruta, metodos] of Object.entries(documento.paths)) {
    for (const [metodo, operacion] of Object.entries(metodos)) {
      const carpeta = operacion.tags[0] ?? 'General';
      if (!contadores.has(carpeta)) escribir(join(COLECCION, carpeta, 'folder.bru'), `meta {\n  name: ${carpeta}\n}\n`);
      const clave = `${metodo} ${ruta}`;
      const esquema = operacion.requestBody?.content['application/json'].schema;
      const cuerpo = operacion.requestBody ? cuerpoDe(clave, esquema) : undefined;
      const nombre = operacion.summary.replace(/\s*\([A-Z_]+\)$/, '').replace(/[,:;]/g, '');
      agregar(carpeta, { nombre, metodo, ruta, operacion, ...(cuerpo === undefined ? {} : { cuerpo }), ...(scriptDe(clave) ? { scriptRespuesta: scriptDe(clave) as string } : {}) });
      if (clave === 'post /api/v1/auth/login') {
        for (const [rol, correo] of [['Administrador', 'admin@shopcart.test'], ['Operador', 'operador@shopcart.test']]) {
          agregar(carpeta, { nombre: `Iniciar sesion como ${rol}`, metodo, ruta, operacion, cuerpo: { correo, contrasena: CONTRASENA_SEMILLA }, scriptRespuesta: guardarToken });
        }
      }
    }
  }
  return [...contadores.values()].reduce((a, b) => a + b, 0);
}

const db = {} as SqlGateway;
componer({ db, hasher: new BcryptHasher(4), tokens: new JwtEmisorTokens('x'.repeat(32), 900), pasarela: new PasarelaSimulada(), logger: pino({ level: 'silent' }), diasVidaRefresh: 7, cookieSegura: false, almacenImagenes: { guardar: async () => '' } });

const documento = documentoOpenApi() as { paths: Record<string, Record<string, Operacion>> };
escribir(join(SALIDA, 'openapi.yml'), stringify(documento));
console.log(`${Object.keys(documento.paths).length} rutas, ${exportarBruno(documento)} peticiones en Bruno`);
