import type { Pagina, Paginacion } from '../../../core/db/sql-gateway.js';

export const ROLES = ['CLIENTE', 'OPERADOR', 'ADMINISTRADOR'] as const;
export interface FiltroUsuarios extends Paginacion {
  texto?: string | undefined;
  rol?: string | undefined;
  activo?: boolean | undefined;
}

export interface NuevoUsuario {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  rol: string;
}

export interface UsuariosRepository {
  listar(actor: number, filtro: FiltroUsuarios): Promise<Pagina>;
  crear(actor: number, usuario: Omit<NuevoUsuario, 'contrasena'>, hash: string): Promise<number>;
  cambiarEstado(actor: number, idUsuario: number, activo: boolean): Promise<void>;
}
