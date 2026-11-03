import { aPagina, paginacion, sp, type Fila, type Pagina, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Ajuste, Bodega, Entrada, FiltroExistencia, FiltroKardex, FiltroSucursal, InventarioRepository, Sucursal, Traslado } from '../domain/inventario.js';

export class InventarioSqlRepository implements InventarioRepository {
  constructor(private readonly db: SqlGateway) {}

  registrarEntrada(actor: number, entrada: Entrada): Promise<void> {
    return this.db.ejecutar('Api.SP_Inventario_RegistrarEntrada', {
      IDUsuarioActor: sp.int(actor),
      IDVariante: sp.int(entrada.idVariante),
      IDBodega: sp.int(entrada.idBodega),
      Cantidad: sp.int(entrada.cantidad),
      CostoUnitario: sp.costo(entrada.costoUnitario),
      Motivo: sp.texto(entrada.motivo),
      ReferenciaDocumento: sp.texto(entrada.referenciaDocumento),
    });
  }

  ajustar(actor: number, ajuste: Ajuste): Promise<void> {
    return this.db.ejecutar('Api.SP_Inventario_AjustarExistencia', {
      IDUsuarioActor: sp.int(actor), IDVariante: sp.int(ajuste.idVariante), IDBodega: sp.int(ajuste.idBodega), Cantidad: sp.int(ajuste.cantidad), Motivo: sp.texto(ajuste.motivo),
    });
  }

  trasladar(actor: number, traslado: Traslado): Promise<void> {
    return this.db.ejecutar('Api.SP_Inventario_TrasladarExistencia', {
      IDUsuarioActor: sp.int(actor),
      IDVariante: sp.int(traslado.idVariante),
      IDBodegaOrigen: sp.int(traslado.idBodegaOrigen),
      IDBodegaDestino: sp.int(traslado.idBodegaDestino),
      Cantidad: sp.int(traslado.cantidad),
      Motivo: sp.texto(traslado.motivo),
    });
  }

  async consultarExistencia(actor: number, filtro: FiltroExistencia): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Inventario_ConsultarExistencia', {
      IDUsuarioActor: sp.int(actor), Texto: sp.texto(filtro.texto), IDBodega: sp.int(filtro.idBodega), SoloBajoMinimo: sp.bit(filtro.soloBajoMinimo), ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }

  async consultarKardex(actor: number, filtro: FiltroKardex): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Inventario_ConsultarKardex', {
      IDUsuarioActor: sp.int(actor), IDVariante: sp.int(filtro.idVariante), IDBodega: sp.int(filtro.idBodega), Desde: sp.fechaHora(filtro.desde && new Date(filtro.desde)), Hasta: sp.fechaHora(filtro.hasta && new Date(filtro.hasta)), ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }

  conciliar(actor: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Inventario_ConciliarKardex', { IDUsuarioActor: sp.int(actor) });
  }

  listarBodegas(): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Inventario_ListarBodegas');
  }

  async guardarBodega(actor: number, bodega: Bodega, idBodega?: number): Promise<number> {
    const [fila] = await this.db.consultar<{ IDBodega: number }>('Api.SP_Inventario_GuardarBodega', {
      IDUsuarioActor: sp.int(actor),
      IDBodega: sp.int(idBodega),
      IDSucursal: sp.int(bodega.idSucursal),
      Codigo: sp.varchar(bodega.codigo),
      Nombre: sp.texto(bodega.nombre),
      PermiteVentaEnLinea: sp.bit(bodega.permiteVentaEnLinea),
      Prioridad: sp.smallint(bodega.prioridad),
      Activo: sp.bit(bodega.activo),
    });
    if (!fila) throw new Error('Guardar bodega no devolvio el registro');
    return fila.IDBodega;
  }

  listarSucursales(filtro: FiltroSucursal): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Inventario_ListarSucursales', { SoloRecoger: sp.bit(filtro.soloRecoger), IDVariante: sp.int(filtro.idVariante) });
  }

  async guardarSucursal(actor: number, sucursal: Sucursal, idSucursal?: number): Promise<number> {
    const [fila] = await this.db.consultar<{ IDSucursal: number }>('Api.SP_Inventario_GuardarSucursal', {
      IDUsuarioActor: sp.int(actor),
      IDSucursal: sp.int(idSucursal),
      Codigo: sp.varchar(sucursal.codigo),
      Nombre: sp.texto(sucursal.nombre),
      IDMunicipio: sp.int(sucursal.idMunicipio),
      Direccion: sp.texto(sucursal.direccion),
      Telefono: sp.varchar(sucursal.telefono),
      Horario: sp.texto(sucursal.horario),
      PermiteRecoger: sp.bit(sucursal.permiteRecoger),
      Activo: sp.bit(sucursal.activo),
    });
    if (!fila) throw new Error('Guardar sucursal no devolvio el registro');
    return fila.IDSucursal;
  }
}
