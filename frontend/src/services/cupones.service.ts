import { enviar, obtenerPagina } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export interface Cupon {
  IDCupon: number;
  Codigo: string;
  Descripcion: string | null;
  TipoDescuento: 'PORCENTAJE' | 'MONTO';
  Valor: number;
  DescuentoMaximo: number | null;
  MontoMinimo: number;
  VigenteDesde: string;
  VigenteHasta: string;
  LimiteTotal: number | null;
  LimitePorCliente: number;
  UsosActuales: number;
  IDCategoria: number | null;
  Categoria: string | null;
  Activo: boolean;
}
export interface DatosCupon {
  codigo: string;
  descripcion?: string | null;
  tipoDescuento: 'PORCENTAJE' | 'MONTO';
  valor: number;
  descuentoMaximo?: number | null;
  montoMinimo: number;
  vigenteDesde: string;
  vigenteHasta: string;
  limiteTotal?: number | null;
  limitePorCliente: number;
  idCategoria?: number | null;
  activo: boolean;
}

export const cuponesService = {
  listar: (filtro: FiltroPaginado & { texto?: string; activo?: boolean }) => obtenerPagina<Cupon>('/cupones', filtro),
  crear: (datos: DatosCupon) => enviar<{ idCupon: number }>('post', '/cupones', datos),
  editar: (id: number, datos: DatosCupon) => enviar('put', `/cupones/${id}`, datos),
  desactivar: (id: number) => enviar('delete', `/cupones/${id}`),
};
