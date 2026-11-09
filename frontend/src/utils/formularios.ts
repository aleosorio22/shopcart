import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';
import toast from 'react-hot-toast';
import { ApiError } from '../api/error';

/**
 * Muestra un error del API dentro del formulario.
 * Los 400 traen el detalle por campo: cada mensaje se coloca bajo su input.
 * El resto (409, 403...) se muestra como notificacion con el mensaje del backend.
 */
export function mostrarErrorApi<T extends FieldValues>(error: unknown, setError?: UseFormSetError<T>, campos?: readonly string[]): void {
  const apiError = ApiError.desde(error);
  const asignables = apiError.detalles.filter((detalle) => setError && (!campos || campos.includes(detalle.campo)));
  for (const detalle of asignables) setError?.(detalle.campo as Path<T>, { type: 'servidor', message: detalle.mensaje });
  if (asignables.length === 0) toast.error(apiError.message);
}

/** Convierte un input numerico vacio en undefined para que zod lo trate como "no enviado". */
export const numeroOpcional = (valor: unknown) => (valor === '' || valor === null || Number.isNaN(valor) ? undefined : Number(valor));
