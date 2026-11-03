import { aPagina, paginacion, sp, type Fila, type Pagina, type Paginacion, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { DetallePedido, Devolucion, FiltroPedidos, FiltroReembolsos, PedidosRepository } from '../domain/pedidos.js';

export class PedidosSqlRepository implements PedidosRepository {
  constructor(private readonly db: SqlGateway) {}

  async listarPropios(idUsuario: number, paginado: Paginacion): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Pedidos_ListarMisPedidos', { IDUsuario: sp.int(idUsuario), ...paginacion(paginado) }), paginado);
  }

  async listar(actor: number, filtro: FiltroPedidos): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Pedidos_Listar', {
      IDUsuarioActor: sp.int(actor),
      Estado: sp.varchar(filtro.estado),
      IDUsuario: sp.int(filtro.idUsuario),
      TextoCliente: sp.texto(filtro.textoCliente),
      Desde: sp.fecha(filtro.desde),
      Hasta: sp.fecha(filtro.hasta),
      Orden: sp.varchar(filtro.orden),
      ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }

  async obtenerDetalle(actor: number, idPedido: number): Promise<DetallePedido> {
    const [pedidos = [], lineas = [], historial = []] = await this.db.consultarConjuntos('Api.SP_Pedidos_ObtenerDetalle', { IDUsuarioActor: sp.int(actor), IDPedido: sp.bigint(idPedido) });
    return { pedido: pedidos[0], lineas, historial };
  }

  cambiarEstado(actor: number, idPedido: number, estado: string, motivo?: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Pedidos_CambiarEstado', { IDUsuarioActor: sp.int(actor), IDPedido: sp.bigint(idPedido), EstadoNuevo: sp.varchar(estado), Motivo: sp.texto(motivo) });
  }

  cancelar(actor: number, idPedido: number, motivo: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Pedidos_CancelarPedido', { IDUsuarioActor: sp.int(actor), IDPedido: sp.bigint(idPedido), Motivo: sp.texto(motivo) });
  }

  async crearDevolucion(actor: number, idPedido: number, devolucion: Devolucion): Promise<Fila> {
    const lineas = devolucion.lineas.map((l) => ({ IDPedidoDetalle: l.idPedidoDetalle, Cantidad: l.cantidad, ReingresaInventario: l.reingresaInventario, IDBodega: l.idBodega ?? null }));
    const [fila] = await this.db.consultar('Api.SP_Pedidos_CrearDevolucion', {
      IDUsuarioActor: sp.int(actor), IDPedido: sp.bigint(idPedido), Motivo: sp.texto(devolucion.motivo), LineasJson: sp.texto(JSON.stringify(lineas)),
    });
    if (!fila) throw new Error('La devolucion no devolvio resultado');
    return fila;
  }

  async listarReembolsos(actor: number, filtro: FiltroReembolsos): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Pedidos_ListarReembolsos', { IDUsuarioActor: sp.int(actor), Estado: sp.varchar(filtro.estado), ...paginacion(filtro) }), filtro);
  }

  procesarReembolso(actor: number, idReembolso: number, referencia: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Pedidos_ProcesarReembolso', { IDUsuarioActor: sp.int(actor), IDReembolso: sp.bigint(idReembolso), Referencia: sp.varchar(referencia) });
  }
}
