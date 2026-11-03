import type { CookieOptions, Request, RequestHandler, Response } from 'express';
import { z } from 'zod';
import { AppError } from '../../../core/errors/app-error.js';
import { correo, textoCorto } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import { COOKIE_INVITADO, leerHashInvitado } from '../../../core/http/cookies.js';
import type { AuthService } from '../application/auth.service.js';
import type { MetaSesion, Sesion } from '../domain/auth.ports.js';

const COOKIE_REFRESH = 'sc_refresh';
const BYTES_MAXIMOS_BCRYPT = 72;

const contrasenaNueva = z
  .string()
  .min(10, 'Minimo 10 caracteres')
  .refine((valor) => Buffer.byteLength(valor) <= BYTES_MAXIMOS_BCRYPT, 'Maximo 72 bytes')
  .refine((valor) => /[a-zA-Z]/.test(valor) && /\d/.test(valor), 'Debe incluir letras y numeros');
const telefono = z.string().regex(/^\+?\d{8,15}$/, 'Telefono invalido').optional();

const registro = z.object({ correo, contrasena: contrasenaNueva, nombres: textoCorto(100), apellidos: textoCorto(100), telefono });
const credenciales = z.object({ correo, contrasena: z.string().min(1).max(200) });
const perfil = z.object({ nombres: textoCorto(100), apellidos: textoCorto(100), telefono });
const cambioContrasena = z.object({ actual: z.string().min(1).max(200), nueva: contrasenaNueva });

export interface DependenciasAuthHttp {
  servicio: AuthService;
  cookieSegura: boolean;
  limitadorCredenciales: RequestHandler;
  limitadorRefresh: RequestHandler;
}

const metaDe = (req: Request): MetaSesion => ({ direccionIP: req.ip, agenteUsuario: req.header('User-Agent')?.slice(0, 300) });

export function rutasAuth({ servicio, cookieSegura, limitadorCredenciales, limitadorRefresh }: DependenciasAuthHttp): RutaDefinida[] {
  // El refresh vive en una cookie HttpOnly: JavaScript no puede leerla si hubiera un XSS.
  const opcionesCookie: CookieOptions = { httpOnly: true, secure: cookieSegura, sameSite: 'strict', path: '/api/v1/auth' };

  const entregar = (res: Response, sesion: Sesion) => {
    res.cookie(COOKIE_REFRESH, sesion.refreshToken, { ...opcionesCookie, expires: sesion.refreshExpiraEn });
    return { accessToken: sesion.accessToken, expiraEnSegundos: sesion.expiraEnSegundos, usuario: sesion.usuario };
  };

  const cookieRefresh = (req: Request): string => {
    const token: unknown = req.cookies[COOKIE_REFRESH];
    if (typeof token !== 'string' || !token) throw AppError.noAutenticado('TOKEN_INVALIDO', 'La sesion no es valida o expiro.');
    return token;
  };

  return [
    ruta({
      metodo: 'post', ruta: '/registro', resumen: 'Registrar cliente', acceso: 'publico', status: 201, body: registro, limitador: limitadorCredenciales,
      manejar: async ({ body, req, res }) => entregar(res, await servicio.registrar(body, metaDe(req))),
    }),
    ruta({
      metodo: 'post', ruta: '/login', resumen: 'Iniciar sesion', acceso: 'publico', body: credenciales, limitador: limitadorCredenciales,
      manejar: async ({ body, req, res }) => {
        const sesion = await servicio.iniciarSesion(body.correo, body.contrasena, metaDe(req), leerHashInvitado(req));
        res.clearCookie(COOKIE_INVITADO, { path: '/api/v1' });
        return entregar(res, sesion);
      },
    }),
    ruta({
      metodo: 'post', ruta: '/refresh', resumen: 'Renovar el access token y rotar el refresh token', acceso: 'publico', limitador: limitadorRefresh,
      manejar: async ({ req, res }) => {
        try {
          return entregar(res, await servicio.refrescar(cookieRefresh(req), metaDe(req)));
        } catch (error) {
          res.clearCookie(COOKIE_REFRESH, opcionesCookie);
          throw error;
        }
      },
    }),
    ruta({
      metodo: 'post', ruta: '/logout', resumen: 'Cerrar sesion', acceso: 'publico', status: 204,
      manejar: async ({ req, res }) => {
        const token: unknown = req.cookies[COOKIE_REFRESH];
        if (typeof token === 'string' && token) await servicio.cerrarSesion(token);
        res.clearCookie(COOKIE_REFRESH, opcionesCookie);
      },
    }),
    ruta({ metodo: 'get', ruta: '/me', resumen: 'Perfil y permisos del usuario', manejar: ({ idUsuario }) => servicio.obtenerPerfil(idUsuario) }),
    ruta({
      metodo: 'patch', ruta: '/me', resumen: 'Actualizar perfil', status: 204, body: perfil,
      manejar: ({ idUsuario, body }) => servicio.actualizarPerfil(idUsuario, body),
    }),
    ruta({
      metodo: 'post', ruta: '/cambiar-contrasena', resumen: 'Cambiar contrasena y cerrar las demas sesiones', status: 204, body: cambioContrasena, limitador: limitadorCredenciales,
      manejar: async ({ idUsuario, body, res }) => {
        await servicio.cambiarContrasena(idUsuario, body.actual, body.nueva);
        res.clearCookie(COOKIE_REFRESH, opcionesCookie);
      },
    }),
  ];
}
