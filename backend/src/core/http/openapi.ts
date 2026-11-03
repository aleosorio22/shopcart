import { z } from 'zod';
import type { RutaDefinida } from './route.js';

type Esquema = Record<string, unknown>;
const operaciones: Record<string, Record<string, unknown>> = {};

function aJsonSchema(esquema: z.ZodType): Esquema {
  return z.toJSONSchema(esquema, { io: 'input', unrepresentable: 'any' }) as Esquema;
}

function parametros(esquema: z.ZodType | undefined, ubicacion: 'query' | 'path'): Esquema[] {
  if (!esquema) return [];
  const propiedades = (aJsonSchema(esquema).properties ?? {}) as Record<string, Esquema>;
  return Object.entries(propiedades).map(([name, schema]) => ({ name, in: ubicacion, required: ubicacion === 'path', schema }));
}

export function registrarDocumentacion(prefijo: string, etiqueta: string, definicion: RutaDefinida): void {
  const { metodo, ruta, resumen, acceso = 'privado', permiso, body, query, params, status = 200, idempotente } = definicion;
  const camino = `${prefijo}${ruta}`.replace(/:(\w+)/g, '{$1}').replace(/\/$/, '');
  const cabecera = idempotente ? [{ name: 'Idempotency-Key', in: 'header', required: true, schema: { type: 'string', format: 'uuid' } }] : [];

  (operaciones[camino] ??= {})[metodo] = {
    tags: [etiqueta],
    summary: permiso ? `${resumen} (${permiso})` : resumen,
    security: acceso === 'privado' ? [{ bearer: [] }] : [],
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
    components: { securitySchemes: { bearer: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT' } } },
    paths: operaciones,
  };
}
