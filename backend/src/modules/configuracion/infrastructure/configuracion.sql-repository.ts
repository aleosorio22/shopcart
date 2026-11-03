import { sp, type Fila, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { ConfiguracionRepository, Tarifa } from '../domain/configuracion.js';

export class ConfiguracionSqlRepository implements ConfiguracionRepository {
  constructor(private readonly db: SqlGateway) {}

  listarParametros(actor: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Config_ListarParametros', { IDUsuarioActor: sp.int(actor) });
  }

  guardarParametro(actor: number, clave: string, valor: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Config_GuardarParametro', { IDUsuarioActor: sp.int(actor), Clave: sp.varchar(clave), Valor: sp.texto(valor) });
  }

  guardarTarifa(actor: number, tarifa: Tarifa): Promise<void> {
    return this.db.ejecutar('Api.SP_Envios_GuardarTarifa', {
      IDUsuarioActor: sp.int(actor),
      IDMetodoEnvio: sp.smallint(tarifa.idMetodoEnvio),
      IDDepartamento: sp.smallint(tarifa.idDepartamento),
      Costo: sp.decimal(tarifa.costo),
      MontoEnvioGratis: sp.decimal(tarifa.montoEnvioGratis),
      DiasEstimados: sp.tinyint(tarifa.diasEstimados),
      Activo: sp.bit(tarifa.activo),
    });
  }
}
