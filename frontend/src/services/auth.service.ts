import { enviar, obtener, type Rol, type SesionRenovada } from '../api/cliente';

export interface Perfil {
  usuario: { IDUsuario: number; Correo: string; Nombres: string; Apellidos: string; Telefono: string | null; Rol: Rol };
  permisos: Permiso[];
}

export type Permiso =
  | 'PEDIDOS_GESTIONAR'
  | 'INVENTARIO_GESTIONAR'
  | 'CATALOGO_GESTIONAR'
  | 'PRECIOS_GESTIONAR'
  | 'CUPONES_GESTIONAR'
  | 'USUARIOS_GESTIONAR'
  | 'REPORTES_VER'
  | 'BITACORA_VER'
  | 'MARKETING_GESTIONAR'
  | 'CONFIG_GESTIONAR';

export interface DatosRegistro {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string;
}

export const authService = {
  iniciarSesion: (correo: string, contrasena: string) => enviar<SesionRenovada>('post', '/auth/login', { correo, contrasena }),
  registrar: (datos: DatosRegistro) => enviar<SesionRenovada>('post', '/auth/registro', datos),
  cerrarSesion: () => enviar('post', '/auth/logout'),
  perfil: () => obtener<Perfil>('/auth/me'),
  actualizarPerfil: (datos: { nombres: string; apellidos: string; telefono?: string }) => enviar('patch', '/auth/me', datos),
  cambiarContrasena: (actual: string, nueva: string) => enviar('post', '/auth/cambiar-contrasena', { actual, nueva }),
};
