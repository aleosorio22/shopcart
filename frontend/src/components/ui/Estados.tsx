import type { ReactNode } from 'react';
import { HiOutlineExclamationCircle, HiOutlineInbox } from 'react-icons/hi2';
import { mensajeDe } from '../../api/error';
import { Boton } from './Boton';
import { Spinner } from './Spinner';

export function EstadoCargando({ texto = 'Cargando' }: { texto?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-20 text-tinta-tenue">
      <Spinner />
      <p className="text-sm">{texto}</p>
    </div>
  );
}

export function EstadoVacio({ titulo, descripcion, accion, icono }: { titulo: string; descripcion?: string; accion?: ReactNode; icono?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <span className="mb-2 text-4xl text-tinta-tenue" aria-hidden>
        {icono ?? <HiOutlineInbox />}
      </span>
      <p className="text-lg font-semibold">{titulo}</p>
      {descripcion && <p className="max-w-sm text-[15px] text-tinta-suave">{descripcion}</p>}
      {accion && <div className="mt-4">{accion}</div>}
    </div>
  );
}

export function EstadoError({ error, reintentar }: { error: unknown; reintentar?: () => void }) {
  return (
    <div role="alert" className="flex flex-col items-center justify-center gap-2 py-20 text-center">
      <HiOutlineExclamationCircle className="mb-2 text-4xl text-peligro" aria-hidden />
      <p className="text-lg font-semibold">No pudimos cargar esta información</p>
      <p className="max-w-sm text-[15px] text-tinta-suave">{mensajeDe(error)}</p>
      {reintentar && (
        <Boton variante="secundario" tamano="sm" className="mt-4" onClick={reintentar}>
          Reintentar
        </Boton>
      )}
    </div>
  );
}

interface PropsConsulta<T> {
  consulta: { data: T | undefined; isPending: boolean; isError: boolean; error: unknown; refetch: () => unknown };
  /** Decide si el dato cuenta como vacio (lista sin filas, carrito sin lineas...). */
  esVacio?: (dato: T) => boolean;
  vacio?: ReactNode;
  cargando?: ReactNode;
  children: (dato: T) => ReactNode;
}

/** Resuelve en un solo lugar los tres estados obligatorios de cada vista: carga, error y vacio. */
export function Consulta<T>({ consulta, esVacio, vacio, cargando, children }: PropsConsulta<T>) {
  if (consulta.isPending) return <>{cargando ?? <EstadoCargando />}</>;
  if (consulta.isError) return <EstadoError error={consulta.error} reintentar={() => void consulta.refetch()} />;
  const dato = consulta.data as T;
  if (esVacio?.(dato)) return <>{vacio ?? <EstadoVacio titulo="No hay nada por aquí" />}</>;
  return <>{children(dato)}</>;
}
