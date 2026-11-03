import { aPagina, paginacion, sp, type Pagina, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { FiltroUsuarios, NuevoUsuario, UsuariosRepository } from '../domain/usuarios.ports.js';

export class UsuariosSqlRepository implements UsuariosRepository {
  constructor(private readonly db: SqlGateway) {}

  async listar(actor: number, filtro: FiltroUsuarios): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Seguridad_ListarUsuarios', {
      IDUsuarioActor: sp.int(actor), Texto: sp.texto(filtro.texto), Rol: sp.varchar(filtro.rol), Activo: sp.bit(filtro.activo), ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }

  async crear(actor: number, usuario: Omit<NuevoUsuario, 'contrasena'>, hash: string): Promise<number> {
    const [fila] = await this.db.consultar<{ IDUsuario: number }>('Api.SP_Seguridad_CrearUsuarioInterno', {
      IDUsuarioActor: sp.int(actor), Correo: sp.texto(usuario.correo), HashContrasena: sp.varchar(hash),
      Nombres: sp.texto(usuario.nombres), Apellidos: sp.texto(usuario.apellidos), Rol: sp.varchar(usuario.rol),
    });
    if (!fila) throw new Error('La creacion no devolvio el usuario');
    return fila.IDUsuario;
  }

  cambiarEstado(actor: number, idUsuario: number, activo: boolean): Promise<void> {
    return this.db.ejecutar('Api.SP_Seguridad_CambiarEstadoUsuario', { IDUsuarioActor: sp.int(actor), IDUsuario: sp.int(idUsuario), Activo: sp.bit(activo) });
  }
}
