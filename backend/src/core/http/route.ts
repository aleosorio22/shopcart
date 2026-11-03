import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import { AppError } from '../errors/app-error.js';
import { sha256 } from '../security/hash.js';
import type { Pagina } from '../db/sql-gateway.js';
import { registrarDocumentacion } from './openapi.js';

export interface UsuarioSesion {
  idUsuario: number;
  rol: string;
  permisos: readonly string[];
}

export type Acceso = 'publico' | 'opcional' | 'privado';
type Metodo = 'get' | 'post' | 'put' | 'patch' | 'delete';

export interface Idempotencia {
  llave: string;
  hashSolicitud: Buffer;
}

export interface Contexto<B, Q, P> {
  body: B;
  query: Q;
  params: P;
  usuario: UsuarioSesion | undefined;
  /** Identidad tomada del JWT, nunca del body ni de la URL. */
  idUsuario: number;
  idempotencia: Idempotencia;
  req: Request;
  res: Response;
}

export interface Ruta<B, Q, P> {
  metodo: Metodo;
  ruta: string;
  resumen: string;
  acceso?: Acceso;
  permiso?: string;
  body?: z.ZodType<B>;
  query?: z.ZodType<Q>;
  params?: z.ZodType<P>;
  status?: number;
  idempotente?: boolean;
  limitador?: RequestHandler;
  manejar: (contexto: Contexto<B, Q, P>) => Promise<unknown>;
}

// La inferencia ocurre aqui; la lista de un modulo mezcla rutas con esquemas distintos.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type RutaDefinida = Ruta<any, any, any>;

export const ruta = <B = undefined, Q = undefined, P = undefined>(definicion: Ruta<B, Q, P>): RutaDefinida => definicion;

export interface Autenticador {
  autenticar(token: string): Promise<UsuarioSesion>;
}

const llaveIdempotencia = z.uuid();

function leerIdempotencia(req: Request): Idempotencia {
  const llave = llaveIdempotencia.safeParse(req.header('Idempotency-Key'));
  if (!llave.success) {
    throw new AppError('IDEMPOTENCY_KEY_REQUERIDA', 400, 'La cabecera Idempotency-Key debe ser un UUID.');
  }
  return { llave: llave.data, hashSolicitud: sha256(`${req.method} ${req.originalUrl} ${JSON.stringify(req.body ?? null)}`) };
}

function validar<T>(esquema: z.ZodType<T> | undefined, valor: unknown): T {
  if (!esquema) return undefined as T;
  const resultado = esquema.safeParse(valor);
  if (!resultado.success) {
    throw AppError.datosInvalidos(resultado.error.issues.map(({ path, message }) => ({ campo: path.join('.'), mensaje: message })));
  }
  return resultado.data;
}

async function resolverUsuario(req: Request, acceso: Acceso, autenticador: Autenticador): Promise<UsuarioSesion | undefined> {
  const cabecera = req.header('Authorization');
  if (acceso === 'publico') return undefined;
  if (!cabecera) {
    if (acceso === 'opcional') return undefined;
    throw AppError.noAutenticado();
  }
  if (!cabecera.startsWith('Bearer ')) throw AppError.noAutenticado('TOKEN_INVALIDO', 'Formato de token invalido.');
  return autenticador.autenticar(cabecera.slice('Bearer '.length));
}

function responder(res: Response, status: number, resultado: unknown): void {
  if (status === 204 || resultado === undefined) {
    res.status(204).end();
    return;
  }
  if (esPagina(resultado)) {
    const { filas, ...meta } = resultado;
    res.status(status).json({ success: true, data: filas, meta });
    return;
  }
  res.status(status).json({ success: true, data: resultado });
}

function esPagina(valor: unknown): valor is Pagina {
  return typeof valor === 'object' && valor !== null && 'filas' in valor && 'total' in valor;
}

function crearManejador(definicion: RutaDefinida, autenticador: Autenticador): RequestHandler {
  const { acceso = 'privado', permiso, idempotente, status = 200 } = definicion;
  return async (req, res) => {
    const usuario = await resolverUsuario(req, acceso, autenticador);
    if (permiso && !usuario?.permisos.includes(permiso)) throw AppError.prohibido();

    const resultado = await definicion.manejar({
      body: validar(definicion.body, req.body),
      query: validar(definicion.query, req.query),
      params: validar(definicion.params, req.params),
      usuario,
      get idUsuario() {
        if (!usuario) throw AppError.noAutenticado();
        return usuario.idUsuario;
      },
      get idempotencia() {
        return leerIdempotencia(req);
      },
      req,
      res,
    });
    responder(res, status, resultado);
  };
}

/** Una sola definicion produce el endpoint y su documentacion, para que nunca se desalineen. */
export function crearRouter(prefijo: string, etiqueta: string, rutas: readonly RutaDefinida[], autenticador: Autenticador): Router {
  const router = Router();
  for (const definicion of rutas) {
    const manejadores = [definicion.limitador, crearManejador(definicion, autenticador)].filter((m): m is RequestHandler => Boolean(m));
    router[definicion.metodo](definicion.ruta, ...manejadores);
    registrarDocumentacion(prefijo, etiqueta, definicion);
  }
  return router;
}
