import { isAxiosError } from 'axios';
import type { CuerpoError, DetalleError } from './tipos';

/** Error del API ya normalizado: la UI nunca inspecciona respuestas de axios. */
export class ApiError extends Error {
  readonly codigo: string;
  readonly status: number;
  readonly detalles: DetalleError[];
  readonly requestId?: string;

  constructor(codigo: string, mensaje: string, status: number, detalles: DetalleError[] = [], requestId?: string) {
    super(mensaje);
    this.name = 'ApiError';
    this.codigo = codigo;
    this.status = status;
    this.detalles = detalles;
    this.requestId = requestId;
  }

  static desde(error: unknown): ApiError {
    if (error instanceof ApiError) return error;
    if (isAxiosError<CuerpoError>(error)) {
      const cuerpo = error.response?.data;
      if (cuerpo && cuerpo.success === false) {
        const { codigo, mensaje, detalles, requestId } = cuerpo.error;
        return new ApiError(codigo, mensaje, error.response?.status ?? 0, detalles, requestId);
      }
      if (!error.response) return new ApiError('SIN_CONEXION', 'No se pudo conectar con el servidor.', 0);
    }
    return new ApiError('ERROR_DESCONOCIDO', 'Ocurrio un error inesperado.', 0);
  }
}

export const mensajeDe = (error: unknown): string => ApiError.desde(error).message;
