import type { Pagina } from '../../../core/db/sql-gateway.js';
import type { HasherContrasena } from '../../auth/domain/auth.ports.js';
import type { FiltroUsuarios, NuevoUsuario, UsuariosRepository } from '../domain/usuarios.ports.js';

export class UsuariosService {
  constructor(
    private readonly repositorio: UsuariosRepository,
    private readonly hasher: HasherContrasena,
    private readonly invalidarSesion: (idUsuario: number) => void,
  ) {}

  listar(actor: number, filtro: FiltroUsuarios): Promise<Pagina> {
    return this.repositorio.listar(actor, filtro);
  }

  async crear(actor: number, { contrasena, ...usuario }: NuevoUsuario): Promise<{ idUsuario: number }> {
    return { idUsuario: await this.repositorio.crear(actor, usuario, await this.hasher.generar(contrasena)) };
  }

  async cambiarEstado(actor: number, idUsuario: number, activo: boolean): Promise<void> {
    await this.repositorio.cambiarEstado(actor, idUsuario, activo);
    this.invalidarSesion(idUsuario);
  }
}
