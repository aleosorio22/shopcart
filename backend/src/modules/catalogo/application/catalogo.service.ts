import { AppError } from '../../../core/errors/app-error.js';
import type { Fila, Pagina } from '../../../core/db/sql-gateway.js';
import type { AlmacenImagenes, Busqueda, Categoria, CatalogoRepository, FormatoImagen, DetalleProducto, FiltroAdmin, Imagen, Marca, Producto, Variante } from '../domain/catalogo.js';

export const BYTES_MAXIMOS_IMAGEN = 5 * 1024 * 1024;

/** Identifica la imagen por su firma binaria: el nombre y el Content-Type los decide el cliente y no son confiables. */
export function formatoDeImagen(contenido: Buffer): FormatoImagen | undefined {
  if (contenido.length >= 3 && contenido[0] === 0xff && contenido[1] === 0xd8 && contenido[2] === 0xff) return 'jpg';
  if (contenido.length >= 8 && contenido.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (contenido.length >= 12 && contenido.toString('ascii', 0, 4) === 'RIFF' && contenido.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  return undefined;
}

export class CatalogoService {
  constructor(
    private readonly repositorio: CatalogoRepository,
    private readonly almacen: AlmacenImagenes,
  ) {}

  /** Guarda el archivo y devuelve su URL; luego se asocia al producto con guardarImagen. */
  async subirImagen(contenido: unknown): Promise<{ url: string }> {
    const invalido = (mensaje: string) => AppError.datosInvalidos([{ campo: 'archivo', mensaje }]);
    if (!Buffer.isBuffer(contenido) || contenido.length === 0) throw invalido('Envia una imagen JPG, PNG o WEBP.');
    if (contenido.length > BYTES_MAXIMOS_IMAGEN) throw invalido('La imagen no puede pesar mas de 5 MB.');
    const formato = formatoDeImagen(contenido);
    if (!formato) throw invalido('El archivo no es una imagen JPG, PNG o WEBP valida.');
    return { url: await this.almacen.guardar(contenido, formato) };
  }

  listarCategorias(incluirInactivas: boolean): Promise<Fila[]> {
    return this.repositorio.listarCategorias(incluirInactivas);
  }

  async guardarCategoria(actor: number, categoria: Categoria, idCategoria?: number): Promise<{ idCategoria: number }> {
    return { idCategoria: await this.repositorio.guardarCategoria(actor, categoria, idCategoria) };
  }

  async eliminarCategoria(actor: number, idCategoria: number): Promise<{ resultado: string }> {
    return { resultado: await this.repositorio.eliminarCategoria(actor, idCategoria) };
  }

  listarMarcas(): Promise<Fila[]> {
    return this.repositorio.listarMarcas();
  }

  async guardarMarca(actor: number, marca: Marca, idMarca?: number): Promise<{ idMarca: number }> {
    return { idMarca: await this.repositorio.guardarMarca(actor, marca, idMarca) };
  }

  listarAtributos(): Promise<Fila[]> {
    return this.repositorio.listarAtributos();
  }

  async agregarValorAtributo(actor: number, idAtributo: number, valor: string): Promise<{ idValorAtributo: number }> {
    return { idValorAtributo: await this.repositorio.guardarValorAtributo(actor, idAtributo, valor) };
  }

  buscarProductos(busqueda: Busqueda): Promise<Pagina> {
    if (busqueda.precioMinimo !== undefined && busqueda.precioMaximo !== undefined && busqueda.precioMinimo > busqueda.precioMaximo) {
      throw AppError.datosInvalidos([{ campo: 'precioMinimo', mensaje: 'No puede ser mayor que precioMaximo' }]);
    }
    return this.repositorio.buscarProductos(busqueda);
  }

  listarProductosAdmin(actor: number, filtro: FiltroAdmin): Promise<Pagina> {
    return this.repositorio.listarProductosAdmin(actor, filtro);
  }

  async obtenerProducto(referencia: string): Promise<DetalleProducto> {
    const esId = /^\d+$/.test(referencia);
    return this.repositorio.obtenerProducto(esId ? { idProducto: Number(referencia) } : { slug: referencia });
  }

  async guardarProducto(actor: number, producto: Producto, idProducto?: number): Promise<{ idProducto: number }> {
    return { idProducto: await this.repositorio.guardarProducto(actor, producto, idProducto) };
  }

  async eliminarProducto(actor: number, idProducto: number): Promise<{ resultado: string }> {
    return { resultado: await this.repositorio.eliminarProducto(actor, idProducto) };
  }

  async guardarVariante(actor: number, idProducto: number, variante: Variante, idVariante?: number): Promise<{ idVariante: number }> {
    if (idVariante === undefined && variante.precio === undefined) {
      throw AppError.datosInvalidos([{ campo: 'precio', mensaje: 'Una variante nueva requiere precio' }]);
    }
    return { idVariante: await this.repositorio.guardarVariante(actor, idProducto, variante, idVariante) };
  }

  cambiarPrecio(actor: number, idVariante: number, precio: number): Promise<void> {
    return this.repositorio.cambiarPrecio(actor, idVariante, precio);
  }

  historialPrecios(actor: number, idVariante: number): Promise<Fila[]> {
    return this.repositorio.historialPrecios(actor, idVariante);
  }

  async guardarImagen(actor: number, idProducto: number, imagen: Imagen): Promise<{ idImagenProducto: number }> {
    return { idImagenProducto: await this.repositorio.guardarImagen(actor, idProducto, imagen) };
  }

  eliminarImagen(actor: number, idImagen: number): Promise<void> {
    return this.repositorio.eliminarImagen(actor, idImagen);
  }
}
