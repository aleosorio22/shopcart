import 'dotenv/config';
import { z } from 'zod';

const booleano = z.enum(['true', 'false']).transform((valor) => valor === 'true');

const esquema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.string().default('info'),
  DB_SERVER: z.string().min(1),
  DB_PORT: z.coerce.number().int().positive().default(1433),
  DB_NAME: z.string().default('ShopCart'),
  DB_USER: z.string().min(1),
  DB_PASSWORD: z.string().min(1),
  DB_JOBS_USER: z.string().min(1),
  DB_JOBS_PASSWORD: z.string().min(1),
  DB_ENCRYPT: booleano.default(true),
  DB_TRUST_CERT: booleano.default(false),
  JWT_SECRET: z.string().min(32, 'JWT_SECRET debe tener al menos 32 caracteres'),
  JWT_ACCESS_TTL_SECONDS: z.coerce.number().int().min(60).max(3600).default(900),
  REFRESH_TTL_DAYS: z.coerce.number().int().positive().default(7),
  BCRYPT_COST: z.coerce.number().int().min(10).max(15).default(12),
  CORS_ORIGINS: z.string().transform((valor) => valor.split(',').map((origen) => origen.trim()).filter(Boolean)),
  TRUST_PROXY: z.coerce.number().int().min(0).default(0),
  JOBS_ENABLED: booleano.default(true),
  UPLOADS_DIR: z.string().min(1).default('uploads'),
});

export type Env = z.infer<typeof esquema>;

/** Falla al arrancar: un secreto ausente nunca debe descubrirse en la primera peticion. */
export function cargarEnv(origen: NodeJS.ProcessEnv = process.env): Env {
  const resultado = esquema.safeParse(origen);
  if (!resultado.success) {
    const detalle = resultado.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Configuracion invalida. ${detalle}`);
  }
  return resultado.data;
}
