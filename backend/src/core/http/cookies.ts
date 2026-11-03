import type { Request, Response } from 'express';
import { sha256, tokenOpaco } from '../security/hash.js';

export const COOKIE_INVITADO = 'sc_invitado';
const VIDA_INVITADO_MS = 30 * 86_400_000;

export function leerHashInvitado(req: Request): Buffer | undefined {
  const token: unknown = req.cookies[COOKIE_INVITADO];
  return typeof token === 'string' && token ? sha256(token) : undefined;
}

/** El carrito de invitado se identifica por un token: su hash es lo unico que llega a la BD. */
export function asegurarHashInvitado(req: Request, res: Response, cookieSegura: boolean): Buffer {
  const existente = leerHashInvitado(req);
  if (existente) return existente;
  const token = tokenOpaco();
  res.cookie(COOKIE_INVITADO, token, { httpOnly: true, secure: cookieSegura, sameSite: 'lax', path: '/api/v1', maxAge: VIDA_INVITADO_MS });
  return sha256(token);
}
