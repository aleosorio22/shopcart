import { enviar, obtener, obtenerPagina } from '../api/cliente';
import type { FiltroPaginado } from '../api/tipos';

export interface Categoria {
  IDCategoria: number;
  IDCategoriaPadre: number | null;
  Nombre: string;
  Slug: string;
  Descripcion: string | null;
  Orden: number;
  Activo: boolean;
}
export interface Marca {
  IDMarca: number;
  Nombre: string;
  Slug: string;
  LogoUrl: string | null;
  Activo: boolean;
}
export interface ValorAtributo {
  IDAtributo: number;
  Atributo: string;
  IDValorAtributo: number;
  Valor: string;
}
export interface ProductoResumen {
  IDProducto: number;
  Nombre: string;
  Slug: string;
  IDCategoria: number;
  Categoria: string;
  Marca: string | null;
  PrecioDesde: number;
  PrecioListaDesde: number;
  Disponible: number;
  ImagenUrl: string | null;
}
export interface VarianteTienda {
  IDVariante: number;
  SKU: string;
  PrecioLista: number;
  DescuentoUnitario: number;
  PrecioFinal: number;
  Disponible: number;
  AtributosJson: string | null;
}
export interface DetalleProducto {
  producto?: {
    IDProducto: number;
    Nombre: string;
    Slug: string;
    Descripcion: string | null;
    MesesGarantia: number;
    IDCategoria: number;
    Categoria: string;
    IDMarca: number | null;
    Marca: string | null;
    CodigoImpuesto?: string;
    Activo?: boolean;
  };
  variantes: VarianteTienda[];
  imagenes: { IDImagenProducto: number; IDVariante: number | null; Url: string; TextoAlt: string | null; Orden: number }[];
  especificaciones: { Atributo: string; Valor: string }[];
}
export type OrdenCatalogo = 'RECIENTES' | 'PRECIO_ASC' | 'PRECIO_DESC' | 'NOMBRE';
export interface FiltroCatalogo extends FiltroPaginado {
  texto?: string;
  idCategoria?: number;
  idMarca?: number;
  precioMinimo?: number;
  precioMaximo?: number;
  soloDisponibles?: boolean;
  soloEnOferta?: boolean;
  orden?: OrdenCatalogo;
}
export interface ProductoAdmin {
  IDProducto: number;
  Nombre: string;
  Slug: string;
  Activo: boolean;
  IDCategoria: number;
  Categoria: string;
  IDMarca: number | null;
  Marca: string | null;
  ActualizadoEn: string;
  Variantes: number;
}
export interface FiltroProductosAdmin extends FiltroPaginado {
  texto?: string;
  idCategoria?: number;
  activo?: boolean;
}
export interface DatosProducto {
  idCategoria: number;
  idMarca?: number | null;
  nombre: string;
  slug: string;
  descripcion?: string | null;
  mesesGarantia: number;
  codigoImpuesto: 'IVA' | 'EXENTO';
  activo: boolean;
}
export interface DatosVariante {
  sku: string;
  precio?: number;
  pesoGramos?: number | null;
  activo: boolean;
  valoresAtributo?: number[];
}
export interface PrecioHistorico {
  IDPrecioVariante: string;
  Precio: number;
  VigenteDesde: string;
  VigenteHasta: string | null;
  CorreoUsuario: string | null;
}

/** Los atributos de una variante llegan como JSON en una columna: se interpretan aqui una sola vez. */
export function atributosDe(variante: Pick<VarianteTienda, 'AtributosJson'>): { Atributo: string; Valor: string }[] {
  if (!variante.AtributosJson) return [];
  try {
    return JSON.parse(variante.AtributosJson) as { Atributo: string; Valor: string }[];
  } catch {
    return [];
  }
}

export const catalogoService = {
  categorias: (incluirInactivas = false) => obtener<Categoria[]>('/catalogo/categorias', { incluirInactivas: incluirInactivas || undefined }),
  marcas: () => obtener<Marca[]>('/catalogo/marcas'),
  atributos: () => obtener<ValorAtributo[]>('/catalogo/atributos'),
  agregarValorAtributo: (idAtributo: number, valor: string) =>
    enviar<{ idValorAtributo: number }>('post', `/catalogo/atributos/${idAtributo}/valores`, { valor }),
  buscar: (filtro: FiltroCatalogo) => obtenerPagina<ProductoResumen>('/catalogo/productos', filtro),
  detalle: (referencia: string | number) => obtener<DetalleProducto>(`/catalogo/productos/${referencia}`),
  listarAdmin: (filtro: FiltroProductosAdmin) => obtenerPagina<ProductoAdmin>('/catalogo/admin/productos', filtro),
  crearProducto: (datos: DatosProducto) => enviar<{ idProducto: number }>('post', '/catalogo/productos', datos),
  editarProducto: (id: number, datos: DatosProducto) => enviar<{ idProducto: number }>('put', `/catalogo/productos/${id}`, datos),
  eliminarProducto: (id: number) => enviar<{ resultado: string }>('delete', `/catalogo/productos/${id}`),
  crearVariante: (idProducto: number, datos: DatosVariante) =>
    enviar<{ idVariante: number }>('post', `/catalogo/productos/${idProducto}/variantes`, datos),
  editarVariante: (idProducto: number, idVariante: number, datos: DatosVariante) =>
    enviar<{ idVariante: number }>('put', `/catalogo/productos/${idProducto}/variantes/${idVariante}`, datos),
  cambiarPrecio: (idVariante: number, precio: number) => enviar('put', `/catalogo/variantes/${idVariante}/precio`, { precio }),
  /** Sube el archivo tal cual (cuerpo binario) y devuelve la URL donde quedo guardado. */
  subirArchivo: (archivo: File) =>
    enviar<{ url: string }>('post', '/catalogo/imagenes/archivo', archivo, { headers: { 'Content-Type': archivo.type }, timeout: 60_000 }),
  agregarImagen: (idProducto: number, datos: { url: string; textoAlt?: string; idVariante?: number; orden: number }) =>
    enviar<{ idImagenProducto: number }>('post', `/catalogo/productos/${idProducto}/imagenes`, datos),
  eliminarImagen: (idImagen: number) => enviar('delete', `/catalogo/imagenes/${idImagen}`),
  historialPrecios: (idVariante: number) => obtener<PrecioHistorico[]>(`/catalogo/variantes/${idVariante}/precios`),
};
