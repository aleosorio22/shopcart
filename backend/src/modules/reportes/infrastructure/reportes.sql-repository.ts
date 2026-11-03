import { aPagina, paginacion, sp, type Fila, type Pagina, type Paginacion, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { FiltroBitacora, Rango, ReportesRepository } from '../domain/reportes.js';

export class ReportesSqlRepository implements ReportesRepository {
  constructor(private readonly db: SqlGateway) {}

  async resumen(actor: number, { desde, hasta }: Rango): Promise<Fila | undefined> {
    const [fila] = await this.db.consultar('Api.SP_Dashboard_Resumen', { IDUsuarioActor: sp.int(actor), Desde: sp.fecha(desde), Hasta: sp.fecha(hasta) });
    return fila;
  }

  ventasPorPeriodo(actor: number, { desde, hasta }: Rango, agrupacion: string): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Dashboard_VentasPorPeriodo', { IDUsuarioActor: sp.int(actor), Desde: sp.fecha(desde), Hasta: sp.fecha(hasta), Agrupacion: sp.varchar(agrupacion) });
  }

  ventasPorCategoria(actor: number, { desde, hasta }: Rango): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Dashboard_VentasPorCategoria', { IDUsuarioActor: sp.int(actor), Desde: sp.fecha(desde), Hasta: sp.fecha(hasta) });
  }

  topProductos(actor: number, { desde, hasta }: Rango, limite: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Dashboard_TopProductos', { IDUsuarioActor: sp.int(actor), Desde: sp.fecha(desde), Hasta: sp.fecha(hasta), Limite: sp.int(limite) });
  }

  async carritosAbandonados(actor: number, paginado: Paginacion): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Dashboard_CarritosAbandonados', { IDUsuarioActor: sp.int(actor), ...paginacion(paginado) }), paginado);
  }

  async margenPorProducto(actor: number, { desde, hasta }: Rango, paginado: Paginacion): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Dashboard_MargenPorProducto', { IDUsuarioActor: sp.int(actor), Desde: sp.fecha(desde), Hasta: sp.fecha(hasta), ...paginacion(paginado) }), paginado);
  }

  async consultarBitacora(actor: number, filtro: FiltroBitacora): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Bitacora_Consultar', {
      IDUsuarioActor: sp.int(actor),
      Modulo: sp.varchar(filtro.modulo),
      Entidad: sp.varchar(filtro.entidad),
      IDEntidad: sp.varchar(filtro.idEntidad),
      Desde: sp.fechaHora(filtro.desde && new Date(filtro.desde)),
      Hasta: sp.fechaHora(filtro.hasta && new Date(filtro.hasta)),
      ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }
}
