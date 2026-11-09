export function Spinner({ tamano = 'md' }: { tamano?: 'sm' | 'md' }) {
  const medida = tamano === 'sm' ? 'h-4 w-4 border-2' : 'h-7 w-7 border-[2.5px]';
  return (
    <span className="inline-flex">
      <span aria-hidden className={`${medida} inline-block animate-spin rounded-full border-current border-t-transparent opacity-70`} />
      <span className="sr-only">Cargando</span>
    </span>
  );
}
