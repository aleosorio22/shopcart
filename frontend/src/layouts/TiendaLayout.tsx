import { Suspense } from 'react';
import { Link, Outlet } from 'react-router-dom';
import { Navbar } from '../components/tienda/Navbar';
import { EstadoCargando } from '../components/ui/Estados';

const ANIO = new Date().getFullYear();

export function TiendaLayout() {
  return (
    <div className="flex min-h-dvh flex-col">
      <Navbar />
      <main className="flex-1">
        <Suspense fallback={<EstadoCargando />}>
          <Outlet />
        </Suspense>
      </main>
      <footer className="bg-nube text-[12px] text-tinta-suave">
        <div className="contenedor space-y-3 py-8">
          <p>Precios en quetzales con IVA incluido. Envío gratis en compras desde Q1,000 a domicilio, o recoge sin costo en tienda.</p>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-linea pt-3">
            <span>© {ANIO} ShopCart. Pentranda.</span>
            <nav className="flex gap-4">
              <Link to="/tienda" className="hover:underline">
                Tienda
              </Link>
              <Link to="/cuenta/pedidos" className="hover:underline">
                Mis pedidos
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
