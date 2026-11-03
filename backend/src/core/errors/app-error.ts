/** Error esperado: su mensaje es seguro para mostrarlo al cliente. */
export class AppError extends Error {
  constructor(
    readonly codigo: string,
    readonly status: number,
    message: string,
    readonly detalles?: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }

  static noAutenticado(codigo = 'NO_AUTENTICADO', mensaje = 'Debe iniciar sesion.'): AppError {
    return new AppError(codigo, 401, mensaje);
  }

  static prohibido(): AppError {
    return new AppError('ACCESO_DENEGADO', 403, 'No tiene permiso para esta accion.');
  }

  static noEncontrado(): AppError {
    return new AppError('NO_ENCONTRADO', 404, 'El recurso no existe.');
  }

  static datosInvalidos(detalles?: unknown): AppError {
    return new AppError('DATOS_INVALIDOS', 400, 'Los datos enviados no son validos.', detalles);
  }
}
