import { AppError } from '../../../core/errors/app-error.js';
import type { Fila } from '../../../core/db/sql-gateway.js';
import type { Idempotencia } from '../../../core/http/route.js';
import type { Checkout, CheckoutRepository, DatosCheckout, DatosPago, PasarelaPago, PedidoCreado } from '../domain/checkout.js';

export class CheckoutService {
  constructor(
    private readonly repositorio: CheckoutRepository,
    private readonly pasarela: PasarelaPago,
    private readonly ahora: () => Date = () => new Date(),
  ) {}

  opcionesEnvio(idUsuario: number, idDireccion?: number): Promise<Fila[]> {
    return this.repositorio.opcionesEnvio(idUsuario, idDireccion);
  }

  iniciar(idUsuario: number, datos: DatosCheckout, idempotencia: Idempotencia): Promise<Checkout> {
    return this.repositorio.iniciarPago(idUsuario, datos, idempotencia);
  }

  cancelar(idUsuario: number, idCheckout: number): Promise<void> {
    return this.repositorio.cancelar(idUsuario, idCheckout);
  }

  /**
   * La llave de cobro es el checkout, no la peticion: dos clics, un reintento de red o dos
   * pestanas chocan en la misma llave. La pasarela devuelve el mismo cobro y el SP el mismo pedido.
   */
  async pagar(idUsuario: number, idCheckout: number, pago: DatosPago, idempotencia: Idempotencia): Promise<PedidoCreado> {
    const checkout = await this.repositorio.obtener(idUsuario, idCheckout);
    this.exigirPagable(checkout);

    const { Total: monto } = checkout;
    const cobro = await this.pasarela.cobrar({ llave: `checkout-${idCheckout}`, monto, tokenPago: pago.tokenPago });
    if (!cobro.aprobado) {
      await this.repositorio.registrarRechazo(idUsuario, idCheckout, pago.idMetodoPago, cobro.referencia, cobro.mensaje);
      throw new AppError('PAGO_RECHAZADO', 402, cobro.mensaje);
    }

    return this.repositorio.crearPedido(
      { idUsuario, idCheckout, idMetodoPago: pago.idMetodoPago, referencia: cobro.referencia, monto, nitFactura: pago.nitFactura, nombreFactura: pago.nombreFactura },
      idempotencia,
    );
  }

  private exigirPagable({ Estado, ExpiraEn }: Checkout): void {
    if (Estado === 'COMPLETADO') return;
    if (Estado !== 'ACTIVO') throw new AppError('CHECKOUT_NO_ACTIVO', 409, 'El checkout no esta activo.');
    if (ExpiraEn <= this.ahora()) throw new AppError('CHECKOUT_EXPIRADO', 410, 'La reserva expiro.');
  }
}
