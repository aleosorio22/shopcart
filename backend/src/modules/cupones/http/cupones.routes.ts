import { idParam } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { CuponesService } from '../application/cupones.service.js';
import { cuponSchema, filtroCuponesSchema } from '../domain/cupones.js';

const PERMISO = 'CUPONES_GESTIONAR';

export const rutasCupones = (s: CuponesService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/', resumen: 'Listar cupones', permiso: PERMISO, query: filtroCuponesSchema, manejar: ({ idUsuario, query }) => s.listar(idUsuario, query) }),
  ruta({ metodo: 'post', ruta: '/', resumen: 'Crear cupon', permiso: PERMISO, status: 201, body: cuponSchema, manejar: ({ idUsuario, body }) => s.guardar(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/:id', resumen: 'Editar cupon', permiso: PERMISO, params: idParam, body: cuponSchema, manejar: ({ idUsuario, body, params }) => s.guardar(idUsuario, body, params.id) }),
  ruta({ metodo: 'delete', ruta: '/:id', resumen: 'Desactivar cupon', permiso: PERMISO, status: 204, params: idParam, manejar: ({ idUsuario, params }) => s.desactivar(idUsuario, params.id) }),
];
