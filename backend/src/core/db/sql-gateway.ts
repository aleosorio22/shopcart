/**
 * Puerto de salida hacia la base de datos. Solo permite invocar stored procedures con
 * parametros tipados: no existe ninguna forma de enviar SQL como texto.
 */
export type TipoSp = 'int' | 'smallint' | 'tinyint' | 'bigint' | 'bit' | 'decimal' | 'costo' | 'texto' | 'varchar' | 'fecha' | 'fechaHora' | 'uuid' | 'hash';

export interface ParametroSp {
  readonly tipo: TipoSp;
  readonly valor: unknown;
}

export type ParametrosSp = Record<string, ParametroSp>;

export type Fila = Record<string, unknown>;

const parametro = (tipo: TipoSp) => (valor: unknown): ParametroSp => ({ tipo, valor: valor ?? null });

export const sp = {
  int: parametro('int'),
  smallint: parametro('smallint'),
  tinyint: parametro('tinyint'),
  bigint: parametro('bigint'),
  bit: parametro('bit'),
  decimal: parametro('decimal'),
  costo: parametro('costo'),
  texto: parametro('texto'),
  varchar: parametro('varchar'),
  fecha: parametro('fecha'),
  fechaHora: parametro('fechaHora'),
  uuid: parametro('uuid'),
  hash: parametro('hash'),
};

export interface SqlGateway {
  /** Devuelve el primer conjunto de resultados. */
  consultar<T = Fila>(procedimiento: string, parametros?: ParametrosSp): Promise<T[]>;
  /** Devuelve todos los conjuntos de resultados. */
  consultarConjuntos(procedimiento: string, parametros?: ParametrosSp): Promise<Fila[][]>;
  ejecutar(procedimiento: string, parametros?: ParametrosSp): Promise<void>;
}

export interface Paginacion {
  pagina: number;
  tamanoPagina: number;
}

export const paginacion = ({ pagina, tamanoPagina }: Paginacion): ParametrosSp => ({
  Pagina: sp.int(pagina),
  TamanoPagina: sp.int(tamanoPagina),
});

export interface Pagina<T = Fila> {
  filas: T[];
  total: number;
  pagina: number;
  tamanoPagina: number;
}

/** Los SP de listado devuelven TotalRegistros en cada fila; aqui se convierte en metadato. */
export function aPagina(filas: Fila[], { pagina, tamanoPagina }: Paginacion): Pagina {
  const total = Number(filas[0]?.TotalRegistros ?? 0);
  const limpias = filas.map((fila) => Object.fromEntries(Object.entries(fila).filter(([columna]) => columna !== 'TotalRegistros')));
  return { filas: limpias, total, pagina, tamanoPagina };
}
