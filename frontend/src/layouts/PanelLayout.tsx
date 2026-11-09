import { Dialog, DialogBackdrop, DialogPanel } from '@headlessui/react';
import { Suspense, useState } from 'react';
import { HiBars3, HiOutlineArrowLeftOnRectangle, HiOutlineBuildingStorefront } from 'react-icons/hi2';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { EstadoCargando } from '../components/ui/Estados';
import { useAuth } from '../context/AuthContext';
import { MENU_PANEL } from '../routes/menuPanel';

function MenuLateral({ alNavegar }: { alNavegar?: () => void }) {
  const { tienePermiso, perfil, cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const opciones = MENU_PANEL.filter((opcion) => tienePermiso(opcion.permiso));

  return (
    <div className="flex h-full flex-col gap-6 p-4">
      <Link to="/" className="px-3 pt-2 text-[19px] font-semibold tracking-tight">
        ShopCart <span className="font-normal text-tinta-tenue">Panel</span>
      </Link>
      <nav aria-label="Panel" className="flex flex-col gap-0.5">
        {opciones.map(({ ruta, etiqueta, icono: Icono }) => (
          <NavLink
            key={ruta}
            to={ruta}
            onClick={alNavegar}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-xl px-3 py-2 text-[14px] transition-colors ${isActive ? 'bg-white font-medium text-tinta shadow-sm' : 'text-tinta/75 hover:bg-white/60'}`
            }
          >
            <Icono className="text-lg" aria-hidden />
            {etiqueta}
          </NavLink>
        ))}
      </nav>
      <div className="mt-auto space-y-1 border-t border-linea/70 pt-4 text-[14px]">
        <p className="px-3 text-xs text-tinta-suave">
          {perfil?.usuario.Nombres} · {perfil?.usuario.Rol === 'ADMINISTRADOR' ? 'Administrador' : 'Operador'}
        </p>
        <Link to="/" className="flex items-center gap-3 rounded-xl px-3 py-2 text-tinta/75 hover:bg-white/60">
          <HiOutlineBuildingStorefront className="text-lg" aria-hidden /> Ver tienda
        </Link>
        <button
          onClick={() => void cerrarSesion().then(() => navegar('/'))}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2 text-tinta/75 hover:bg-white/60"
        >
          <HiOutlineArrowLeftOnRectangle className="text-lg" aria-hidden /> Cerrar sesión
        </button>
      </div>
    </div>
  );
}

export function PanelLayout() {
  const [menuAbierto, setMenuAbierto] = useState(false);
  return (
    <div className="flex min-h-dvh bg-white">
      <aside className="sticky top-0 hidden h-dvh w-64 shrink-0 bg-nube lg:block">
        <MenuLateral />
      </aside>

      <Dialog open={menuAbierto} onClose={setMenuAbierto} className="relative z-50 lg:hidden">
        <DialogBackdrop className="fixed inset-0 bg-black/25" />
        <DialogPanel className="fixed inset-y-0 left-0 w-72 bg-nube">
          <MenuLateral alNavegar={() => setMenuAbierto(false)} />
        </DialogPanel>
      </Dialog>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-30 flex h-12 items-center gap-3 border-b border-black/5 bg-white/80 px-4 backdrop-blur-xl lg:hidden">
          <button onClick={() => setMenuAbierto(true)} aria-label="Abrir menu" className="text-xl">
            <HiBars3 />
          </button>
          <span className="font-semibold">ShopCart Panel</span>
        </header>
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-8 sm:px-8">
          <Suspense fallback={<EstadoCargando />}>
            <Outlet />
          </Suspense>
        </main>
      </div>
    </div>
  );
}
