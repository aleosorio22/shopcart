import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { HiOutlineLockClosed } from 'react-icons/hi2';
import { useAuth } from '../context/AuthContext';
import type { Permiso } from '../services/auth.service';
import { EnlaceBoton } from '../components/ui/Boton';
import { EstadoCargando, EstadoVacio } from '../components/ui/Estados';

interface Props {
  children: ReactNode;
  /** Exige un permiso concreto (lo usan las paginas del panel). */
  permiso?: Permiso;
  /** Solo Operador o Administrador. */
  soloPersonal?: boolean;
}

/** Sin sesion manda a iniciar sesion y recuerda a donde volver. Sin permiso muestra un 403. */
export function RutaProtegida({ children, permiso, soloPersonal = false }: Props) {
  const { estado, tienePermiso, esPersonal } = useAuth();
  const ubicacion = useLocation();

  if (estado === 'verificando') return <EstadoCargando texto="Verificando sesion" />;
  if (estado === 'anonimo') {
    const volver = encodeURIComponent(ubicacion.pathname + ubicacion.search);
    return <Navigate to={`/ingresar?volver=${volver}`} replace />;
  }
  if ((soloPersonal && !esPersonal) || (permiso && !tienePermiso(permiso))) return <SinAcceso />;
  return <>{children}</>;
}

export function SinAcceso() {
  return (
    <EstadoVacio
      icono={<HiOutlineLockClosed />}
      titulo="No tienes acceso a esta seccion"
      descripcion="Tu rol no incluye este permiso. Si crees que es un error, contacta a un administrador."
      accion={<EnlaceBoton to="/">Ir a la tienda</EnlaceBoton>}
    />
  );
}
