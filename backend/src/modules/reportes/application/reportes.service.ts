import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import type { FiltroBitacora, Rango, ReportesRepository } from '../domain/reportes.js';

export class ReportesService {
  constructor(private readonly repositorio: ReportesRepository) {}

  resumen(actor: number, rango: Rango): Promise<Fila | undefined> {
    return this.repositorio.resumen(actor, rango);
  }

  ventasPorPeriodo(actor: number, rango: Rango, agrupacion: string): Promise<Fila[]> {
    return this.repositorio.ventasPorPeriodo(actor, rango, agrupacion);
  }

  ventasPorCategoria(actor: number, rango: Rango): Promise<Fila[]> {
    return this.repositorio.ventasPorCategoria(actor, rango);
  }

  topProductos(actor: number, rango: Rango, limite: number): Promise<Fila[]> {
    return this.repositorio.topProductos(actor, rango, limite);
  }

  carritosAbandonados(actor: number, paginado: Paginacion): Promise<Pagina> {
    return this.repositorio.carritosAbandonados(actor, paginado);
  }

  margenPorProducto(actor: number, rango: Rango, paginado: Paginacion): Promise<Pagina> {
    return this.repositorio.margenPorProducto(actor, rango, paginado);
  }

  consultarBitacora(actor: number, filtro: FiltroBitacora): Promise<Pagina> {
    return this.repositorio.consultarBitacora(actor, filtro);
  }
}
