import { z } from 'zod';
import type { Fila, Pagina } from '../../../core/db/sql-gateway.js';
import { booleanoQuery, fechaHora, id, paginado, textoCorto } from '../../../core/http/esquemas.js';

const cantidad = z.number().int().positive();
const motivo = textoCorto(300);

export const entradaSchema = z.object({
  idVariante: id,
  idBodega: id,
  cantidad,
  costoUnitario: z.number().nonnegative().multipleOf(0.0001),
  motivo: z.string().trim().max(300).optional(),
  referenciaDocumento: z.string().trim().max(60).optional(),
});
export const ajusteSchema = z.object({ idVariante: id, idBodega: id, cantidad: z.number().int().refine((valor) => valor !== 0, 'No puede ser cero'), motivo });
export const trasladoSchema = z
  .object({ idVariante: id, idBodegaOrigen: id, idBodegaDestino: id, cantidad, motivo })
  .refine(({ idBodegaOrigen, idBodegaDestino }) => idBodegaOrigen !== idBodegaDestino, 'Las bodegas deben ser distintas');
export const filtroExistenciaSchema = paginado.extend({ texto: z.string().trim().max(100).optional(), idBodega: id.optional(), soloBajoMinimo: booleanoQuery.default(false) });
export const filtroKardexSchema = paginado.extend({ idVariante: id.optional(), idBodega: id.optional(), desde: fechaHora.optional(), hasta: fechaHora.optional() });
export const sucursalSchema = z.object({
  codigo: textoCorto(20),
  nombre: textoCorto(120),
  idMunicipio: id,
  direccion: textoCorto(250),
  telefono: z.string().max(20).nullish(),
  horario: z.string().max(200).nullish(),
  permiteRecoger: z.boolean().default(true),
  activo: z.boolean().default(true),
});
export const bodegaSchema = z.object({
  idSucursal: id.nullish(),
  codigo: textoCorto(20),
  nombre: textoCorto(120),
  permiteVentaEnLinea: z.boolean().default(true),
  prioridad: z.number().int().min(0).max(32767).default(100),
  activo: z.boolean().default(true),
});
export const filtroSucursalSchema = z.object({ soloRecoger: booleanoQuery.default(false), idVariante: id.optional() });

export type Entrada = z.infer<typeof entradaSchema>;
export type Ajuste = z.infer<typeof ajusteSchema>;
export type Traslado = z.infer<typeof trasladoSchema>;
export type FiltroExistencia = z.infer<typeof filtroExistenciaSchema>;
export type FiltroKardex = z.infer<typeof filtroKardexSchema>;
export type Sucursal = z.infer<typeof sucursalSchema>;
export type Bodega = z.infer<typeof bodegaSchema>;
export type FiltroSucursal = z.infer<typeof filtroSucursalSchema>;

export interface InventarioRepository {
  registrarEntrada(actor: number, entrada: Entrada): Promise<void>;
  ajustar(actor: number, ajuste: Ajuste): Promise<void>;
  trasladar(actor: number, traslado: Traslado): Promise<void>;
  consultarExistencia(actor: number, filtro: FiltroExistencia): Promise<Pagina>;
  consultarKardex(actor: number, filtro: FiltroKardex): Promise<Pagina>;
  conciliar(actor: number): Promise<Fila[]>;
  listarBodegas(): Promise<Fila[]>;
  guardarBodega(actor: number, bodega: Bodega, idBodega?: number): Promise<number>;
  listarSucursales(filtro: FiltroSucursal): Promise<Fila[]>;
  guardarSucursal(actor: number, sucursal: Sucursal, idSucursal?: number): Promise<number>;
}
