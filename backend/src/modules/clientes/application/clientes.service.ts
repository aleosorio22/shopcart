import type { Fila } from '../../../core/db/sql-gateway.js';
import type { ClientesRepository, DatoFiscal, Direccion } from '../domain/clientes.js';

/** Todas las operaciones reciben el usuario de la sesion: un cliente solo alcanza lo suyo. */
export class ClientesService {
  constructor(private readonly repositorio: ClientesRepository) {}

  listarDirecciones(idUsuario: number): Promise<Fila[]> {
    return this.repositorio.listarDirecciones(idUsuario);
  }

  async guardarDireccion(idUsuario: number, direccion: Direccion, idDireccion?: number): Promise<{ idDireccion: number }> {
    return { idDireccion: await this.repositorio.guardarDireccion(idUsuario, idDireccion, direccion) };
  }

  desactivarDireccion(idUsuario: number, idDireccion: number): Promise<void> {
    return this.repositorio.desactivarDireccion(idUsuario, idDireccion);
  }

  listarMunicipios(idDepartamento?: number): Promise<Fila[]> {
    return this.repositorio.listarMunicipios(idDepartamento);
  }

  listarDatosFiscales(idUsuario: number): Promise<Fila[]> {
    return this.repositorio.listarDatosFiscales(idUsuario);
  }

  guardarDatoFiscal(idUsuario: number, dato: DatoFiscal): Promise<void> {
    return this.repositorio.guardarDatoFiscal(idUsuario, dato);
  }
}
