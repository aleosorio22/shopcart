import { z } from 'zod';
import type { Fila, Pagina, Paginacion } from '../../../core/db/sql-gateway.js';
import { booleanoQuery, dinero, id, paginado, slug, textoCorto } from '../../../core/http/esquemas.js';

export const categoriaSchema = z.object({
  idCategoriaPadre: id.nullish(),
  nombre: textoCorto(100),
  slug,
  descripcion: z.string().max(500).nullish(),
  orden: z.number().int().min(0).max(32767).default(0),
  activo: z.boolean().default(true),
});

export const marcaSchema = z.object({ nombre: textoCorto(100), slug, logoUrl: z.url().max(500).nullish(), activo: z.boolean().default(true) });

export const productoSchema = z.object({
  idCategoria: id,
  idMarca: id.nullish(),
  nombre: textoCorto(200),
  slug,
  descripcion: z.string().max(10_000).nullish(),
  mesesGarantia: z.number().int().min(0).max(120).default(0),
  codigoImpuesto: z.enum(['IVA', 'EXENTO']).default('IVA'),
  activo: z.boolean().default(true),
});

export const varianteSchema = z.object({
  sku: z.string().trim().min(1).max(40).regex(/^[A-Za-z0-9-]+$/, 'Solo letras, numeros y guiones'),
  precio: dinero.optional(),
  pesoGramos: z.number().int().positive().nullish(),
  activo: z.boolean().default(true),
  valoresAtributo: z.array(id).max(20).optional(),
});

export const imagenSchema = z.object({ idVariante: id.nullish(), url: z.url().max(500), textoAlt: z.string().max(200).nullish(), orden: z.number().int().min(0).default(0) });

export const busquedaSchema = paginado.extend({
  texto: z.string().trim().max(100).optional(),
  idCategoria: id.optional(),
  idMarca: id.optional(),
  precioMinimo: z.coerce.number().nonnegative().optional(),
  precioMaximo: z.coerce.number().nonnegative().optional(),
  soloDisponibles: booleanoQuery.default(false),
  soloEnOferta: booleanoQuery.default(false),
  orden: z.enum(['RECIENTES', 'PRECIO_ASC', 'PRECIO_DESC', 'NOMBRE']).default('RECIENTES'),
});

export const filtroAdminSchema = paginado.extend({ texto: z.string().trim().max(100).optional(), idCategoria: id.optional(), activo: booleanoQuery.optional() });

export type Categoria = z.infer<typeof categoriaSchema>;
export type Marca = z.infer<typeof marcaSchema>;
export type Producto = z.infer<typeof productoSchema>;
export type Variante = z.infer<typeof varianteSchema>;
export type Imagen = z.infer<typeof imagenSchema>;
export type Busqueda = z.infer<typeof busquedaSchema>;
export type FiltroAdmin = z.infer<typeof filtroAdminSchema>;

export interface DetalleProducto {
  producto: Fila | undefined;
  variantes: Fila[];
  imagenes: Fila[];
  especificaciones: Fila[];
}

export interface CatalogoRepository {
  listarCategorias(incluirInactivas: boolean): Promise<Fila[]>;
  guardarCategoria(actor: number, categoria: Categoria, idCategoria?: number): Promise<number>;
  eliminarCategoria(actor: number, idCategoria: number): Promise<string>;
  listarMarcas(): Promise<Fila[]>;
  guardarMarca(actor: number, marca: Marca, idMarca?: number): Promise<number>;
  listarAtributos(): Promise<Fila[]>;
  buscarProductos(busqueda: Busqueda): Promise<Pagina>;
  listarProductosAdmin(actor: number, filtro: FiltroAdmin & Paginacion): Promise<Pagina>;
  obtenerProducto(referencia: { idProducto?: number; slug?: string }): Promise<DetalleProducto>;
  guardarProducto(actor: number, producto: Producto, idProducto?: number): Promise<number>;
  eliminarProducto(actor: number, idProducto: number): Promise<string>;
  guardarVariante(actor: number, idProducto: number, variante: Variante, idVariante?: number): Promise<number>;
  cambiarPrecio(actor: number, idVariante: number, precio: number): Promise<void>;
  historialPrecios(actor: number, idVariante: number): Promise<Fila[]>;
  guardarImagen(actor: number, idProducto: number, imagen: Imagen): Promise<number>;
  eliminarImagen(actor: number, idImagen: number): Promise<void>;
}
