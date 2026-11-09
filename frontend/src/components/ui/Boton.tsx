import type { ButtonHTMLAttributes, ReactNode } from 'react';
import { Link, type LinkProps } from 'react-router-dom';
import { Spinner } from './Spinner';

type Variante = 'primario' | 'secundario' | 'fantasma' | 'peligro';
type Tamano = 'sm' | 'md' | 'lg';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-full font-normal transition-colors disabled:cursor-not-allowed disabled:opacity-40 whitespace-nowrap';
const VARIANTES: Record<Variante, string> = {
  primario: 'bg-accion text-white hover:bg-accion-hover',
  secundario: 'bg-nube text-tinta hover:bg-[#e8e8ed]',
  fantasma: 'text-enlace hover:underline',
  peligro: 'bg-peligro/10 text-peligro hover:bg-peligro/15',
};
const TAMANOS: Record<Tamano, string> = {
  sm: 'px-3.5 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-[15px]',
  lg: 'px-7 py-3 text-[17px]',
};

const clasesBoton = (variante: Variante = 'primario', tamano: Tamano = 'md', extra = '') =>
  `${BASE} ${VARIANTES[variante]} ${TAMANOS[tamano]} ${extra}`;

interface PropsBoton extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  tamano?: Tamano;
  cargando?: boolean;
  icono?: ReactNode;
}

/** Boton en forma de pildora. Mientras `cargando` es verdadero se deshabilita: evita el doble envio. */
export function Boton({ variante, tamano, cargando = false, icono, disabled, className = '', children, type = 'button', ...resto }: PropsBoton) {
  return (
    <button type={type} disabled={disabled || cargando} aria-busy={cargando} className={clasesBoton(variante, tamano, className)} {...resto}>
      {cargando ? <Spinner tamano="sm" /> : icono}
      {children}
    </button>
  );
}

interface PropsEnlace extends LinkProps {
  variante?: Variante;
  tamano?: Tamano;
}

export function EnlaceBoton({ variante, tamano, className = '', ...resto }: PropsEnlace) {
  return <Link className={clasesBoton(variante, tamano, className)} {...resto} />;
}
