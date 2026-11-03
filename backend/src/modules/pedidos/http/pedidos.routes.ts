import { idParam, paginado } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { PedidosService } from '../application/pedidos.service.js';
import { devolucionSchema, estadoSchema, filtroPedidosSchema, filtroReembolsosSchema, motivoSchema, reembolsoSchema } from '../domain/pedidos.js';

const PERMISO = 'PEDIDOS_GESTIONAR';

export const rutasPedidos = (s: PedidosService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/mios', resumen: 'Mis pedidos', query: paginado, manejar: ({ idUsuario, query }) => s.listarPropios(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/', resumen: 'Listar pedidos con filtros', permiso: PERMISO, query: filtroPedidosSchema, manejar: ({ idUsuario, query }) => s.listar(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/reembolsos', resumen: 'Listar reembolsos', permiso: PERMISO, query: filtroReembolsosSchema, manejar: ({ idUsuario, query }) => s.listarReembolsos(idUsuario, query) }),
  ruta({
    metodo: 'post', ruta: '/reembolsos/:id/procesar', resumen: 'Marcar reembolso como procesado', permiso: PERMISO, status: 204, params: idParam, body: reembolsoSchema,
    manejar: ({ idUsuario, params, body }) => s.procesarReembolso(idUsuario, params.id, body.referencia),
  }),
  ruta({ metodo: 'get', ruta: '/:id', resumen: 'Detalle e historial; solo el dueno o personal', params: idParam, manejar: ({ idUsuario, params }) => s.obtenerDetalle(idUsuario, params.id) }),
  ruta({
    metodo: 'patch', ruta: '/:id/estado', resumen: 'Avanzar estado', permiso: PERMISO, status: 204, params: idParam, body: estadoSchema,
    manejar: ({ idUsuario, params, body }) => s.cambiarEstado(idUsuario, params.id, body.estado, body.motivo),
  }),
  ruta({
    metodo: 'post', ruta: '/:id/cancelar', resumen: 'Cancelar antes del despacho', status: 204, params: idParam, body: motivoSchema,
    manejar: ({ idUsuario, params, body }) => s.cancelar(idUsuario, params.id, body.motivo),
  }),
  ruta({
    metodo: 'post', ruta: '/:id/devoluciones', resumen: 'Registrar devolucion total o parcial', permiso: PERMISO, status: 201, params: idParam, body: devolucionSchema,
    manejar: ({ idUsuario, params, body }) => s.crearDevolucion(idUsuario, params.id, body),
  }),
];
