import { idParam } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { InventarioService } from '../application/inventario.service.js';
import { ajusteSchema, bodegaSchema, entradaSchema, filtroExistenciaSchema, filtroKardexSchema, filtroSucursalSchema, sucursalSchema, trasladoSchema } from '../domain/inventario.js';

const INVENTARIO = 'INVENTARIO_GESTIONAR';
const CONFIG = 'CONFIG_GESTIONAR';

export const rutasInventario = (s: InventarioService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/existencias', resumen: 'Existencia por variante y bodega', permiso: INVENTARIO, query: filtroExistenciaSchema, manejar: ({ idUsuario, query }) => s.consultarExistencia(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/kardex', resumen: 'Consultar kardex', permiso: INVENTARIO, query: filtroKardexSchema, manejar: ({ idUsuario, query }) => s.consultarKardex(idUsuario, query) }),
  ruta({ metodo: 'get', ruta: '/conciliacion', resumen: 'Comparar existencia contra kardex', permiso: INVENTARIO, manejar: ({ idUsuario }) => s.conciliar(idUsuario) }),
  ruta({ metodo: 'post', ruta: '/entradas', resumen: 'Registrar entrada por compra', permiso: INVENTARIO, status: 204, body: entradaSchema, manejar: ({ idUsuario, body }) => s.registrarEntrada(idUsuario, body) }),
  ruta({ metodo: 'post', ruta: '/ajustes', resumen: 'Ajuste manual con motivo', permiso: INVENTARIO, status: 204, body: ajusteSchema, manejar: ({ idUsuario, body }) => s.ajustar(idUsuario, body) }),
  ruta({ metodo: 'post', ruta: '/traslados', resumen: 'Trasladar entre bodegas', permiso: INVENTARIO, status: 204, body: trasladoSchema, manejar: ({ idUsuario, body }) => s.trasladar(idUsuario, body) }),
  ruta({ metodo: 'get', ruta: '/bodegas', resumen: 'Listar bodegas', permiso: INVENTARIO, manejar: () => s.listarBodegas() }),
  ruta({ metodo: 'post', ruta: '/bodegas', resumen: 'Crear bodega', permiso: CONFIG, status: 201, body: bodegaSchema, manejar: ({ idUsuario, body }) => s.guardarBodega(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/bodegas/:id', resumen: 'Editar bodega', permiso: CONFIG, params: idParam, body: bodegaSchema, manejar: ({ idUsuario, body, params }) => s.guardarBodega(idUsuario, body, params.id) }),
  ruta({ metodo: 'get', ruta: '/sucursales', resumen: 'Sucursales, con disponibilidad opcional', acceso: 'publico', query: filtroSucursalSchema, manejar: ({ query }) => s.listarSucursales(query) }),
  ruta({ metodo: 'post', ruta: '/sucursales', resumen: 'Crear sucursal', permiso: CONFIG, status: 201, body: sucursalSchema, manejar: ({ idUsuario, body }) => s.guardarSucursal(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/sucursales/:id', resumen: 'Editar sucursal', permiso: CONFIG, params: idParam, body: sucursalSchema, manejar: ({ idUsuario, body, params }) => s.guardarSucursal(idUsuario, body, params.id) }),
];
