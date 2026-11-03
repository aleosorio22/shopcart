import { sp, type Fila, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { ClientesRepository, DatoFiscal, Direccion } from '../domain/clientes.js';

export class ClientesSqlRepository implements ClientesRepository {
  constructor(private readonly db: SqlGateway) {}

  listarDirecciones(idUsuario: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Clientes_ListarDirecciones', { IDUsuario: sp.int(idUsuario) });
  }

  async guardarDireccion(idUsuario: number, idDireccion: number | undefined, direccion: Direccion): Promise<number> {
    const [fila] = await this.db.consultar<{ IDDireccion: number }>('Api.SP_Clientes_GuardarDireccion', {
      IDUsuario: sp.int(idUsuario),
      IDDireccion: sp.int(idDireccion),
      IDMunicipio: sp.int(direccion.idMunicipio),
      Alias: sp.texto(direccion.alias),
      Destinatario: sp.texto(direccion.destinatario),
      Telefono: sp.varchar(direccion.telefono),
      Linea1: sp.texto(direccion.linea1),
      Linea2: sp.texto(direccion.linea2),
      Referencia: sp.texto(direccion.referencia),
      EsPredeterminada: sp.bit(direccion.esPredeterminada),
    });
    if (!fila) throw new Error('Guardar direccion no devolvio el registro');
    return fila.IDDireccion;
  }

  desactivarDireccion(idUsuario: number, idDireccion: number): Promise<void> {
    return this.db.ejecutar('Api.SP_Clientes_DesactivarDireccion', { IDUsuario: sp.int(idUsuario), IDDireccion: sp.int(idDireccion) });
  }

  listarMunicipios(idDepartamento?: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Clientes_ListarMunicipios', { IDDepartamento: sp.smallint(idDepartamento) });
  }

  listarDatosFiscales(idUsuario: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Clientes_ListarDatosFiscales', { IDUsuario: sp.int(idUsuario) });
  }

  guardarDatoFiscal(idUsuario: number, dato: DatoFiscal): Promise<void> {
    return this.db.ejecutar('Api.SP_Clientes_GuardarDatoFiscal', { IDUsuario: sp.int(idUsuario), NIT: sp.varchar(dato.nit), NombreFiscal: sp.texto(dato.nombreFiscal) });
  }
}
