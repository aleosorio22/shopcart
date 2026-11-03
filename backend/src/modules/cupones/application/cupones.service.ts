import type { Pagina } from '../../../core/db/sql-gateway.js';
import type { Cupon, CuponesRepository, FiltroCupones } from '../domain/cupones.js';

export class CuponesService {
  constructor(private readonly repositorio: CuponesRepository) {}

  async guardar(actor: number, cupon: Cupon, idCupon?: number): Promise<{ idCupon: number }> {
    return { idCupon: await this.repositorio.guardar(actor, cupon, idCupon) };
  }

  listar(actor: number, filtro: FiltroCupones): Promise<Pagina> {
    return this.repositorio.listar(actor, filtro);
  }

  desactivar(actor: number, idCupon: number): Promise<void> {
    return this.repositorio.desactivar(actor, idCupon);
  }
}
