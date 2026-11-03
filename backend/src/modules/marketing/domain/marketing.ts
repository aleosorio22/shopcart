import { z } from 'zod';
import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import { dinero, fechaHora, id, slug, textoCorto } from '../../../core/http/esquemas.js';

const alcance = z.object({ idCategoria: id.optional(), idMarca: id.optional(), idProducto: id.optional(), idVariante: id.optional() }).refine((a) => Object.keys(a).length === 1, 'Cada alcance apunta a un solo destino');
const vigencia = <T extends { vigenteDesde: string; vigenteHasta: string }>({ vigenteDesde, vigenteHasta }: T) => vigenteDesde < vigenteHasta;

export const promocionSchema = z
  .object({ nombre: textoCorto(120), slug, tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']), valor: dinero.positive(), vigenteDesde: fechaHora, vigenteHasta: fechaHora, activo: z.boolean().default(true), alcance: z.array(alcance).min(1).max(100) })
  .refine(vigencia, { path: ['vigenteHasta'], message: 'Debe ser posterior al inicio' })
  .refine(({ tipoDescuento, valor }) => tipoDescuento !== 'PORCENTAJE' || valor <= 100, { path: ['valor'], message: 'Un porcentaje no puede superar 100' });

export const anuncioSchema = z
  .object({
    codigoZona: textoCorto(40),
    idPromocion: id.nullish(),
    titulo: textoCorto(120),
    subtitulo: z.string().max(200).nullish(),
    imagenEscritorioUrl: textoCorto(500),
    imagenMovilUrl: z.string().max(500).nullish(),
    urlDestino: textoCorto(500),
    orden: z.number().int().min(0).default(0),
    vigenteDesde: fechaHora,
    vigenteHasta: fechaHora,
    activo: z.boolean().default(true),
  })
  .refine(vigencia, { path: ['vigenteHasta'], message: 'Debe ser posterior al inicio' });

export const zonaSchema = z.object({ zona: textoCorto(40) });
export const eventoSchema = z.object({ evento: z.enum(['IMPRESION', 'CLIC']) });

export type Promocion = z.infer<typeof promocionSchema>;
export type Anuncio = z.infer<typeof anuncioSchema>;

export interface MarketingRepository {
  guardarPromocion(actor: number, promocion: Promocion, idPromocion?: number): Promise<number>;
  listarPromociones(actor: number, paginado: Paginacion): Promise<Pagina>;
  guardarAnuncio(actor: number, anuncio: Anuncio, idAnuncio?: number): Promise<number>;
  listarAnuncios(actor: number, paginado: Paginacion): Promise<Pagina>;
  anunciosVigentes(zona: string): Promise<Fila[]>;
  registrarEvento(idAnuncio: number, evento: string): Promise<void>;
}
