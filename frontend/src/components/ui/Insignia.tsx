import type { ReactNode } from 'react';
import type { TonoEstado } from '../../utils/pedidos';

const TONOS: Record<TonoEstado, string> = {
  neutro: 'bg-nube text-tinta-suave',
  info: 'bg-accion/10 text-accion',
  exito: 'bg-exito/10 text-exito',
  alerta: 'bg-alerta/10 text-alerta',
  peligro: 'bg-peligro/10 text-peligro',
};

export function Insignia({ tono = 'neutro', children }: { tono?: TonoEstado; children: ReactNode }) {
  return <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${TONOS[tono]}`}>{children}</span>;
}
