import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { HiOutlineMagnifyingGlass, HiOutlineShoppingBag, HiOutlineUserCircle, HiXMark } from 'react-icons/hi2';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useCarrito } from '../../hooks/useCarrito';
import { useCategorias } from '../../hooks/useCatalogo';


export function Navbar() {
  const { estado, perfil, esPersonal, cerrarSesion } = useAuth();
  const { data: carrito } = useCarrito();
  const unidades = carrito?.lineas.reduce((total, linea) => total + linea.Cantidad, 0) ?? 0;
  const [buscando, setBuscando] = useState(false);
  const [texto, setTexto] = useState('');
  const navegar = useNavigate();
  const campoBusqueda = useRef<HTMLInputElement>(null);
  // El campo aparece porque el usuario pidio buscar: recibir el foco es lo esperado.
  useEffect(() => {
    if (buscando) campoBusqueda.current?.focus();
  }, [buscando]);
  const { data: categorias = [] } = useCategorias();
  // El menu muestra las categorias raiz, en el orden que define el catalogo.
  const enlaces = [
    { a: '/tienda', texto: 'Tienda' },
    ...categorias
      .filter((categoria) => categoria.IDCategoriaPadre === null && categoria.Activo)
      .sort((a, b) => a.Orden - b.Orden)
      .map((categoria) => ({ a: `/tienda?categoria=${categoria.IDCategoria}`, texto: categoria.Nombre })),
  ];

  const buscar = (evento: FormEvent) => {
    evento.preventDefault();
    setBuscando(false);
    navegar(`/tienda?texto=${encodeURIComponent(texto.trim())}`);
  };

  return (
    <header className="sticky top-0 z-40 border-b border-black/5 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
      <nav className="contenedor flex h-12 items-center justify-between gap-6 text-[13px]" aria-label="Principal">
        <Link to="/" className="text-[19px] font-semibold tracking-tight text-tinta">
          ShopCart
        </Link>

        {buscando ? (
          <form onSubmit={buscar} className="flex flex-1 items-center gap-2" role="search">
            <HiOutlineMagnifyingGlass className="text-base text-tinta-suave" aria-hidden />
            <input
              ref={campoBusqueda}
              value={texto}
              onChange={(evento) => setTexto(evento.target.value)}
              placeholder="Buscar en ShopCart"
              aria-label="Buscar productos"
              className="flex-1 bg-transparent text-[15px] outline-none placeholder:text-tinta-tenue"
            />
            <button type="button" onClick={() => setBuscando(false)} aria-label="Cerrar búsqueda" className="text-lg text-tinta-suave">
              <HiXMark />
            </button>
          </form>
        ) : (
          <ul className="hidden flex-1 items-center justify-center gap-8 md:flex">
            {enlaces.map((enlace) => (
              <li key={enlace.a}>
                <NavLink to={enlace.a} className="text-tinta/80 transition-colors hover:text-tinta">
                  {enlace.texto}
                </NavLink>
              </li>
            ))}
          </ul>
        )}

        <div className="flex items-center gap-5 text-lg text-tinta/80">
          {!buscando && (
            <button onClick={() => setBuscando(true)} aria-label="Buscar" className="hover:text-tinta">
              <HiOutlineMagnifyingGlass />
            </button>
          )}
          <Link to="/bolsa" aria-label={`Bolsa, ${unidades} artículos`} className="relative hover:text-tinta">
            <HiOutlineShoppingBag />
            {unidades > 0 && (
              <span className="absolute -bottom-1.5 -right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-tinta px-1 text-[10px] font-medium text-white">
                {unidades}
              </span>
            )}
          </Link>
          {estado === 'autenticado' && perfil ? (
            <Menu as="div" className="relative">
              <MenuButton aria-label="Cuenta" className="flex hover:text-tinta">
                <HiOutlineUserCircle />
              </MenuButton>
              <MenuItems
                anchor="bottom end"
                transition
                className="z-50 mt-3 w-56 rounded-2xl border border-black/5 bg-white/95 p-1.5 text-[14px] shadow-xl backdrop-blur-xl transition duration-150 focus:outline-none data-closed:scale-95 data-closed:opacity-0"
              >
                <div className="px-3 py-2 text-xs text-tinta-suave">
                  {perfil.usuario.Nombres} {perfil.usuario.Apellidos}
                </div>
                {esPersonal && <ItemMenu a="/panel">Panel de administración</ItemMenu>}
                <ItemMenu a="/cuenta/pedidos">Mis pedidos</ItemMenu>
                <ItemMenu a="/cuenta/direcciones">Direcciones</ItemMenu>
                <ItemMenu a="/cuenta/perfil">Perfil</ItemMenu>
                <MenuItem>
                  <button onClick={() => void cerrarSesion().then(() => navegar('/'))} className="block w-full rounded-xl px-3 py-2 text-left data-focus:bg-nube">
                    Cerrar sesión
                  </button>
                </MenuItem>
              </MenuItems>
            </Menu>
          ) : (
            <Link to="/ingresar" aria-label="Iniciar sesión" className="hover:text-tinta">
              <HiOutlineUserCircle />
            </Link>
          )}
        </div>
      </nav>
      <ul className="contenedor flex gap-6 overflow-x-auto pb-2 text-[13px] md:hidden">
        {enlaces.map((enlace) => (
          <li key={enlace.a} className="shrink-0">
            <NavLink to={enlace.a} className="text-tinta/80">
              {enlace.texto}
            </NavLink>
          </li>
        ))}
      </ul>
    </header>
  );
}

function ItemMenu({ a, children }: { a: string; children: string }) {
  return (
    <MenuItem>
      <Link to={a} className="block rounded-xl px-3 py-2 data-focus:bg-nube">
        {children}
      </Link>
    </MenuItem>
  );
}
