import { z } from 'zod';
import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import { fecha, fechaHora, paginado, rangoFechas } from '../../../core/http/esquemas.js';

const rango = z.object({ desde: fecha, hasta: fecha });
export const ventasSchema = rangoFechas.and(z.object({ agrupacion: z.enum(['DIA', 'SEMANA', 'MES']).default('DIA') }));
export const topSchema = rangoFechas.and(z.object({ limite: z.coerce.number().int().min(1).max(50).default(10) }));
export const margenSchema = rango.extend(paginado.shape);
export const bitacoraSchema = paginado.extend({
  modulo: z.string().trim().max(30).optional(),
  entidad: z.string().trim().max(60).optional(),
  idEntidad: z.string().trim().max(60).optional(),
  desde: fechaHora.optional(),
  hasta: fechaHora.optional(),
});

export interface Rango {
  desde: string;
  hasta: string;
}
export type FiltroBitacora = z.infer<typeof bitacoraSchema>;

export interface ReportesRepository {
  resumen(actor: number, rango: Rango): Promise<Fila | undefined>;
  ventasPorPeriodo(actor: number, rango: Rango, agrupacion: string): Promise<Fila[]>;
  ventasPorCategoria(actor: number, rango: Rango): Promise<Fila[]>;
  topProductos(actor: number, rango: Rango, limite: number): Promise<Fila[]>;
  carritosAbandonados(actor: number, paginado: Paginacion): Promise<Pagina>;
  margenPorProducto(actor: number, rango: Rango, paginado: Paginacion): Promise<Pagina>;
  consultarBitacora(actor: number, filtro: FiltroBitacora): Promise<Pagina>;
}
