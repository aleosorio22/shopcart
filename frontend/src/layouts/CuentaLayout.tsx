import { NavLink, Outlet } from 'react-router-dom';

const SECCIONES = [
  { a: '/cuenta/pedidos', texto: 'Pedidos' },
  { a: '/cuenta/direcciones', texto: 'Direcciones' },
  { a: '/cuenta/perfil', texto: 'Perfil' },
];

export function CuentaLayout() {
  return (
    <div className="contenedor py-10">
      <nav aria-label="Mi cuenta" className="mb-8 flex gap-2 overflow-x-auto">
        {SECCIONES.map((seccion) => (
          <NavLink
            key={seccion.a}
            to={seccion.a}
            className={({ isActive }) => `shrink-0 rounded-full px-4 py-1.5 text-[14px] ${isActive ? 'bg-tinta text-white' : 'bg-nube text-tinta hover:bg-[#e8e8ed]'}`}
          >
            {seccion.texto}
          </NavLink>
        ))}
      </nav>
      <Outlet />
    </div>
  );
}
