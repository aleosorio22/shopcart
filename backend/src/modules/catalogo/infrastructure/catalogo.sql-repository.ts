import { aPagina, paginacion, sp, type Fila, type Pagina, type SqlGateway } from '../../../core/db/sql-gateway.js';
import type { Busqueda, Categoria, CatalogoRepository, DetalleProducto, FiltroAdmin, Imagen, Marca, Producto, Variante } from '../domain/catalogo.js';

export class CatalogoSqlRepository implements CatalogoRepository {
  constructor(private readonly db: SqlGateway) {}

  listarCategorias(incluirInactivas: boolean): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Catalogo_ListarCategorias', { IncluirInactivas: sp.bit(incluirInactivas) });
  }

  async guardarCategoria(actor: number, categoria: Categoria, idCategoria?: number): Promise<number> {
    const filas = await this.db.consultar<{ IDCategoria: number }>('Api.SP_Catalogo_GuardarCategoria', {
      IDUsuarioActor: sp.int(actor),
      IDCategoria: sp.int(idCategoria),
      IDCategoriaPadre: sp.int(categoria.idCategoriaPadre),
      Nombre: sp.texto(categoria.nombre),
      Slug: sp.varchar(categoria.slug),
      Descripcion: sp.texto(categoria.descripcion),
      Orden: sp.smallint(categoria.orden),
      Activo: sp.bit(categoria.activo),
    });
    return unico(filas).IDCategoria;
  }

  async eliminarCategoria(actor: number, idCategoria: number): Promise<string> {
    const filas = await this.db.consultar<{ Resultado: string }>('Api.SP_Catalogo_EliminarCategoria', { IDUsuarioActor: sp.int(actor), IDCategoria: sp.int(idCategoria) });
    return unico(filas).Resultado;
  }

  listarMarcas(): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Catalogo_ListarMarcas');
  }

  async guardarMarca(actor: number, marca: Marca, idMarca?: number): Promise<number> {
    const filas = await this.db.consultar<{ IDMarca: number }>('Api.SP_Catalogo_GuardarMarca', {
      IDUsuarioActor: sp.int(actor), IDMarca: sp.int(idMarca), Nombre: sp.texto(marca.nombre), Slug: sp.varchar(marca.slug), LogoUrl: sp.texto(marca.logoUrl), Activo: sp.bit(marca.activo),
    });
    return unico(filas).IDMarca;
  }

  listarAtributos(): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Catalogo_ListarAtributos');
  }

  async guardarValorAtributo(actor: number, idAtributo: number, valor: string): Promise<number> {
    const filas = await this.db.consultar<{ IDValorAtributo: number }>('Api.SP_Catalogo_GuardarValorAtributo', {
      IDUsuarioActor: sp.int(actor), IDAtributo: sp.int(idAtributo), Valor: sp.texto(valor),
    });
    return unico(filas).IDValorAtributo;
  }

  async buscarProductos(busqueda: Busqueda): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Catalogo_BuscarProductos', {
      Texto: sp.texto(busqueda.texto),
      IDCategoria: sp.int(busqueda.idCategoria),
      IDMarca: sp.int(busqueda.idMarca),
      PrecioMinimo: sp.decimal(busqueda.precioMinimo),
      PrecioMaximo: sp.decimal(busqueda.precioMaximo),
      SoloDisponibles: sp.bit(busqueda.soloDisponibles),
      SoloEnOferta: sp.bit(busqueda.soloEnOferta),
      Orden: sp.varchar(busqueda.orden),
      ...paginacion(busqueda),
    });
    return aPagina(filas, busqueda);
  }

  async listarProductosAdmin(actor: number, filtro: FiltroAdmin): Promise<Pagina> {
    const filas = await this.db.consultar('Api.SP_Catalogo_ListarProductosAdmin', {
      IDUsuarioActor: sp.int(actor), Texto: sp.texto(filtro.texto), IDCategoria: sp.int(filtro.idCategoria), Activo: sp.bit(filtro.activo), ...paginacion(filtro),
    });
    return aPagina(filas, filtro);
  }

  async obtenerProducto(referencia: { idProducto?: number; slug?: string }): Promise<DetalleProducto> {
    const [productos = [], variantes = [], imagenes = [], especificaciones = []] = await this.db.consultarConjuntos('Api.SP_Catalogo_ObtenerProducto', {
      IDProducto: sp.int(referencia.idProducto), Slug: sp.varchar(referencia.slug),
    });
    return { producto: productos[0], variantes, imagenes, especificaciones };
  }

  async guardarProducto(actor: number, producto: Producto, idProducto?: number): Promise<number> {
    const filas = await this.db.consultar<{ IDProducto: number }>('Api.SP_Catalogo_GuardarProducto', {
      IDUsuarioActor: sp.int(actor),
      IDProducto: sp.int(idProducto),
      IDCategoria: sp.int(producto.idCategoria),
      IDMarca: sp.int(producto.idMarca),
      Nombre: sp.texto(producto.nombre),
      Slug: sp.varchar(producto.slug),
      Descripcion: sp.texto(producto.descripcion),
      MesesGarantia: sp.smallint(producto.mesesGarantia),
      CodigoImpuesto: sp.varchar(producto.codigoImpuesto),
      Activo: sp.bit(producto.activo),
    });
    return unico(filas).IDProducto;
  }

  async eliminarProducto(actor: number, idProducto: number): Promise<string> {
    const filas = await this.db.consultar<{ Resultado: string }>('Api.SP_Catalogo_EliminarProducto', { IDUsuarioActor: sp.int(actor), IDProducto: sp.int(idProducto) });
    return unico(filas).Resultado;
  }

  async guardarVariante(actor: number, idProducto: number, variante: Variante, idVariante?: number): Promise<number> {
    const filas = await this.db.consultar<{ IDVariante: number }>('Api.SP_Catalogo_GuardarVariante', {
      IDUsuarioActor: sp.int(actor),
      IDVariante: sp.int(idVariante),
      IDProducto: sp.int(idProducto),
      SKU: sp.varchar(variante.sku),
      Precio: sp.decimal(variante.precio),
      PesoGramos: sp.int(variante.pesoGramos),
      Activo: sp.bit(variante.activo),
      AtributosJson: sp.texto(variante.valoresAtributo ? JSON.stringify(variante.valoresAtributo) : null),
    });
    return unico(filas).IDVariante;
  }

  cambiarPrecio(actor: number, idVariante: number, precio: number): Promise<void> {
    return this.db.ejecutar('Api.SP_Catalogo_CambiarPrecio', { IDUsuarioActor: sp.int(actor), IDVariante: sp.int(idVariante), Precio: sp.decimal(precio) });
  }

  historialPrecios(actor: number, idVariante: number): Promise<Fila[]> {
    return this.db.consultar('Api.SP_Catalogo_HistorialPrecios', { IDUsuarioActor: sp.int(actor), IDVariante: sp.int(idVariante) });
  }

  async guardarImagen(actor: number, idProducto: number, imagen: Imagen): Promise<number> {
    const filas = await this.db.consultar<{ IDImagenProducto: number }>('Api.SP_Catalogo_GuardarImagen', {
      IDUsuarioActor: sp.int(actor), IDProducto: sp.int(idProducto), IDVariante: sp.int(imagen.idVariante), Url: sp.texto(imagen.url), TextoAlt: sp.texto(imagen.textoAlt), Orden: sp.smallint(imagen.orden),
    });
    return unico(filas).IDImagenProducto;
  }

  eliminarImagen(actor: number, idImagen: number): Promise<void> {
    return this.db.ejecutar('Api.SP_Catalogo_EliminarImagen', { IDUsuarioActor: sp.int(actor), IDImagenProducto: sp.int(idImagen) });
  }
}

function unico<T>(filas: T[]): T {
  const [fila] = filas;
  if (fila === undefined) throw new Error('El procedimiento no devolvio resultado');
  return fila;
}