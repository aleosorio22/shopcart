import { aPagina, paginacion, sp, type Fila, type Pagina, type Paginacion, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Anuncio, MarketingRepository, Promocion } from '../domain/marketing.js';

export class MarketingSqlRepository implements MarketingRepository {
  constructor(private readonly db: SqlGateway) {}

  async guardarPromocion(actor: number, promocion: Promocion, idPromocion?: number): Promise<number> {
    const alcance = promocion.alcance.map((a) => ({ IDCategoria: a.idCategoria, IDMarca: a.idMarca, IDProducto: a.idProducto, IDVariante: a.idVariante }));
    const [fila] = await this.db.consultar<{ IDPromocion: number }>('Api.SP_Marketing_GuardarPromocion', {
      IDUsuarioActor: sp.int(actor),
      IDPromocion: sp.int(idPromocion),
      Nombre: sp.texto(promocion.nombre),
      Slug: sp.varchar(promocion.slug),
      TipoDescuento: sp.varchar(promocion.tipoDescuento),
      Valor: sp.decimal(promocion.valor),
      VigenteDesde: sp.fechaHora(new Date(promocion.vigenteDesde)),
      VigenteHasta: sp.fechaHora(new Date(promocion.vigenteHasta)),
      Activo: sp.bit(promocion.activo),
      AlcanceJson: sp.texto(JSON.stringify(alcance)),
    });
    if (!fila) throw new Error('Guardar promocion no devolvio el registro');
    return fila.IDPromocion;
  }

  async listarPromociones(actor: number, paginado: Paginacion): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Marketing_ListarPromociones', { IDUsuarioActor: sp.int(actor), ...paginacion(paginado) }), paginado);
  }

  async guardarAnuncio(actor: number, anuncio: Anuncio, idAnuncio?: number): Promise<number> {
    const [fila] = await this.db.consultar<{ IDAnuncio: number }>('Api.SP_Marketing_GuardarAnuncio', {
      IDUsuarioActor: sp.int(actor),
      IDAnuncio: sp.int(idAnuncio),
      CodigoZona: sp.varchar(anuncio.codigoZona),
      IDPromocion: sp.int(anuncio.idPromocion),
      Titulo: sp.texto(anuncio.titulo),
      Subtitulo: sp.texto(anuncio.subtitulo),
      ImagenEscritorioUrl: sp.texto(anuncio.imagenEscritorioUrl),
      ImagenMovilUrl: sp.texto(anuncio.imagenMovilUrl),
      UrlDestino: sp.texto(anuncio.urlDestino),
      Orden: sp.smallint(anuncio.orden),
      VigenteDesde: sp.fechaHora(new Date(anuncio.vigenteDesde)),
      VigenteHasta: sp.fechaHora(new Date(anuncio.vigenteHasta)),
      Activo: sp.bit(anuncio.activo),
    });
    if (!fila) throw new Error('Guardar anuncio no devolvio el registro');
    return fila.IDAnuncio;
  }

  async listarAnuncios(actor: number, paginado: Paginacion): Promise<Pagina> {
    return aPagina(await this.db.consultar('Api.SP_Marketing_ListarAnuncios', { IDUsuarioActor: sp.int(actor), ...paginacion(paginado) }), paginado);
  }

  anunciosVigentes(zona: string): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Marketing_AnunciosVigentes', { CodigoZona: sp.varchar(zona) });
  }

  registrarEvento(idAnuncio: number, evento: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Marketing_RegistrarEvento', { IDAnuncio: sp.int(idAnuncio), Evento: sp.varchar(evento) });
  }
}
