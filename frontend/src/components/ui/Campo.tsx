import { forwardRef, useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

const CONTROL =
  'w-full rounded-xl border bg-white px-3.5 py-2.5 text-[15px] text-tinta outline-none transition-colors placeholder:text-tinta-tenue focus:border-accion focus:ring-4 focus:ring-accion/15 disabled:bg-nube';
const bordeDe = (error?: string) => (error ? 'border-peligro' : 'border-linea');

interface Envoltura {
  etiqueta: string;
  error?: string;
  ayuda?: string;
}

function Marco({ id, etiqueta, error, ayuda, children }: Envoltura & { id: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-tinta-suave">
        {etiqueta}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} role="alert" className="text-[13px] text-peligro">
          {error}
        </p>
      ) : (
        ayuda && <p className="text-[13px] text-tinta-tenue">{ayuda}</p>
      )}
    </div>
  );
}

type PropsCampo = Envoltura & InputHTMLAttributes<HTMLInputElement>;

/** Input con etiqueta y mensaje de error accesible. Funciona con `register` de react-hook-form. */
export const Campo = forwardRef<HTMLInputElement, PropsCampo>(function Campo({ etiqueta, error, ayuda, className = '', ...resto }, ref) {
  const id = useId();
  return (
    <Marco id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <input ref={ref} id={id} aria-invalid={Boolean(error)} aria-describedby={error ? `${id}-error` : undefined} className={`${CONTROL} ${bordeDe(error)} ${className}`} {...resto} />
    </Marco>
  );
});

type PropsSelect = Envoltura & SelectHTMLAttributes<HTMLSelectElement>;

export const Selector = forwardRef<HTMLSelectElement, PropsSelect>(function Selector({ etiqueta, error, ayuda, className = '', children, ...resto }, ref) {
  const id = useId();
  return (
    <Marco id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <select ref={ref} id={id} aria-invalid={Boolean(error)} className={`${CONTROL} ${bordeDe(error)} ${className}`} {...resto}>
        {children}
      </select>
    </Marco>
  );
});

type PropsArea = Envoltura & TextareaHTMLAttributes<HTMLTextAreaElement>;

export const AreaTexto = forwardRef<HTMLTextAreaElement, PropsArea>(function AreaTexto({ etiqueta, error, ayuda, className = '', ...resto }, ref) {
  const id = useId();
  return (
    <Marco id={id} etiqueta={etiqueta} error={error} ayuda={ayuda}>
      <textarea ref={ref} id={id} rows={3} aria-invalid={Boolean(error)} className={`${CONTROL} ${bordeDe(error)} ${className}`} {...resto} />
    </Marco>
  );
});

export const Casilla = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { etiqueta: string }>(function Casilla({ etiqueta, ...resto }, ref) {
  return (
    <label className="flex cursor-pointer items-center gap-2.5 text-[15px]">
      <input ref={ref} type="checkbox" className="h-4 w-4 accent-accion" {...resto} />
      {etiqueta}
    </label>
  );
});
