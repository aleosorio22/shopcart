import { quetzales } from '../../utils/formato';

/** Precio final y, si hay promocion, el precio de lista tachado. */
export function Precio({ final, lista, desde = false, className = '' }: { final: number; lista?: number; desde?: boolean; className?: string }) {
  const enOferta = lista !== undefined && lista > final;
  return (
    <span className={`inline-flex flex-wrap items-baseline gap-x-2 ${className}`}>
      <span>
        {desde && 'Desde '}
        {quetzales(final)}
      </span>
      {enOferta && <s className="text-[0.85em] text-tinta-tenue">{quetzales(lista)}</s>}
    </span>
  );
}
