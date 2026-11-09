import { enviar, obtener } from '../api/cliente';

export interface OpcionEnvio {
  IDMetodoEnvio: number;
  Codigo: string;
  Nombre: string;
  EsRecogerEnTienda: boolean;
  Costo: number | null;
  MontoEnvioGratis: number | null;
  DiasEstimados: number | null;
}
export interface Sucursal {
  IDSucursal: number;
  Codigo: string;
  Nombre: string;
  Direccion: string;
  Telefono: string | null;
  Horario: string | null;
  PermiteRecoger: boolean;
  Municipio: string;
  Departamento: string;
  Disponible: number | null;
}
export interface Checkout {
  IDCheckout: string | number;
  Subtotal: number;
  DescuentoCupon: number;
  CostoEnvio: number;
  Total: number;
  Estado: 'ACTIVO' | 'COMPLETADO' | 'EXPIRADO' | 'CANCELADO';
  ExpiraEn: string;
}
export interface PedidoCreado {
  IDPedido: string | number;
  NumeroPedido: string;
  Total: number;
  Estado: string;
}
export interface DatosInicio {
  idMetodoEnvio: number;
  idDireccion?: number;
  idSucursalRecoger?: number;
}
export interface DatosPago {
  idMetodoPago: number;
  tokenPago: string;
  nitFactura: string;
  nombreFactura?: string;
}

/** La llave de idempotencia la genera quien llama: un doble clic reusa la misma y el backend no cobra dos veces. */
const conLlave = (llave: string) => ({ headers: { 'Idempotency-Key': llave } });

export const checkoutService = {
  envios: (idDireccion?: number) => obtener<OpcionEnvio[]>('/checkout/envios', { idDireccion }),
  sucursales: (idVariante?: number) => obtener<Sucursal[]>('/inventario/sucursales', { soloRecoger: true, idVariante }),
  iniciar: (datos: DatosInicio, llave: string) => enviar<Checkout>('post', '/checkout', datos, conLlave(llave)),
  pagar: (idCheckout: string | number, datos: DatosPago, llave: string) =>
    enviar<PedidoCreado>('post', `/checkout/${idCheckout}/pagar`, datos, conLlave(llave)),
  cancelar: (idCheckout: string | number) => enviar('delete', `/checkout/${idCheckout}`),
};
