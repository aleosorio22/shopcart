import { AppError } from '../../../core/errors/app-error.js';
import { sp, type Fila, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { AuthRepository, Credenciales, DatosPerfil, MetaSesion, NuevoCliente, Perfil } from '../domain/auth.ports.js';

export class AuthSqlRepository implements AuthRepository {
  constructor(private readonly db: SqlGateway) {}

  async registrarCliente(cliente: Omit<NuevoCliente, 'contrasena'>, hash: string): Promise<number> {
    const [fila] = await this.db.consultar<{ IDUsuario: number }>('Api.SP_Seguridad_RegistrarCliente', {
      Correo: sp.texto(cliente.correo),
      HashContrasena: sp.varchar(hash),
      Nombres: sp.texto(cliente.nombres),
      Apellidos: sp.texto(cliente.apellidos),
      Telefono: sp.varchar(cliente.telefono),
    });
    if (!fila) throw new Error('El registro no devolvio el usuario');
    return fila.IDUsuario;
  }

  async credencialesPorCorreo(correo: string): Promise<Credenciales | undefined> {
    const [fila] = await this.db.consultar<Credenciales>('Api.SP_Seguridad_ObtenerCredenciales', { Correo: sp.texto(correo) });
    return fila;
  }

  async credencialesPorId(idUsuario: number): Promise<Credenciales | undefined> {
    const [fila] = await this.db.consultar<Credenciales>('Api.SP_Seguridad_ObtenerCredencialesPorId', { IDUsuario: sp.int(idUsuario) });
    return fila;
  }

  registrarResultadoLogin(idUsuario: number, exito: boolean): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_RegistrarResultadoLogin', { IDUsuario: sp.int(idUsuario), Exito: sp.bit(exito) });
  }

  crearTokenRefresco(idUsuario: number, hashToken: Buffer, expiraEn: Date, meta: MetaSesion): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_CrearTokenRefresco', {
      IDUsuario: sp.int(idUsuario),
      HashToken: sp.hash(hashToken),
      ExpiraEn: sp.fechaHora(expiraEn),
      DireccionIP: sp.varchar(meta.direccionIP),
      AgenteUsuario: sp.texto(meta.agenteUsuario),
    });
  }

  async rotarTokenRefresco(hashActual: Buffer, hashNuevo: Buffer, expiraEn: Date, meta: MetaSesion): Promise<Credenciales> {
    const [fila] = await this.db.consultar<Credenciales>('Api.SP_Seguridad_RotarTokenRefresco', {
      HashActual: sp.hash(hashActual),
      HashNuevo: sp.hash(hashNuevo),
      ExpiraEn: sp.fechaHora(expiraEn),
      DireccionIP: sp.varchar(meta.direccionIP),
      AgenteUsuario: sp.texto(meta.agenteUsuario),
    });
    if (!fila) throw AppError.noAutenticado('TOKEN_INVALIDO', 'La sesion no es valida o expiro.');
    return fila;
  }

  cerrarSesion(hashToken: Buffer): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_CerrarSesion', { HashToken: sp.hash(hashToken) });
  }

  async obtenerPerfil(idUsuario: number): Promise<Perfil> {
    const [usuarios = [], permisos = []] = await this.db.consultarConjuntos('Api.SP_Seguridad_ObtenerPerfil', { IDUsuario: sp.int(idUsuario) });
    const usuario: Fila | undefined = usuarios[0];
    if (!usuario) throw AppError.noEncontrado();
    return { usuario, permisos: permisos.map((fila) => String(fila.Permiso)) };
  }

  actualizarPerfil(idUsuario: number, datos: DatosPerfil): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_ActualizarPerfil', {
      IDUsuario: sp.int(idUsuario),
      Nombres: sp.texto(datos.nombres),
      Apellidos: sp.texto(datos.apellidos),
      Telefono: sp.varchar(datos.telefono),
    });
  }

  cambiarContrasena(idUsuario: number, hash: string): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_CambiarContrasena', { IDUsuario: sp.int(idUsuario), HashContrasena: sp.varchar(hash) });
  }
}
