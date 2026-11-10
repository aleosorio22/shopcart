import path from 'node:path';
import pino from 'pino';
import { cargarEnv } from './core/config/env.js';
import { MssqlGateway, type OpcionesConexion } from './core/db/mssql-gateway.js';
import { crearApp } from './core/http/app.js';
import { Jobs } from './core/jobs.js';
import { componer } from './composition.js';
import { BcryptHasher, JwtEmisorTokens } from './modules/auth/infrastructure/seguridad.adapters.js';
import { AlmacenLocalImagenes } from './modules/catalogo/infrastructure/almacen-local.js';
import { PasarelaSimulada } from './modules/checkout/infrastructure/pasarela-simulada.js';

const env = cargarEnv();
const logger = pino({ level: env.LOG_LEVEL, redact: ['req.headers.authorization', 'req.headers.cookie', 'res.headers["set-cookie"]'] });

const conexionBase: Omit<OpcionesConexion, 'user' | 'password' | 'maximoConexiones'> = {
  server: env.DB_SERVER, port: env.DB_PORT, database: env.DB_NAME, encrypt: env.DB_ENCRYPT, trustServerCertificate: env.DB_TRUST_CERT,
};
const db = new MssqlGateway({ ...conexionBase, user: env.DB_USER, password: env.DB_PASSWORD, maximoConexiones: 30 }, logger);
const dbJobs = new MssqlGateway({ ...conexionBase, user: env.DB_JOBS_USER, password: env.DB_JOBS_PASSWORD, maximoConexiones: 3 }, logger);
const jobs = new Jobs(dbJobs, logger);

const carpetaArchivos = path.resolve(env.UPLOADS_DIR);
await db.conectar(true);
const { routers } = componer({
  db,
  hasher: new BcryptHasher(env.BCRYPT_COST),
  tokens: new JwtEmisorTokens(env.JWT_SECRET, env.JWT_ACCESS_TTL_SECONDS),
  pasarela: new PasarelaSimulada(),
  logger,
  diasVidaRefresh: env.REFRESH_TTL_DAYS,
  cookieSegura: env.NODE_ENV === 'production',
  almacenImagenes: new AlmacenLocalImagenes(path.join(carpetaArchivos, 'productos'), '/uploads/productos'),
});
const app = crearApp({ origenes: env.CORS_ORIGINS, proxies: env.TRUST_PROXY, logger, routers,
  verificarSalud: () => db.ejecutar('Api.SP_Config_ListarErrores'),
  estaticos: [{ ruta: '/uploads', carpeta: carpetaArchivos }],
});
const servidor = app.listen(env.PORT, () => logger.info({ puerto: env.PORT }, 'ShopCart API iniciada'));

if (env.JOBS_ENABLED) {
  await dbJobs.conectar(false);
  jobs.iniciar();
}

function apagar(): void {
  jobs.detener();
  servidor.close(() => {
    void Promise.all([db.cerrar(), dbJobs.cerrar()]).then(() => process.exit(0));
  });
}
process.on('SIGTERM', apagar);
process.on('SIGINT', apagar);
