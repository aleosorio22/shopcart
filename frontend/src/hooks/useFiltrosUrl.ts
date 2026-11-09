import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';

type Valores = Record<string, string | undefined>;

/**
 * Guarda los filtros de un listado en la URL (?estado=PAGADO&pagina=2).
 * Asi un listado filtrado se puede recargar, compartir o volver con "atras".
 * Cualquier cambio de filtro regresa a la pagina 1.
 */
export function useFiltrosUrl<T extends Valores>(predeterminados: T) {
  const [parametros, setParametros] = useSearchParams();

  const valores = useMemo(() => {
    const leidos = { ...predeterminados } as T;
    for (const clave of Object.keys(predeterminados)) {
      const valor = parametros.get(clave);
      if (valor !== null) (leidos as Valores)[clave] = valor;
    }
    return leidos;
    // Los predeterminados son constantes del componente que llama.
    // eslint-disable-next-line react/exhaustive-deps
  }, [parametros]);

  const pagina = Number(parametros.get('pagina') ?? '1') || 1;

  const actualizar = useCallback(
    (cambios: Partial<T>) => {
      setParametros(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales);
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === undefined || valor === '') nuevos.delete(clave);
            else nuevos.set(clave, String(valor));
          }
          nuevos.delete('pagina');
          return nuevos;
        },
        { replace: true },
      );
    },
    [setParametros],
  );

  const irAPagina = useCallback(
    (numero: number) => {
      setParametros((actuales) => {
        const nuevos = new URLSearchParams(actuales);
        if (numero <= 1) nuevos.delete('pagina');
        else nuevos.set('pagina', String(numero));
        return nuevos;
      });
    },
    [setParametros],
  );

  return { valores, pagina, actualizar, irAPagina };
}
