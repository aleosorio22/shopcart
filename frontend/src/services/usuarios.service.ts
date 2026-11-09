import { enviar, obtenerPagina, type Rol } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export interface UsuarioListado {
  IDUsuario: number;
  Correo: string;
  Nombres: string;
  Apellidos: string;
  Rol: Rol;
  Activo: boolean;
  UltimoAcceso: string | null;
  CreadoEn: string;
}
export interface DatosUsuario {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  rol: Rol;
}

export const usuariosService = {
  listar: (filtro: FiltroPaginado & { texto?: string; rol?: Rol; activo?: boolean }) =>
    obtenerPagina<UsuarioListado>('/usuarios', filtro),
  crear: (datos: DatosUsuario) => enviar<{ idUsuario: number }>('post', '/usuarios', datos),
  cambiarEstado: (id: number, activo: boolean) => enviar('patch', `/usuarios/${id}/estado`, { activo }),
};
