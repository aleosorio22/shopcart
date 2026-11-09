import type { ReactNode } from 'react';

export function Encabezado({ titulo, descripcion, acciones }: { titulo: string; descripcion?: string; acciones?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="text-[32px] font-semibold leading-tight">{titulo}</h1>
        {descripcion && <p className="mt-1 text-[15px] text-tinta-suave">{descripcion}</p>}
      </div>
      {acciones && <div className="flex flex-wrap gap-2">{acciones}</div>}
    </div>
  );
}

/** Barra de filtros del lado del servidor que va sobre cada tabla. */
export function BarraFiltros({ children }: { children: ReactNode }) {
  return <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4 [&_label]:sr-only">{children}</div>;
}
