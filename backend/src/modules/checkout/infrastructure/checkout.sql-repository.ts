import { sp, type Fila, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Idempotencia } from '../../../core/http/route.js';
import type { Checkout, CheckoutRepository, CobroConfirmado, DatosCheckout, PedidoCreado } from '../domain/checkout.js';

function unico<T>([fila]: T[]): T {
  if (fila === undefined) throw new Error('El procedimiento no devolvio resultado');
  return fila;
}

export class CheckoutSqlRepository implements CheckoutRepository {
  constructor(private readonly db: SqlGateway) {}

  opcionesEnvio(idUsuario: number, idDireccion?: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Envios_ListarOpciones', { IDDireccion: sp.int(idDireccion), IDUsuario: sp.int(idUsuario) });
  }

  async iniciarPago(idUsuario: number, datos: DatosCheckout, { llave, hashSolicitud }: Idempotencia): Promise<Checkout> {
    return unico(await this.db.consultar<Checkout>('Api.SP_Checkout_IniciarPago', {
      IDUsuario: sp.int(idUsuario),
      Llave: sp.uuid(llave),
      HashSolicitud: sp.hash(hashSolicitud),
      IDMetodoEnvio: sp.smallint(datos.idMetodoEnvio),
      IDDireccion: sp.int(datos.idDireccion),
      IDSucursalRecoger: sp.int(datos.idSucursalRecoger),
    }));
  }

  async obtener(idUsuario: number, idCheckout: number): Promise<Checkout> {
    return unico(await this.db.consultar<Checkout>('Api.SP_Checkout_Obtener', { IDUsuario: sp.int(idUsuario), IDCheckout: sp.bigint(idCheckout) }));
  }

  cancelar(idUsuario: number, idCheckout: number): Promise<void> {
    return this.db.ejecutar('Api.SP_Checkout_Cancelar', { IDUsuario: sp.int(idUsuario), IDCheckout: sp.bigint(idCheckout) });
  }

  registrarRechazo(idUsuario: number, idCheckout: number, idMetodoPago: number, referencia: string, mensaje: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Pagos_RegistrarRechazo', {
      IDUsuario: sp.int(idUsuario), IDCheckout: sp.bigint(idCheckout), IDMetodoPago: sp.smallint(idMetodoPago), ReferenciaPasarela: sp.varchar(referencia), Mensaje: sp.texto(mensaje),
    });
  }

  async crearPedido(cobro: CobroConfirmado, { llave, hashSolicitud }: Idempotencia): Promise<PedidoCreado> {
    return unico(await this.db.consultar<PedidoCreado>('Api.SP_Pedidos_CrearPedido', {
      IDUsuario: sp.int(cobro.idUsuario),
      IDCheckout: sp.bigint(cobro.idCheckout),
      Llave: sp.uuid(llave),
      HashSolicitud: sp.hash(hashSolicitud),
      IDMetodoPago: sp.smallint(cobro.idMetodoPago),
      ReferenciaPasarela: sp.varchar(cobro.referencia),
      MontoCobrado: sp.decimal(cobro.monto),
      NITFactura: sp.varchar(cobro.nitFactura),
      NombreFactura: sp.texto(cobro.nombreFactura),
    }));
  }
}
