import { useCallback, useRef } from 'react';

/**
 * Una llave por intento logico: los reenvios (doble clic, reintento de red) reutilizan la misma
 * y el backend responde lo mismo sin repetir el cobro. Tras un resultado definitivo se renueva.
 */
export function useLlaveIdempotencia() {
  const llave = useRef<string>(crypto.randomUUID());
  const renovar = useCallback(() => {
    llave.current = crypto.randomUUID();
  }, []);
  return { actual: () => llave.current, renovar };
}
