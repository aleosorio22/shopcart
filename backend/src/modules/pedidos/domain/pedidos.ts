import { z } from 'zod';
import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import { fecha, id, paginado, textoCorto } from '../../../core/http/esquemas.js';

export const ESTADOS = ['PAGADO', 'EN_PREPARACION', 'LISTO_RECOGER', 'DESPACHADO', 'ENTREGADO', 'CANCELADO', 'DEVUELTO_PARCIAL', 'DEVUELTO_TOTAL'] as const;

export const filtroPedidosSchema = paginado.extend({
  estado: z.enum(ESTADOS).optional(),
  idUsuario: id.optional(),
  textoCliente: z.string().trim().max(100).optional(),
  desde: fecha.optional(),
  hasta: fecha.optional(),
  orden: z.enum(['FECHA_DESC', 'FECHA_ASC', 'TOTAL_DESC', 'TOTAL_ASC']).default('FECHA_DESC'),
});
export const estadoSchema = z.object({ estado: z.enum(['EN_PREPARACION', 'LISTO_RECOGER', 'DESPACHADO', 'ENTREGADO']), motivo: z.string().trim().max(300).optional() });
export const motivoSchema = z.object({ motivo: textoCorto(300) });
export const devolucionSchema = z.object({
  motivo: textoCorto(300),
  lineas: z
    .array(z.object({ idPedidoDetalle: id, cantidad: z.number().int().positive(), reingresaInventario: z.boolean().default(true), idBodega: id.optional() }))
    .min(1)
    .max(100),
});
export const filtroReembolsosSchema = paginado.extend({ estado: z.enum(['PENDIENTE', 'PROCESADO']).optional() });
export const reembolsoSchema = z.object({ referencia: textoCorto(100) });

export type FiltroPedidos = z.infer<typeof filtroPedidosSchema>;
export type Devolucion = z.infer<typeof devolucionSchema>;
export type FiltroReembolsos = z.infer<typeof filtroReembolsosSchema>;

export interface DetallePedido {
  pedido: Fila | undefined;
  lineas: Fila[];
  historial: Fila[];
}

export interface PedidosRepository {
  listarPropios(idUsuario: number, paginado: Paginacion): Promise<Pagina>;
  listar(actor: number, filtro: FiltroPedidos): Promise<Pagina>;
  obtenerDetalle(actor: number, idPedido: number): Promise<DetallePedido>;
  cambiarEstado(actor: number, idPedido: number, estado: string, motivo?: string): Promise<void>;
  cancelar(actor: number, idPedido: number, motivo: string): Promise<void>;
  crearDevolucion(actor: number, idPedido: number, devolucion: Devolucion): Promise<Fila>;
  listarReembolsos(actor: number, filtro: FiltroReembolsos): Promise<Pagina>;
  procesarReembolso(actor: number, idReembolso: number, referencia: string): Promise<void>;
}
