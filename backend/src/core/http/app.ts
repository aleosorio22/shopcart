import { randomUUID } from 'node:crypto';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express, { type ErrorRequestHandler, type Express, type RequestHandler, type Router } from 'express';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import type { Logger } from 'pino';
import { pinoHttp } from 'pino-http';
import swaggerUi from 'swagger-ui-express';
import { AppError } from '../errors/app-error.js';
import { documentoOpenApi } from './openapi.js';

const METODOS_SEGUROS = new Set(['GET', 'HEAD', 'OPTIONS']);

export interface OpcionesApp {
  origenes: readonly string[];
  proxies: number;
  logger: Logger;
  routers: ReadonlyArray<{ prefijo: string; router: Router }>;
  verificarSalud: () => Promise<void>;
  limiteGlobalPorMinuto?: number;
  /** Carpetas servidas tal cual, como las imagenes subidas desde el panel. */
  estaticos?: ReadonlyArray<{ ruta: string; carpeta: string }>;
}

/** Quien sufre CSRF es la cookie: se rechaza cualquier escritura desde un origen no permitido. */
function protegerOrigen(origenes: readonly string[]): RequestHandler {
  return (req, _res, next) => {
    const origen = req.header('Origin');
    if (!METODOS_SEGUROS.has(req.method) && origen && !origenes.includes(origen)) throw AppError.prohibido();
    next();
  };
}

function manejarErrores(logger: Logger): ErrorRequestHandler {
  return (error: unknown, req, res, next) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const requestId = String(req.id);
    if (error instanceof AppError) {
      res.status(error.status).json({ success: false, error: { codigo: error.codigo, mensaje: error.message, detalles: error.detalles, requestId } });
      return;
    }
    const status = estadoDeExpress(error);
    if (status) {
      res.status(status).json({ success: false, error: { codigo: 'SOLICITUD_INVALIDA', mensaje: 'La solicitud no es valida.', requestId } });
      return;
    }
    // El detalle interno se queda en el log: nunca viaja al cliente.
    logger.error({ err: error, requestId }, 'Error no controlado');
    res.status(500).json({ success: false, error: { codigo: 'ERROR_INTERNO', mensaje: 'Ocurrio un error inesperado.', requestId } });
  };
}

function estadoDeExpress(error: unknown): number | undefined {
  const status = (error as { status?: unknown }).status;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

export function crearApp({ origenes, proxies, logger, routers, verificarSalud, limiteGlobalPorMinuto = 300, estaticos = [] }: OpcionesApp): Express {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', proxies);

  app.use(pinoHttp({ logger, genReqId: (req) => (req.headers['x-request-id'] as string | undefined) ?? randomUUID() }));
  app.use(helmet());
  app.use(cors({ origin: [...origenes], credentials: true, allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key'], maxAge: 600 }));
  app.use(rateLimit({ windowMs: 60_000, limit: limiteGlobalPorMinuto, standardHeaders: 'draft-8', legacyHeaders: false }));
  app.use(protegerOrigen(origenes));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/health', async (_req, res) => {
    await verificarSalud();
    res.json({ success: true, data: { estado: 'ok' } });
  });
  // Swagger UI necesita scripts en linea: su CSP se relaja solo en esta ruta.
  app.use('/api/docs', helmet({ contentSecurityPolicy: false }), swaggerUi.serve, swaggerUi.setup(documentoOpenApi()));
  app.get('/api/openapi.json', (_req, res) => {
    res.json(documentoOpenApi());
  });

  // Sin listado de carpeta ni archivos ocultos; helmet ya envia nosniff para que nada se ejecute como script.
  for (const { ruta, carpeta } of estaticos) app.use(ruta, express.static(carpeta, { index: false, dotfiles: 'deny', maxAge: '7d', fallthrough: false }));

  for (const { prefijo, router } of routers) app.use(prefijo, router);

  app.use(() => {
    throw AppError.noEncontrado();
  });
  app.use(manejarErrores(logger));
  return app;
}
