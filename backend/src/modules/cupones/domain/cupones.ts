import { z } from 'zod';
import type { Pagina } from '../../../core/db/sql-gateway.js';
import { booleanoQuery, dinero, fechaHora, id, paginado } from '../../../core/http/esquemas.js';

export const cuponSchema = z
  .object({
    codigo: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,40}$/, 'Codigo invalido'),
    descripcion: z.string().max(200).nullish(),
    tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
    valor: dinero.positive(),
    descuentoMaximo: dinero.positive().nullish(),
    montoMinimo: dinero.default(0),
    vigenteDesde: fechaHora,
    vigenteHasta: fechaHora,
    limiteTotal: z.number().int().positive().nullish(),
    limitePorCliente: z.number().int().positive().default(1),
    idCategoria: id.nullish(),
    activo: z.boolean().default(true),
  })
  .refine(({ tipoDescuento, valor }) => tipoDescuento !== 'PORCENTAJE' || valor <= 100, { path: ['valor'], message: 'Un porcentaje no puede superar 100' })
  .refine(({ vigenteDesde, vigenteHasta }) => vigenteDesde < vigenteHasta, { path: ['vigenteHasta'], message: 'Debe ser posterior al inicio' });

export const filtroCuponesSchema = paginado.extend({ texto: z.string().trim().max(40).optional(), activo: booleanoQuery.optional() });

export type Cupon = z.infer<typeof cuponSchema>;
export type FiltroCupones = z.infer<typeof filtroCuponesSchema>;

export interface CuponesRepository {
  guardar(actor: number, cupon: Cupon, idCupon?: number): Promise<number>;
  listar(actor: number, filtro: FiltroCupones): Promise<Pagina>;
  desactivar(actor: number, idCupon: number): Promise<void>;
}
