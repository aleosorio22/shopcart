import sql from 'mssql';
import type { Logger } from 'pino';
import { AppError } from '../errors/app-error.js';
import type { Fila, ParametroSp, ParametrosSp, SqlGateway, TipoSp } from './sql-gateway.js';

const ERROR_DEADLOCK = 1205;
const MAXIMO_REINTENTOS = 3;
const RANGO_NEGOCIO = { desde: 51000, hasta: 59999 };
const SP_ERRORES = 'Api.SP_Config_ListarErrores';

const TIPOS: Record<TipoSp, () => sql.ISqlType> = {
  int: () => sql.Int(),
  smallint: () => sql.SmallInt(),
  tinyint: () => sql.TinyInt(),
  bigint: () => sql.BigInt(),
  bit: () => sql.Bit(),
  decimal: () => sql.Decimal(18, 2),
  costo: () => sql.Decimal(18, 4),
  texto: () => sql.NVarChar(sql.MAX),
  varchar: () => sql.VarChar(sql.MAX),
  fecha: () => sql.Date(),
  fechaHora: () => sql.DateTime2(3),
  uuid: () => sql.UniqueIdentifier(),
  hash: () => sql.VarBinary(32),
};

interface ErrorNegocio {
  CodigoNegocio: string;
  HttpStatus: number;
}

export interface OpcionesConexion {
  server: string;
  port: number;
  database: string;
  user: string;
  password: string;
  encrypt: boolean;
  trustServerCertificate: boolean;
  maximoConexiones: number;
}

export class MssqlGateway implements SqlGateway {
  private pool: sql.ConnectionPool | undefined;
  private catalogoErrores = new Map<number, ErrorNegocio>();

  constructor(
    private readonly opciones: OpcionesConexion,
    private readonly logger: Logger,
  ) {}

  async conectar(cargarCatalogoErrores: boolean): Promise<void> {
    const { maximoConexiones, encrypt, trustServerCertificate, ...conexion } = this.opciones;
    this.pool = await new sql.ConnectionPool({
      ...conexion,
      pool: { max: maximoConexiones, min: 2, idleTimeoutMillis: 30_000 },
      options: { encrypt, trustServerCertificate, appName: 'shopcart-api' },
      requestTimeout: 15_000,
    }).connect();
    if (cargarCatalogoErrores) await this.cargarCatalogoErrores();
  }

  async cerrar(): Promise<void> {
    await this.pool?.close();
  }

  async consultar<T = Fila>(procedimiento: string, parametros: ParametrosSp = {}): Promise<T[]> {
    const conjuntos = await this.correr(procedimiento, parametros);
    return (conjuntos[0] ?? []) as T[];
  }

  consultarConjuntos(procedimiento: string, parametros: ParametrosSp = {}): Promise<Fila[][]> {
    return this.correr(procedimiento, parametros);
  }

  async ejecutar(procedimiento: string, parametros: ParametrosSp = {}): Promise<void> {
    await this.correr(procedimiento, parametros);
  }

  private async cargarCatalogoErrores(): Promise<void> {
    const filas = await this.consultar<ErrorNegocio & { Codigo: number }>(SP_ERRORES);
    this.catalogoErrores = new Map(filas.map((fila) => [fila.Codigo, fila]));
  }

  /** Un deadlock ya hizo rollback completo en el motor: reintentar es seguro. */
  private async correr(procedimiento: string, parametros: ParametrosSp): Promise<Fila[][]> {
    for (let intento = 1; ; intento += 1) {
      try {
        const resultado = await this.solicitud(parametros).execute(procedimiento);
        return resultado.recordsets as unknown as Fila[][];
      } catch (error) {
        const numero = numeroError(error);
        if (numero === ERROR_DEADLOCK && intento < MAXIMO_REINTENTOS) {
          this.logger.warn({ procedimiento, intento }, 'Deadlock; se reintenta');
          await esperar(50 * intento);
          continue;
        }
        throw this.traducir(error, numero);
      }
    }
  }

  private solicitud(parametros: ParametrosSp): sql.Request {
    if (!this.pool) throw new Error('El pool de SQL Server no esta conectado');
    const solicitud = this.pool.request();
    for (const [nombre, parametro] of Object.entries(parametros)) {
      solicitud.input(nombre, TIPOS[parametro.tipo](), valorSp(parametro));
    }
    return solicitud;
  }

  private traducir(error: unknown, numero: number | undefined): Error {
    if (numero !== undefined && numero >= RANGO_NEGOCIO.desde && numero <= RANGO_NEGOCIO.hasta) {
      const conocido = this.catalogoErrores.get(numero);
      return new AppError(conocido?.CodigoNegocio ?? 'ERROR_NEGOCIO', conocido?.HttpStatus ?? 409, (error as Error).message);
    }
    return error as Error;
  }
}

function numeroError(error: unknown): number | undefined {
  const numero = (error as { number?: unknown }).number;
  return typeof numero === 'number' ? numero : undefined;
}

function valorSp({ tipo, valor }: ParametroSp): unknown {
  return tipo === 'bigint' && valor !== null ? String(valor) : valor;
}

const esperar = (ms: number) => new Promise((resolver) => setTimeout(resolver, ms));
