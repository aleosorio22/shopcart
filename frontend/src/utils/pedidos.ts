import type { EstadoAvanzable, EstadoPedido } from '../services/pedidos.service';

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  PAGADO: 'Pagado',
  EN_PREPARACION: 'En preparacion',
  LISTO_RECOGER: 'Listo para recoger',
  DESPACHADO: 'Despachado',
  ENTREGADO: 'Entregado',
  CANCELADO: 'Cancelado',
  DEVUELTO_PARCIAL: 'Devuelto parcial',
  DEVUELTO_TOTAL: 'Devuelto',
};

export type TonoEstado = 'neutro' | 'info' | 'exito' | 'alerta' | 'peligro';
export const TONO_ESTADO: Record<EstadoPedido, TonoEstado> = {
  PAGADO: 'info',
  EN_PREPARACION: 'alerta',
  LISTO_RECOGER: 'alerta',
  DESPACHADO: 'info',
  ENTREGADO: 'exito',
  CANCELADO: 'peligro',
  DEVUELTO_PARCIAL: 'neutro',
  DEVUELTO_TOTAL: 'neutro',
};

/**
 * Siguientes estados que la UI ofrece. Es solo una guia para no mostrar botones inutiles:
 * la regla real vive en Pedidos.TransicionEstadoPedido y el backend rechaza cualquier otra.
 */
export function siguientesEstados(estado: EstadoPedido, esRecoger: boolean): EstadoAvanzable[] {
  switch (estado) {
    case 'PAGADO':
      return ['EN_PREPARACION'];
    case 'EN_PREPARACION':
      return [esRecoger ? 'LISTO_RECOGER' : 'DESPACHADO'];
    case 'LISTO_RECOGER':
    case 'DESPACHADO':
      return ['ENTREGADO'];
    default:
      return [];
  }
}

export const esDevolvible = (estado: EstadoPedido) => estado === 'ENTREGADO' || estado === 'DEVUELTO_PARCIAL';
