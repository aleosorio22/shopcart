import pino from 'pino';
import type { Fila, ParametrosSp, SqlGateway } from '../src/core/db/sql-gateway.js';

export const loggerSilencioso = pino({ level: 'silent' });

type Respuesta = Fila[][] | ((parametros: ParametrosSp) => Fila[][]);

/** Base de datos falsa: el dominio solo conoce el puerto, asi que se prueba sin SQL Server. */
export class SqlFalso implements SqlGateway {
  readonly llamadas: Array<{ procedimiento: string; parametros: ParametrosSp }> = [];
  private readonly respuestas = new Map<string, Respuesta>();

  responder(procedimiento: string, respuesta: Respuesta): this {
    this.respuestas.set(procedimiento, respuesta);
    return this;
  }

  llamadasA(procedimiento: string) {
    return this.llamadas.filter((l) => l.procedimiento === procedimiento);
  }

  private correr(procedimiento: string, parametros: ParametrosSp): Fila[][] {
    this.llamadas.push({ procedimiento, parametros });
    const respuesta = this.respuestas.get(procedimiento);
    if (typeof respuesta === 'function') return respuesta(parametros);
    return respuesta ?? [[]];
  }

  async consultar<T = Fila>(procedimiento: string, parametros: ParametrosSp = {}): Promise<T[]> {
    return (this.correr(procedimiento, parametros)[0] ?? []) as T[];
  }

  async consultarConjuntos(procedimiento: string, parametros: ParametrosSp = {}): Promise<Fila[][]> {
    return this.correr(procedimiento, parametros);
  }

  async ejecutar(procedimiento: string, parametros: ParametrosSp = {}): Promise<void> {
    this.correr(procedimiento, parametros);
  }
}
