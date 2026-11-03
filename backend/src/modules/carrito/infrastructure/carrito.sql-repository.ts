import { sp, type Fila, type ParametrosSp, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Carrito, CarritoRepository, DuenoCarrito } from '../domain/carrito.js';

const aCarrito = ([resumen = [], lineas = []]: Fila[][]): Carrito => ({ resumen: resumen[0], lineas });

const parametrosDueno = ({ idUsuario, hashInvitado }: DuenoCarrito): ParametrosSp => ({
  IDUsuario: sp.int(idUsuario),
  HashTokenInvitado: sp.hash(idUsuario ? null : hashInvitado),
});

export class CarritoSqlRepository implements CarritoRepository {
  constructor(private readonly db: SqlGateway) {}

  async obtener(dueno: DuenoCarrito): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_Obtener', { ...parametrosDueno(dueno) }));
  }

  async agregar(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_AgregarItem', { ...parametrosDueno(dueno), IDVariante: sp.int(idVariante), Cantidad: sp.int(cantidad) }));
  }

  async actualizarCantidad(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_ActualizarCantidad', { ...parametrosDueno(dueno), IDVariante: sp.int(idVariante), Cantidad: sp.int(cantidad) }));
  }

  async eliminar(dueno: DuenoCarrito, idVariante: number): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_EliminarItem', { ...parametrosDueno(dueno), IDVariante: sp.int(idVariante) }));
  }

  async aplicarCupon(dueno: DuenoCarrito, codigo: string): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_AplicarCupon', { ...parametrosDueno(dueno), Codigo: sp.varchar(codigo) }));
  }

  async quitarCupon(dueno: DuenoCarrito): Promise<Carrito> {
    return aCarrito(await this.db.consultarConjuntos('Api.SP_Carrito_QuitarCupon', { ...parametrosDueno(dueno) }));
  }

  fusionarInvitado(idUsuario: number, hashInvitado: Buffer): Promise<void> {
    return this.db.ejecutar('Api.SP_Carrito_FusionarInvitado', { IDUsuario: sp.int(idUsuario), HashTokenInvitado: sp.hash(hashInvitado) });
  }
}
