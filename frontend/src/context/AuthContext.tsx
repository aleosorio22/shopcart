import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { alCambiarSesion, fijarSesion, renovarSesion, type Rol } from '../api/cliente';
import { authService, type DatosRegistro, type Perfil, type Permiso } from '../services/auth.service';

type Estado = 'verificando' | 'anonimo' | 'autenticado';

interface ValorAuth {
  estado: Estado;
  perfil: Perfil | null;
  rol: Rol | null;
  tienePermiso: (permiso: Permiso) => boolean;
  esPersonal: boolean;
  iniciarSesion: (correo: string, contrasena: string) => Promise<Perfil>;
  registrar: (datos: DatosRegistro) => Promise<Perfil>;
  cerrarSesion: () => Promise<void>;
  recargarPerfil: () => Promise<void>;
}

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [estado, setEstado] = useState<Estado>('verificando');
  const [perfil, setPerfil] = useState<Perfil | null>(null);

  const cargarPerfil = useCallback(async () => {
    const datos = await authService.perfil();
    setPerfil(datos);
    setEstado('autenticado');
    return datos;
  }, []);

  // Al abrir la app se intenta recuperar la sesion con la cookie del refresh token.
  useEffect(() => {
    let vigente = true;
    renovarSesion()
      .then(() => (vigente ? cargarPerfil() : undefined))
      .catch(() => {
        if (vigente) setEstado('anonimo');
      });
    return () => {
      vigente = false;
    };
  }, [cargarPerfil]);

  // Si el interceptor no pudo renovar, la sesion termina en toda la app.
  useEffect(
    () =>
      alCambiarSesion((sesion) => {
        if (sesion) return;
        setPerfil(null);
        setEstado('anonimo');
      }),
    [],
  );

  const iniciarSesion = useCallback(
    async (correo: string, contrasena: string) => {
      fijarSesion(await authService.iniciarSesion(correo, contrasena));
      // El backend fusiona el carrito de invitado: hay que volver a leerlo.
      await queryClient.invalidateQueries({ queryKey: ['carrito'] });
      return cargarPerfil();
    },
    [cargarPerfil, queryClient],
  );

  const registrar = useCallback(
    async (datos: DatosRegistro) => {
      fijarSesion(await authService.registrar(datos));
      return cargarPerfil();
    },
    [cargarPerfil],
  );

  const cerrarSesion = useCallback(async () => {
    try {
      await authService.cerrarSesion();
    } finally {
      fijarSesion(null);
      queryClient.clear();
    }
  }, [queryClient]);

  const recargarPerfil = useCallback(async () => {
    await cargarPerfil();
  }, [cargarPerfil]);

  const valor = useMemo<ValorAuth>(() => {
    const rol = perfil?.usuario.Rol ?? null;
    return {
      estado,
      perfil,
      rol,
      tienePermiso: (permiso) => perfil?.permisos.includes(permiso) ?? false,
      esPersonal: rol === 'OPERADOR' || rol === 'ADMINISTRADOR',
      iniciarSesion,
      registrar,
      cerrarSesion,
      recargarPerfil,
    };
  }, [estado, perfil, iniciarSesion, registrar, cerrarSesion, recargarPerfil]);

  return <AuthContext.Provider value={valor}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react/only-export-components
export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext);
  if (!valor) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return valor;
}
