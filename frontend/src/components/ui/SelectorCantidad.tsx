import { HiMinus, HiPlus } from 'react-icons/hi2';

interface Props {
  valor: number;
  maximo: number;
  alCambiar: (cantidad: number) => void;
  deshabilitado?: boolean;
  etiqueta?: string;
}

/** Botones de menos y mas con la cantidad al centro. No baja de 1 ni pasa de lo disponible. */
export function SelectorCantidad({ valor, maximo, alCambiar, deshabilitado = false, etiqueta = 'Cantidad' }: Props) {
  const boton = 'flex h-9 w-9 items-center justify-center rounded-full transition-colors hover:bg-black/5 disabled:opacity-30 disabled:hover:bg-transparent';
  return (
    <div className="inline-flex items-center rounded-full bg-nube p-0.5" role="group" aria-label={etiqueta}>
      <button type="button" className={boton} onClick={() => alCambiar(valor - 1)} disabled={deshabilitado || valor <= 1} aria-label="Restar uno">
        <HiMinus />
      </button>
      <span className="w-8 text-center text-[15px] tabular-nums" aria-live="polite">
        {valor}
      </span>
      <button type="button" className={boton} onClick={() => alCambiar(valor + 1)} disabled={deshabilitado || valor >= maximo} aria-label="Sumar uno">
        <HiPlus />
      </button>
    </div>
  );
}
