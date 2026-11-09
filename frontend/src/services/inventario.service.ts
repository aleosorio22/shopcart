import { enviar, obtener, obtenerPagina } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export interface Existencia {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  NombreProducto: string;
  IDBodega: number;
  CodigoBodega: string;
  NombreBodega: string;
  Fisica: number;
  Reservada: number;
  Disponible: number;
  StockMinimo: number;
  CostoPromedio: number;
}
export interface MovimientoKardex {
  IDKardex: string;
  Fecha: string;
  SKU: string;
  IDBodega: number;
  Bodega: string;
  TipoMovimiento: string;
  Cantidad: number;
  SaldoAnterior: number;
  SaldoNuevo: number;
  CostoUnitario: number;
  Motivo: string | null;
  ReferenciaDocumento: string | null;
  CorreoUsuario: string | null;
}
export interface Bodega {
  IDBodega: number;
  Codigo: string;
  Nombre: string;
  PermiteVentaEnLinea: boolean;
  Prioridad: number;
  Activo: boolean;
  IDSucursal: number | null;
  Sucursal: string | null;
}
export interface FiltroExistencias extends FiltroPaginado {
  texto?: string;
  idBodega?: number;
  soloBajoMinimo?: boolean;
}
export interface FiltroKardex extends FiltroPaginado {
  idVariante?: number;
  idBodega?: number;
  desde?: string;
  hasta?: string;
}
export interface DatosEntrada {
  idVariante: number;
  idBodega: number;
  cantidad: number;
  costoUnitario: number;
  motivo?: string;
  referenciaDocumento?: string;
}
export interface DatosAjuste {
  idVariante: number;
  idBodega: number;
  cantidad: number;
  motivo: string;
}
export interface DatosTraslado {
  idVariante: number;
  idBodegaOrigen: number;
  idBodegaDestino: number;
  cantidad: number;
  motivo: string;
}

export const inventarioService = {
  existencias: (filtro: FiltroExistencias) => obtenerPagina<Existencia>('/inventario/existencias', filtro),
  kardex: (filtro: FiltroKardex) => obtenerPagina<MovimientoKardex>('/inventario/kardex', filtro),
  bodegas: () => obtener<Bodega[]>('/inventario/bodegas'),
  conciliacion: () => obtener<{ cuadrado: boolean; diferencias: unknown[] }>('/inventario/conciliacion'),
  entrada: (datos: DatosEntrada) => enviar('post', '/inventario/entradas', datos),
  ajuste: (datos: DatosAjuste) => enviar('post', '/inventario/ajustes', datos),
  traslado: (datos: DatosTraslado) => enviar('post', '/inventario/traslados', datos),
};
