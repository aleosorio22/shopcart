import { AppError } from '../../../core/errors/app-error.js';
import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import type { DetallePedido, Devolucion, FiltroPedidos, FiltroReembolsos, PedidosRepository } from '../domain/pedidos.js';

export class PedidosService {
  constructor(private readonly repositorio: PedidosRepository) {}

  listarPropios(idUsuario: number, paginado: Paginacion): Promise<Pagina> {
    return this.repositorio.listarPropios(idUsuario, paginado);
  }

  listar(actor: number, filtro: FiltroPedidos): Promise<Pagina> {
    return this.repositorio.listar(actor, filtro);
  }

  obtenerDetalle(actor: number, idPedido: number): Promise<DetallePedido> {
    return this.repositorio.obtenerDetalle(actor, idPedido);
  }

  cambiarEstado(actor: number, idPedido: number, estado: string, motivo?: string): Promise<void> {
    return this.repositorio.cambiarEstado(actor, idPedido, estado, motivo);
  }

  cancelar(actor: number, idPedido: number, motivo: string): Promise<void> {
    return this.repositorio.cancelar(actor, idPedido, motivo);
  }

  crearDevolucion(actor: number, idPedido: number, devolucion: Devolucion): Promise<Fila> {
    const ids = devolucion.lineas.map((linea) => linea.idPedidoDetalle);
    if (new Set(ids).size !== ids.length) throw AppError.datosInvalidos([{ campo: 'lineas', mensaje: 'Una linea no puede repetirse' }]);
    return this.repositorio.crearDevolucion(actor, idPedido, devolucion);
  }

  listarReembolsos(actor: number, filtro: FiltroReembolsos): Promise<Pagina> {
    return this.repositorio.listarReembolsos(actor, filtro);
  }

  procesarReembolso(actor: number, idReembolso: number, referencia: string): Promise<void> {
    return this.repositorio.procesarReembolso(actor, idReembolso, referencia);
  }
}
