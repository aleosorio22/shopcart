import { z } from 'zod';
import type { RutaDefinida } from './route.js';

type Esquema = Record<string, unknown>;
const operaciones: Record<string, Record<string, unknown>> = {};

// En OpenAPI, {} significa que tambien se acepta la peticion sin autenticar.
const SEGURIDAD = { publico: [], opcional: [{ bearer: [] }, {}], privado: [{ bearer: [] }] };

function aJsonSchema(esquema: z.ZodType): Esquema {
  return z.toJSONSchema(esquema, { target: 'openapi-3.0', io: 'input', unrepresentable: 'any' }) as Esquema;
}

/** Un esquema combinado con .and() llega como allOf: sus campos se aplanan. */
function camposDe(esquema: Esquema): { propiedades: Record<string, Esquema>; obligatorios: string[] } {
  const partes = [esquema, ...((esquema.allOf ?? []) as Esquema[])];
  return {
    propiedades: Object.assign({}, ...partes.map((parte) => (parte.properties ?? {}) as Record<string, Esquema>)) as Record<string, Esquema>,
    obligatorios: partes.flatMap((parte) => (parte.required ?? []) as string[]),
  };
}

function parametros(esquema: z.ZodType | undefined, ubicacion: 'query' | 'path'): Esquema[] {
  if (!esquema) return [];
  const { propiedades, obligatorios } = camposDe(aJsonSchema(esquema));
  return Object.entries(propiedades).map(([name, schema]) => ({ name, in: ubicacion, required: ubicacion === 'path' || obligatorios.includes(name), schema }));
}

export function registrarDocumentacion(prefijo: string, etiqueta: string, definicion: RutaDefinida): void {
  const { metodo, ruta, resumen, acceso = 'privado', permiso, body, query, params, status = 200, idempotente } = definicion;
  const camino = `${prefijo}${ruta}`.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '');
  const cabecera = idempotente ? [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } }] : [];

  (operaciones[camino] ??= {})[metodo] = {
    tags: [etiqueta],
    summary: permiso ? `${resumen} (${permiso})` : resumen,
    security: SEGURIDAD[acceso],
    parameters: [...parametros(params, 'path'), ...parametros(query, 'query'), ...cabecera],
    ...(body ? { requestBody: { required: true, content: { 'application/json': { schema: aJsonSchema(body) } } } } : {}),
    responses: {
      [status]: { description: 'Correcto' },
      400: { description: 'Datos invalidos' },
      ...(acceso === 'privado' ? { 401: { description: 'Token ausente, invalido o expirado' }, 403: { description: 'Sin permiso' } } : {}),
    },
  };
}

export function documentoOpenApi(): Esquema {
  return {
    openapi: '3.0.3',
    info: {
      title: 'ShopCart API',
      version: '1.0.0',
      description: 'Respuesta correcta: { success, data, meta? }. Error: { success: false, error: { codigo, mensaje, detalles?, requestId } }.',
    },
    servers: [{ url: 'http://localhost:3000', description: 'Local' }],
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths: operaciones,
  };
}
