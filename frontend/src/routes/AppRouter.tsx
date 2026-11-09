import { lazy } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { CuentaLayout } from '../layouts/CuentaLayout';
import { PanelLayout } from '../layouts/PanelLayout';
import { TiendaLayout } from '../layouts/TiendaLayout';
import { MENU_PANEL } from './menuPanel';
import { RutaProtegida, SinAcceso } from './RutaProtegida';

// Cada pagina se descarga solo cuando se visita: el cliente no carga el codigo del panel.
const Inicio = lazy(() => import('../pages/tienda/Inicio'));
const Catalogo = lazy(() => import('../pages/tienda/Catalogo'));
const Producto = lazy(() => import('../pages/tienda/Producto'));
const Bolsa = lazy(() => import('../pages/tienda/Bolsa'));
const Ingresar = lazy(() => import('../pages/tienda/Ingresar'));
const Registro = lazy(() => import('../pages/tienda/Registro'));
const Checkout = lazy(() => import('../pages/tienda/Checkout'));
const MisPedidos = lazy(() => import('../pages/cuenta/MisPedidos'));
const DetallePedido = lazy(() => import('../pages/cuenta/DetallePedido'));
const Direcciones = lazy(() => import('../pages/cuenta/Direcciones'));
const Perfil = lazy(() => import('../pages/cuenta/Perfil'));
const NoEncontrado = lazy(() => import('../pages/NoEncontrado'));

/** /panel abre la primera seccion que el rol puede ver (el Operador no tiene dashboard). */
function InicioPanel() {
  const { tienePermiso } = useAuth();
  const primera = MENU_PANEL.find((opcion) => tienePermiso(opcion.permiso));
  return primera ? <Navigate to={primera.ruta} replace /> : <SinAcceso />;
}

const router = createBrowserRouter([
  {
    element: <TiendaLayout />,
    children: [
      { index: true, element: <Inicio /> },
      { path: 'tienda', element: <Catalogo /> },
      { path: 'productos/:slug', element: <Producto /> },
      { path: 'bolsa', element: <Bolsa /> },
      { path: 'ingresar', element: <Ingresar /> },
      { path: 'registro', element: <Registro /> },
      {
        path: 'checkout',
        element: (
          <RutaProtegida>
            <Checkout />
          </RutaProtegida>
        ),
      },
      {
        path: 'cuenta',
        element: (
          <RutaProtegida>
            <CuentaLayout />
          </RutaProtegida>
        ),
        children: [
          { index: true, element: <Navigate to="pedidos" replace /> },
          { path: 'pedidos', element: <MisPedidos /> },
          { path: 'pedidos/:id', element: <DetallePedido /> },
          { path: 'direcciones', element: <Direcciones /> },
          { path: 'perfil', element: <Perfil /> },
        ],
      },
      { path: '*', element: <NoEncontrado /> },
    ],
  },
  {
    path: 'panel',
    element: (
      <RutaProtegida soloPersonal>
        <PanelLayout />
      </RutaProtegida>
    ),
    children: [{ index: true, element: <InicioPanel /> }],
  },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
