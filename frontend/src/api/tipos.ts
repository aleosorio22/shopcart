/** Formato comun de todas las respuestas del backend. */
export interface RespuestaOk<T> {
  success: true;
  data: T;
  meta?: MetaPagina;
}

export interface MetaPagina {
  total: number;
  pagina: number;
  tamanoPagina: number;
}

export interface Pagina<T> {
  filas: T[];
  meta: MetaPagina;
}

export interface DetalleError {
  campo: string;
  mensaje: string;
}

export interface CuerpoError {
  success: false;
  error: { codigo: string; mensaje: string; detalles?: DetalleError[]; requestId?: string };
}

/** Parametros de cualquier listado paginado del lado del servidor. */
export interface FiltroPaginado {
  pagina?: number;
  tamanoPagina?: number;
}
