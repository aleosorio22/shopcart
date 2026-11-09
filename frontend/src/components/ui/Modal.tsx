import { Dialog, DialogBackdrop, DialogPanel, DialogTitle } from '@headlessui/react';
import type { ReactNode } from 'react';
import { HiXMark } from 'react-icons/hi2';

interface PropsModal {
  abierto: boolean;
  alCerrar: () => void;
  titulo: string;
  children: ReactNode;
  ancho?: 'md' | 'lg';
}

/** Dialogo accesible (foco atrapado, Escape para cerrar) con la estetica de la tienda. */
export function Modal({ abierto, alCerrar, titulo, children, ancho = 'md' }: PropsModal) {
  return (
    <Dialog open={abierto} onClose={alCerrar} className="relative z-50">
      <DialogBackdrop transition className="fixed inset-0 bg-black/30 backdrop-blur-sm transition-opacity duration-200 data-closed:opacity-0" />
      <div className="fixed inset-0 flex items-end justify-center p-0 sm:items-center sm:p-4">
        <DialogPanel
          transition
          className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-white p-6 shadow-2xl transition duration-200 data-closed:translate-y-4 data-closed:opacity-0 sm:rounded-3xl ${ancho === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-md'}`}
        >
          <div className="mb-5 flex items-start justify-between gap-4">
            <DialogTitle className="text-xl font-semibold">{titulo}</DialogTitle>
            <button onClick={alCerrar} aria-label="Cerrar" className="rounded-full p-1.5 text-tinta-suave hover:bg-nube">
              <HiXMark className="text-xl" />
            </button>
          </div>
          {children}
        </DialogPanel>
      </div>
    </Dialog>
  );
}
