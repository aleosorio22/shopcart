import type { Fila, Pagina } from '../../../core/db/sql-gateway.js';
import type { Ajuste, Bodega, Entrada, FiltroExistencia, FiltroKardex, FiltroSucursal, InventarioRepository, Sucursal, Traslado } from '../domain/inventario.js';

export class InventarioService {
  constructor(private readonly repositorio: InventarioRepository) {}

  registrarEntrada(actor: number, entrada: Entrada): Promise<void> {
    return this.repositorio.registrarEntrada(actor, entrada);
  }

  ajustar(actor: number, ajuste: Ajuste): Promise<void> {
    return this.repositorio.ajustar(actor, ajuste);
  }

  trasladar(actor: number, traslado: Traslado): Promise<void> {
    return this.repositorio.trasladar(actor, traslado);
  }

  consultarExistencia(actor: number, filtro: FiltroExistencia): Promise<Pagina> {
    return this.repositorio.consultarExistencia(actor, filtro);
  }

  consultarKardex(actor: number, filtro: FiltroKardex): Promise<Pagina> {
    return this.repositorio.consultarKardex(actor, filtro);
  }

  async conciliar(actor: number): Promise<{ cuadrado: boolean; diferencias: Fila[] }> {
    const diferencias = await this.repositorio.conciliar(actor);
    return { cuadrado: diferencias.length === 0, diferencias };
  }

  listarBodegas(): Promise<Fila[]> {
    return this.repositorio.listarBodegas();
  }

  async guardarBodega(actor: number, bodega: Bodega, idBodega?: number): Promise<{ idBodega: number }> {
    return { idBodega: await this.repositorio.guardarBodega(actor, bodega, idBodega) };
  }

  listarSucursales(filtro: FiltroSucursal): Promise<Fila[]> {
    return this.repositorio.listarSucursales(filtro);
  }

  async guardarSucursal(actor: number, sucursal: Sucursal, idSucursal?: number): Promise<{ idSucursal: number }> {
    return { idSucursal: await this.repositorio.guardarSucursal(actor, sucursal, idSucursal) };
  }
}
