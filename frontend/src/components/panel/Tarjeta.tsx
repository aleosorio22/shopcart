import type { ReactNode } from 'react';

export function Tarjeta({ titulo, children, className = '' }: { titulo?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-3xl bg-nube p-6 ${className}`}>
      {titulo && <h2 className="mb-4 text-[17px] font-semibold">{titulo}</h2>}
      {children}
    </section>
  );
}

export function Indicador({ etiqueta, valor, detalle }: { etiqueta: string; valor: string; detalle?: string }) {
  return (
    <div className="rounded-3xl bg-nube p-6">
      <p className="text-[13px] text-tinta-suave">{etiqueta}</p>
      <p className="mt-1 text-[28px] font-semibold tracking-tight">{valor}</p>
      {detalle && <p className="text-[13px] text-tinta-tenue">{detalle}</p>}
    </div>
  );
}
