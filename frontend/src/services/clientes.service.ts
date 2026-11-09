import { enviar, obtener } from '../api/cliente';

export interface Direccion {
  IDDireccion: number;
  Alias: string;
  Destinatario: string;
  Telefono: string;
  Linea1: string;
  Linea2: string | null;
  Referencia: string | null;
  EsPredeterminada: boolean;
  IDMunicipio: number;
  Municipio: string;
  IDDepartamento: number;
  Departamento: string;
}
export interface Municipio {
  IDDepartamento: number;
  Departamento: string;
  IDMunicipio: number;
  Municipio: string;
}
export interface DatosDireccion {
  idMunicipio: number;
  alias: string;
  destinatario: string;
  telefono: string;
  linea1: string;
  linea2?: string;
  referencia?: string;
  esPredeterminada: boolean;
}

export const clientesService = {
  direcciones: () => obtener<Direccion[]>('/clientes/direcciones'),
  municipios: () => obtener<Municipio[]>('/clientes/municipios'),
  crearDireccion: (datos: DatosDireccion) => enviar<{ idDireccion: number }>('post', '/clientes/direcciones', datos),
  editarDireccion: (id: number, datos: DatosDireccion) => enviar('put', `/clientes/direcciones/${id}`, datos),
  eliminarDireccion: (id: number) => enviar('delete', `/clientes/direcciones/${id}`),
};
