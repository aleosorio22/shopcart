import { z } from 'zod';
import type { Fila } from '../../../core/db/sql-gateway.js';
import type { Idempotencia } from '../../../core/http/route.js';
import { id, textoCorto } from '../../../core/http/esquemas.js';

export const iniciarSchema = z
  .object({ idMetodoEnvio: id, idDireccion: id.optional(), idSucursalRecoger: id.optional() })
  .refine(({ idDireccion, idSucursalRecoger }) => Boolean(idDireccion) !== Boolean(idSucursalRecoger), 'Indique direccion o sucursal, solo una');

// Solo se recibe el token de la pasarela: los datos de tarjeta nunca tocan este sistema.
export const pagoSchema = z.object({
  idMetodoPago: id,
  tokenPago: textoCorto(200),
  nitFactura: z.string().regex(/^(CF|\d{1,14}[0-9Kk]?)$/, 'NIT invalido').default('CF'),
  nombreFactura: z.string().trim().max(200).optional(),
});

export type DatosCheckout = z.infer<typeof iniciarSchema>;
export type DatosPago = z.infer<typeof pagoSchema>;

export interface Checkout {
  IDCheckout: string | number;
  Subtotal: number;
  DescuentoCupon: number;
  CostoEnvio: number;
  Total: number;
  Estado: 'ACTIVO' | 'COMPLETADO' | 'EXPIRADO' | 'CANCELADO';
  ExpiraEn: Date;
  IDPedido?: string | number | null;
}

export interface PedidoCreado {
  IDPedido: string | number;
  NumeroPedido: string;
  Total: number;
  Estado: string;
}

export interface CobroConfirmado {
  idUsuario: number;
  idCheckout: number;
  idMetodoPago: number;
  referencia: string;
  monto: number;
  nitFactura: string;
  nombreFactura?: string | undefined;
}

export interface CheckoutRepository {
  opcionesEnvio(idUsuario: number, idDireccion?: number): Promise<Fila[]>;
  iniciarPago(idUsuario: number, datos: DatosCheckout, idempotencia: Idempotencia): Promise<Checkout>;
  obtener(idUsuario: number, idCheckout: number): Promise<Checkout>;
  cancelar(idUsuario: number, idCheckout: number): Promise<void>;
  registrarRechazo(idUsuario: number, idCheckout: number, idMetodoPago: number, referencia: string, mensaje: string): Promise<void>;
  crearPedido(cobro: CobroConfirmado, idempotencia: Idempotencia): Promise<PedidoCreado>;
}

export interface SolicitudCobro {
  /** La misma llave nunca produce dos cobros aprobados. */
  llave: string;
  monto: number;
  tokenPago: string;
}

export interface ResultadoCobro {
  aprobado: boolean;
  referencia: string;
  mensaje: string;
}

export interface PasarelaPago {
  cobrar(solicitud: SolicitudCobro): Promise<ResultadoCobro>;
}
