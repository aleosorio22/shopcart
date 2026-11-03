import { z } from 'zod';
import type { Fila } from '../../../core/db/sql-gateway.js';
import { id, textoCorto } from '../../../core/http/esquemas.js';

export const direccionSchema = z.object({
  idMunicipio: id,
  alias: textoCorto(40),
  destinatario: textoCorto(150),
  telefono: z.string().regex(/^\+?\d{8,15}$/, 'Telefono invalido'),
  linea1: textoCorto(200),
  linea2: z.string().trim().max(200).optional(),
  referencia: z.string().trim().max(300).optional(),
  esPredeterminada: z.boolean().default(false),
});

export const datoFiscalSchema = z.object({ nit: z.string().regex(/^(CF|\d{1,14}[0-9Kk]?)$/, 'NIT invalido'), nombreFiscal: textoCorto(200) });

export type Direccion = z.infer<typeof direccionSchema>;
export type DatoFiscal = z.infer<typeof datoFiscalSchema>;

export interface ClientesRepository {
  listarDirecciones(idUsuario: number): Promise<Fila[]>;
  guardarDireccion(idUsuario: number, idDireccion: number | undefined, direccion: Direccion): Promise<number>;
  desactivarDireccion(idUsuario: number, idDireccion: number): Promise<void>;
  listarMunicipios(idDepartamento?: number): Promise<Fila[]>;
  listarDatosFiscales(idUsuario: number): Promise<Fila[]>;
  guardarDatoFiscal(idUsuario: number, dato: DatoFiscal): Promise<void>;
}
