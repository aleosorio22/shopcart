import { z } from 'zod';
import { booleanoQuery, idParam, paginado, textoCorto } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { UsuariosService } from '../application/usuarios.service.js';
import { ROLES } from '../domain/usuarios.ports.js';

const PERMISO = 'USUARIOS_GESTIONAR';

const filtro = paginado.extend({ texto: z.string().max(100).optional(), rol: z.enum(ROLES).optional(), activo: booleanoQuery.optional() });
const nuevo = z.object({
  correo: z.string().trim().toLowerCase().pipe(z.email()).max(254),
  contrasena: z.string().min(10).max(72),
  nombres: textoCorto(100),
  apellidos: textoCorto(100),
  rol: z.enum(ROLES),
});

export const rutasUsuarios = (servicio: UsuariosService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/', resumen: 'Listar usuarios', permiso: PERMISO, query: filtro, manejar: ({ idUsuario, query }) => servicio.listar(idUsuario, query) }),
  ruta({ metodo: 'post', ruta: '/', resumen: 'Crear usuario interno', permiso: PERMISO, status: 201, body: nuevo, manejar: ({ idUsuario, body }) => servicio.crear(idUsuario, body) }),
  ruta({
    metodo: 'patch', ruta: '/:id/estado', resumen: 'Activar o desactivar usuario', permiso: PERMISO, status: 204, params: idParam, body: z.object({ activo: z.boolean() }),
    manejar: ({ idUsuario, params, body }) => servicio.cambiarEstado(idUsuario, params.id, body.activo),
  }),
];
