import { useEffect, useState } from 'react';

/** Espera a que el usuario deje de escribir antes de consultar al servidor. */
export function useDebounce<T>(valor: T, milisegundos = 350): T {
  const [retrasado, setRetrasado] = useState(valor);
  useEffect(() => {
    const temporizador = setTimeout(() => setRetrasado(valor), milisegundos);
    return () => clearTimeout(temporizador);
  }, [valor, milisegundos]);
  return retrasado;
}
