import { obtener, obtenerPagina } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export interface Rango {
  desde: string;
  hasta: string;
}
export interface Resumen {
  NumeroPedidos: number | string;
  MontoNeto: number;
  TicketPromedio: number;
  CarritosAbandonados: number;
  VariantesBajoMinimo: number;
}
export interface VentaPeriodo {
  Periodo: string;
  NumeroPedidos: number | string;
  MontoNeto: number;
}
export interface VentaCategoria {
  IDCategoria: number;
  Categoria: string;
  Unidades: number;
  MontoNeto: number;
}
export interface ProductoVendido {
  IDProducto: number;
  Nombre: string;
  Unidades: number;
  MontoNeto: number;
}
export interface MargenProducto {
  IDProducto: number;
  Nombre: string;
  Unidades: number;
  Venta: number;
  Costo: number;
  MargenBruto: number;
}
export interface CarritoAbandonado {
  IDCarrito: string;
  IDUsuario: number | null;
  Correo: string | null;
  UltimaActividad: string;
  MinutosInactivo: number;
  Lineas: number;
  Unidades: number;
}
export interface RegistroBitacora {
  IDBitacora: string;
  Fecha: string;
  IDUsuario: number | null;
  CorreoUsuario: string | null;
  Modulo: string;
  Entidad: string;
  IDEntidad: string;
  Accion: string;
  ValorAnterior: string | null;
  ValorNuevo: string | null;
  DireccionIP: string | null;
}
export type Agrupacion = 'DIA' | 'SEMANA' | 'MES';

export const reportesService = {
  resumen: (rango: Rango) => obtener<Resumen>('/reportes/dashboard/resumen', rango),
  ventas: (rango: Rango, agrupacion: Agrupacion) => obtener<VentaPeriodo[]>('/reportes/dashboard/ventas', { ...rango, agrupacion }),
  categorias: (rango: Rango) => obtener<VentaCategoria[]>('/reportes/dashboard/categorias', rango),
  topProductos: (rango: Rango, limite = 5) => obtener<ProductoVendido[]>('/reportes/dashboard/top-productos', { ...rango, limite }),
  margen: (rango: Rango, filtro: FiltroPaginado) => obtenerPagina<MargenProducto>('/reportes/dashboard/margen', { ...rango, ...filtro }),
  carritosAbandonados: (filtro: FiltroPaginado) => obtenerPagina<CarritoAbandonado>('/reportes/dashboard/carritos-abandonados', filtro),
  bitacora: (filtro: FiltroPaginado & { modulo?: string; desde?: string; hasta?: string }) =>
    obtenerPagina<RegistroBitacora>('/reportes/bitacora', filtro),
};
