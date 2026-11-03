import { aPagina, paginacion, sp, type Pagina, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Cupon, CuponesRepository, FiltroCupones } from '../domain/cupones.js';

export class CuponesSqlRepository implements CuponesRepository {
  constructor(private readonly db: SqlGateway) {}

  async guardar(actor: number, cupon: Cupon, idCupon?: number): Promise<number> {
    const [fila] = await this.db.consultar<{ IDCupon: number }>('Api.SP_Cupones_Guardar', {
      IDUsuarioActor: sp.int(actor),
      IDCupon: sp.int(idCupon),
      Codigo: sp.varchar(cupon.codigo),
      Descripcion: sp.texto(cupon.descripcion),
      TipoDescuento: sp.varchar(cupon.tipoDescuento),
      Valor: sp.decimal(cupon.valor),
      DescuentoMaximo: sp.decimal(cupon.descuentoMaximo),
      MontoMinimo: sp.decimal(cupon.montoMinimo),
      VigenteDesde: sp.fechaHora(new Date(cupon.vigenteDesde)),
      VigenteHasta: sp.fechaHora(new Date(cupon.vigenteHasta)),
      LimiteTotal: sp.int(cupon.limiteTotal),
      LimitePorCliente: sp.int(cupon.limitePorCliente),
      IDCategoria: sp.int(cupon.idCategoria),
      Activo: sp.bit(cupon.activo),
    });
    if (!fila) throw new Error('Guardar cupon no devolvio el registro');
    return fila.IDCupon;
  }

  async listar(actor: number, filtro: FiltroCupones): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Cupones_Listar', { IDUsuarioActor: sp.int(actor), Texto: sp.varchar(filtro.texto), Activo: sp.bit(filtro.activo), ...paginacion(filtro) });
    return aPagina(filas, filtro);
  }

  desactivar(actor: number, idCupon: number): Promise<void> {
    return this.db.ejecutar('Api.SP_Cupones_Desactivar', { IDUsuarioActor: sp.int(actor), IDCupon: sp.int(idCupon) });
  }
}
