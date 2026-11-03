import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import type { Anuncio, MarketingRepository, Promocion } from '../domain/marketing.js';

export class MarketingService {
  constructor(private readonly repositorio: MarketingRepository) {}

  async guardarPromocion(actor: number, promocion: Promocion, idPromocion?: number): Promise<{ idPromocion: number }> {
    return { idPromocion: await this.repositorio.guardarPromocion(actor, promocion, idPromocion) };
  }

  listarPromociones(actor: number, paginado: Paginacion): Promise<Pagina> {
    return this.repositorio.listarPromociones(actor, paginado);
  }

  async guardarAnuncio(actor: number, anuncio: Anuncio, idAnuncio?: number): Promise<{ idAnuncio: number }> {
    return { idAnuncio: await this.repositorio.guardarAnuncio(actor, anuncio, idAnuncio) };
  }

  listarAnuncios(actor: number, paginado: Paginacion): Promise<Pagina> {
    return this.repositorio.listarAnuncios(actor, paginado);
  }

  anunciosVigentes(zona: string): Promise<Fila[]> {
    return this.repositorio.anunciosVigentes(zona);
  }

  registrarEvento(idAnuncio: number, evento: string): Promise<void> {
    return this.repositorio.registrarEvento(idAnuncio, evento);
  }
}
