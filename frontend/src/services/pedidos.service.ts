import { enviar, obtener, obtenerPagina } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export const ESTADOS_PEDIDO = [
  'PAGADO',
  'EN_PREPARACION',
  'LISTO_RECOGER',
  'DESPACHADO',
  'ENTREGADO',
  'CANCELADO',
  'DEVUELTO_PARCIAL',
  'DEVUELTO_TOTAL',
] as const;
export type EstadoPedido = (typeof ESTADOS_PEDIDO)[number];
export type EstadoAvanzable = 'EN_PREPARACION' | 'LISTO_RECOGER' | 'DESPACHADO' | 'ENTREGADO';

export interface PedidoResumen {
  IDPedido: string;
  NumeroPedido: string;
  FechaPedido: string;
  Total: number;
  Estado: EstadoPedido;
  NombreEstado?: string;
  IDUsuario?: number;
  Correo?: string;
  Cliente?: string;
}
export interface LineaPedido {
  IDPedidoDetalle: string;
  IDVariante: number;
  SKU: string;
  NombreProducto: string;
  Cantidad: number;
  PrecioLista: number;
  DescuentoPromocion: number;
  PrecioUnitario: number;
  DescuentoCupon: number;
  TotalLinea: number;
  BaseLinea: number;
  IVALinea: number;
  CantidadDevuelta: number;
}
export interface DetallePedido {
  pedido: {
    IDPedido: string;
    NumeroPedido: string;
    FechaPedido: string;
    Estado: EstadoPedido;
    EsCancelable: boolean;
    Subtotal: number;
    DescuentoCupon: number;
    CostoEnvio: number;
    Total: number;
    BaseImponible: number;
    IVA: number;
    NITFactura: string;
    NombreFactura: string | null;
    MetodoEnvio: string;
    SucursalRecoger: string | null;
    CodigoCupon: string | null;
    Destinatario: string | null;
    Telefono: string | null;
    Linea1: string | null;
    Linea2: string | null;
    Referencia: string | null;
    Municipio: string | null;
    Departamento: string | null;
  };
  lineas: LineaPedido[];
  historial: { EstadoAnterior: EstadoPedido | null; EstadoNuevo: EstadoPedido; Fecha: string; Motivo: string | null; CorreoUsuario: string | null }[];
}
export type OrdenPedidos = 'FECHA_DESC' | 'FECHA_ASC' | 'TOTAL_DESC' | 'TOTAL_ASC';
export interface FiltroPedidos extends FiltroPaginado {
  estado?: EstadoPedido;
  textoCliente?: string;
  desde?: string;
  hasta?: string;
  orden?: OrdenPedidos;
}
export interface Reembolso {
  IDReembolso: string;
  IDPedido: string;
  NumeroPedido: string;
  IDDevolucion: string | null;
  Monto: number;
  Estado: 'PENDIENTE' | 'PROCESADO';
  Referencia: string | null;
  Fecha: string;
}
export interface DatosDevolucion {
  motivo: string;
  lineas: { idPedidoDetalle: number; cantidad: number; reingresaInventario: boolean }[];
}

export const pedidosService = {
  mios: (filtro: FiltroPaginado) => obtenerPagina<PedidoResumen>('/pedidos/mios', filtro),
  listar: (filtro: FiltroPedidos) => obtenerPagina<PedidoResumen>('/pedidos', filtro),
  detalle: (id: string | number) => obtener<DetallePedido>(`/pedidos/${id}`),
  cambiarEstado: (id: string | number, estado: EstadoAvanzable, motivo?: string) =>
    enviar('patch', `/pedidos/${id}/estado`, { estado, motivo }),
  cancelar: (id: string | number, motivo: string) => enviar('post', `/pedidos/${id}/cancelar`, { motivo }),
  devolver: (id: string | number, datos: DatosDevolucion) => enviar('post', `/pedidos/${id}/devoluciones`, datos),
  reembolsos: (filtro: FiltroPaginado & { estado?: 'PENDIENTE' | 'PROCESADO' }) =>
    obtenerPagina<Reembolso>('/pedidos/reembolsos', filtro),
  procesarReembolso: (id: string, referencia: string) => enviar('post', `/pedidos/reembolsos/${id}/procesar`, { referencia }),
};
