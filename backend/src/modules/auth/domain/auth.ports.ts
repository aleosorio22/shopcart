import type { UsuarioSesion } from '../../../core/http/route.js';

export interface Credenciales {
  IDUsuario: number;
  Correo: string;
  HashContrasena: string;
  Activo: boolean;
  BloqueadoHasta: Date | null;
  Rol: string;
}

export interface NuevoCliente {
  correo: string;
  contrasena: string;
  nombres: string;
  apellidos: string;
  telefono?: string | undefined;
}

export interface MetaSesion {
  direccionIP: string | undefined;
  agenteUsuario: string | undefined;
}

export interface Perfil {
  usuario: Record<string, unknown>;
  permisos: string[];
}

export interface DatosPerfil {
  nombres: string;
  apellidos: string;
  telefono?: string | undefined;
}

export interface Sesion {
  accessToken: string;
  refreshToken: string;
  refreshExpiraEn: Date;
  expiraEnSegundos: number;
  usuario: { idUsuario: number; correo: string; rol: string };
}

export interface AuthRepository {
  registrarCliente(cliente: Omit<NuevoCliente, 'contrasena'>, hash: string): Promise<number>;
  credencialesPorCorreo(correo: string): Promise<Credenciales | undefined>;
  credencialesPorId(idUsuario: number): Promise<Credenciales | undefined>;
  registrarResultadoLogin(idUsuario: number, exito: boolean): Promise<void>;
  crearTokenRefresco(idUsuario: number, hashToken: Buffer, expiraEn: Date, meta: MetaSesion): Promise<void>;
  rotarTokenRefresco(hashActual: Buffer, hashNuevo: Buffer, expiraEn: Date, meta: MetaSesion): Promise<Credenciales>;
  cerrarSesion(hashToken: Buffer): Promise<void>;
  obtenerPerfil(idUsuario: number): Promise<Perfil>;
  actualizarPerfil(idUsuario: number, datos: DatosPerfil): Promise<void>;
  cambiarContrasena(idUsuario: number, hash: string): Promise<void>;
}

export interface HasherContrasena {
  generar(contrasena: string): Promise<string>;
  comparar(contrasena: string, hash: string): Promise<boolean>;
}

export interface EmisorTokens {
  readonly segundosVida: number;
  emitir(idUsuario: number, rol: string): string;
  /** Devuelve el id del usuario o lanza AppError 401. */
  verificar(token: string): number;
}

/** Puerto hacia el modulo de carrito: al iniciar sesion se une el carrito de invitado. */
export interface FusionCarrito {
  fusionar(idUsuario: number, hashTokenInvitado: Buffer): Promise<void>;
}

export type { UsuarioSesion };
