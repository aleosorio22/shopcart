import { AppError } from '../../../core/errors/app-error.js';
import type { Fila, Pagina } from '../../../core/db/sql-gateway.js';
import type { Busqueda, Categoria, CatalogoRepository, DetalleProducto, FiltroAdmin, Imagen, Marca, Producto, Variante } from '../domain/catalogo.js';

export class CatalogoService {
  constructor(private readonly repositorio: CatalogoRepository) {}

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
