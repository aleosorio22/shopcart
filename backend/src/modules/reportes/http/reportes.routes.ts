import { paginado, rangoFechas } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { ReportesService } from '../application/reportes.service.js';
import { bitacoraSchema, margenSchema, topSchema, ventasSchema } from '../domain/reportes.js';

const PERMISO = 'REPORTES_VER';

export const rutasReportes = (s: ReportesService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/dashboard/resumen', resumen: 'KPI: ventas, pedidos, ticket promedio', permiso: PERMISO, query: rangoFechas, manejar: ({ idUsuario, query }) => s.resumen(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/dashboard/ventas', resumen: 'Ventas por dia, semana o mes', permiso: PERMISO, query: ventasSchema, manejar: ({ idUsuario, query }) => s.ventasPorPeriodo(idUsuario, query, query.agrupacion) }),
  ruta({ metodo: 'get', ruta: '/dashboard/categorias', resumen: 'Ventas por categoria', permiso: PERMISO, query: rangoFechas, manejar: ({ idUsuario, query }) => s.ventasPorCategoria(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/dashboard/top-productos', resumen: 'Productos mas vendidos', permiso: PERMISO, query: topSchema, manejar: ({ idUsuario, query }) => s.topProductos(idUsuario, query, query.limite) }),
  ruta({ metodo: 'get', ruta: '/dashboard/carritos-abandonados', resumen: 'Carritos abandonados', permiso: PERMISO, query: paginado, manejar: ({ idUsuario, query }) => s.carritosAbandonados(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/dashboard/margen', resumen: 'Margen bruto por producto', permiso: PERMISO, query: margenSchema, manejar: ({ idUsuario, query }) => s.margenPorProducto(idUsuario, query, query) }),
  ruta({ metodo: 'get', ruta: '/bitacora', resumen: 'Consultar bitacora por modulo', permiso: 'BITACORA_VER', query: bitacoraSchema, manejar: ({ idUsuario, query }) => s.consultarBitacora(idUsuario, query) }),
];
