import type { Fila } from '../../../core/db/sql-gateway.js';
import type { ConfiguracionRepository, Tarifa } from '../domain/configuracion.js';

export class ConfiguracionService {
  constructor(private readonly repositorio: ConfiguracionRepository) {}

  listarParametros(actor: number): Promise<Fila[]> {
    return this.repositorio.listarParametros(actor);
  }

  guardarParametro(actor: number, clave: string, valor: string): Promise<void> {
    return this.repositorio.guardarParametro(actor, clave, valor);
  }

  guardarTarifa(actor: number, tarifa: Tarifa): Promise<void> {
    return this.repositorio.guardarTarifa(actor, tarifa);
  }
}
