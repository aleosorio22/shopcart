import { HiChevronLeft, HiChevronRight } from 'react-icons/hi2';
import type { MetaPagina } from '../../api/tipos';

export function Paginacion({ meta, alCambiar }: { meta: MetaPagina; alCambiar: (pagina: number) => void }) {
  const paginas = Math.max(1, Math.ceil(meta.total / meta.tamanoPagina));
  const desde = meta.total === 0 ? 0 : (meta.pagina - 1) * meta.tamanoPagina + 1;
  const hasta = Math.min(meta.total, meta.pagina * meta.tamanoPagina);
  const boton = 'rounded-full p-2 text-tinta hover:bg-nube disabled:opacity-30 disabled:hover:bg-transparent';

  return (
    <nav aria-label="Paginacion" className="flex items-center justify-between gap-4 pt-4 text-sm text-tinta-suave">
      <span>
        {desde}–{hasta} de {meta.total}
      </span>
      <div className="flex items-center gap-1">
        <button className={boton} disabled={meta.pagina <= 1} onClick={() => alCambiar(meta.pagina - 1)} aria-label="Página anterior">
          <HiChevronLeft />
        </button>
        <span className="min-w-16 text-center">
          {meta.pagina} / {paginas}
        </span>
        <button className={boton} disabled={meta.pagina >= paginas} onClick={() => alCambiar(meta.pagina + 1)} aria-label="Página siguiente">
          <HiChevronRight />
        </button>
      </div>
    </nav>
  );
}
