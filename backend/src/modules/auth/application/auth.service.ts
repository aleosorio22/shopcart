import { AppError } from '../../../core/errors/app-error.js';
import type { Autenticador, UsuarioSesion } from '../../../core/http/route.js';
import { sha256, tokenOpaco } from '../../../core/security/hash.js';
import type {
  AuthRepository,
  Credenciales,
  DatosPerfil,
  EmisorTokens,
  FusionCarrito,
  HasherContrasena,
  MetaSesion,
  NuevoCliente,
  Perfil,
  Sesion,
} from '../domain/auth.ports.js';

const MS_POR_DIA = 86_400_000;
const VIDA_CACHE_MS = 30_000;

const credencialesInvalidas = () => new AppError('CREDENCIALES_INVALIDAS', 401, 'Correo o contrasena incorrectos.');

export interface OpcionesAuth {
  diasVidaRefresh: number;
  ahora?: () => Date;
}

export class AuthService implements Autenticador {
  /** Evita ir a la BD en cada peticion, y aun asi un usuario desactivado cae en segundos. */
  private readonly sesiones = new Map<number, { usuario: UsuarioSesion; venceEn: number }>();
  private readonly hashSenuelo: Promise<string>;
  private readonly ahora: () => Date;

  constructor(
    private readonly repositorio: AuthRepository,
    private readonly hasher: HasherContrasena,
    private readonly tokens: EmisorTokens,
    private readonly carrito: FusionCarrito,
    private readonly opciones: OpcionesAuth,
  ) {
    this.hashSenuelo = hasher.generar(tokenOpaco());
    this.ahora = opciones.ahora ?? (() => new Date());
  }

  async registrar(cliente: NuevoCliente, meta: MetaSesion): Promise<Sesion> {
    const { contrasena, ...datos } = cliente;
    const idUsuario = await this.repositorio.registrarCliente(datos, await this.hasher.generar(contrasena));
    return this.abrirSesion(idUsuario, datos.correo, 'CLIENTE', meta);
  }

  async iniciarSesion(correo: string, contrasena: string, meta: MetaSesion, hashInvitado?: Buffer): Promise<Sesion> {
    const credenciales = await this.repositorio.credencialesPorCorreo(correo);
    if (!credenciales) {
      // Mismo costo de CPU que un usuario real: el tiempo no revela si el correo existe.
      await this.hasher.comparar(contrasena, await this.hashSenuelo);
      throw credencialesInvalidas();
    }
    const contrasenaValida = await this.hasher.comparar(contrasena, credenciales.HashContrasena);
    if (this.estaBloqueado(credenciales)) throw credencialesInvalidas();
    await this.repositorio.registrarResultadoLogin(credenciales.IDUsuario, contrasenaValida);
    if (!contrasenaValida) throw credencialesInvalidas();
    if (!credenciales.Activo) throw new AppError('USUARIO_INACTIVO', 403, 'La cuenta esta desactivada.');

    const sesion = await this.abrirSesion(credenciales.IDUsuario, credenciales.Correo, credenciales.Rol, meta);
    if (hashInvitado) await this.carrito.fusionar(credenciales.IDUsuario, hashInvitado);
    return sesion;
  }

  async refrescar(refreshToken: string, meta: MetaSesion): Promise<Sesion> {
    const nuevoToken = tokenOpaco();
    const expiraEn = this.expiracionRefresh();
    const usuario = await this.repositorio.rotarTokenRefresco(sha256(refreshToken), sha256(nuevoToken), expiraEn, meta);
    return this.construirSesion(usuario.IDUsuario, usuario.Correo, usuario.Rol, nuevoToken, expiraEn);
  }

  cerrarSesion(refreshToken: string): Promise<void> {
    return this.repositorio.cerrarSesion(sha256(refreshToken));
  }

  async autenticar(token: string): Promise<UsuarioSesion> {
    const idUsuario = this.tokens.verificar(token);
    const enCache = this.sesiones.get(idUsuario);
    if (enCache && enCache.venceEn > Date.now()) return enCache.usuario;

    const perfil = await this.repositorio.obtenerPerfil(idUsuario);
    const usuario: UsuarioSesion = { idUsuario, rol: String(perfil.usuario.Rol), permisos: perfil.permisos };
    this.sesiones.set(idUsuario, { usuario, venceEn: Date.now() + VIDA_CACHE_MS });
    return usuario;
  }

  invalidarSesion(idUsuario: number): void {
    this.sesiones.delete(idUsuario);
  }

  obtenerPerfil(idUsuario: number): Promise<Perfil> {
    return this.repositorio.obtenerPerfil(idUsuario);
  }

  actualizarPerfil(idUsuario: number, datos: DatosPerfil): Promise<void> {
    return this.repositorio.actualizarPerfil(idUsuario, datos);
  }

  async cambiarContrasena(idUsuario: number, actual: string, nueva: string): Promise<void> {
    const credenciales = await this.repositorio.credencialesPorId(idUsuario);
    if (!credenciales || !(await this.hasher.comparar(actual, credenciales.HashContrasena))) throw credencialesInvalidas();
    await this.repositorio.cambiarContrasena(idUsuario, await this.hasher.generar(nueva));
  }

  private estaBloqueado({ BloqueadoHasta }: Credenciales): boolean {
    return BloqueadoHasta !== null && BloqueadoHasta > this.ahora();
  }

  private expiracionRefresh(): Date {
    return new Date(this.ahora().getTime() + this.opciones.diasVidaRefresh * MS_POR_DIA);
  }

  private async abrirSesion(idUsuario: number, correo: string, rol: string, meta: MetaSesion): Promise<Sesion> {
    const refreshToken = tokenOpaco();
    const expiraEn = this.expiracionRefresh();
    await this.repositorio.crearTokenRefresco(idUsuario, sha256(refreshToken), expiraEn, meta);
    return this.construirSesion(idUsuario, correo, rol, refreshToken, expiraEn);
  }

  private construirSesion(idUsuario: number, correo: string, rol: string, refreshToken: string, refreshExpiraEn: Date): Sesion {
    return {
      accessToken: this.tokens.emitir(idUsuario, rol),
      refreshToken,
      refreshExpiraEn,
      expiraEnSegundos: this.tokens.segundosVida,
      usuario: { idUsuario, correo, rol },
    };
  }
}
