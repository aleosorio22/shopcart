import express from 'express';
import { z } from 'zod';
import { booleanoQuery, dinero, id, idParam } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { CatalogoService } from '../application/catalogo.service.js';
import { busquedaSchema, categoriaSchema, filtroAdminSchema, imagenSchema, marcaSchema, productoSchema, valorAtributoSchema, varianteSchema } from '../domain/catalogo.js';

const CATALOGO = 'CATALOGO_GESTIONAR';
const PRECIOS = 'PRECIOS_GESTIONAR';
const varianteParam = z.object({ id, idVariante: id });
// La imagen viaja como cuerpo binario; solo esta ruta acepta hasta 5 MB.
const leerImagen = express.raw({ type: ['image/jpeg', 'image/png', 'image/webp'], limit: '5mb' });

const rutasCategorias = (s: CatalogoService): RutaDefinida[] => [
  ruta({
    metodo: 'get', ruta: '/categorias', resumen: 'Listar categorias', acceso: 'publico', query: z.object({ incluirInactivas: booleanoQuery.default(false) }),
    manejar: ({ query }) => s.listarCategorias(query.incluirInactivas),
  }),
  ruta({ metodo: 'post', ruta: '/categorias', resumen: 'Crear categoria', permiso: CATALOGO, status: 201, body: categoriaSchema, manejar: ({ idUsuario, body }) => s.guardarCategoria(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/categorias/:id', resumen: 'Editar categoria', permiso: CATALOGO, params: idParam, body: categoriaSchema, manejar: ({ idUsuario, body, params }) => s.guardarCategoria(idUsuario, body, params.id) }),
  ruta({ metodo: 'delete', ruta: '/categorias/:id', resumen: 'Eliminar o desactivar categoria', permiso: CATALOGO, params: idParam, manejar: ({ idUsuario, params }) => s.eliminarCategoria(idUsuario, params.id) }),
  ruta({ metodo: 'get', ruta: '/marcas', resumen: 'Listar marcas', acceso: 'publico', manejar: () => s.listarMarcas() }),
  ruta({ metodo: 'post', ruta: '/marcas', resumen: 'Crear marca', permiso: CATALOGO, status: 201, body: marcaSchema, manejar: ({ idUsuario, body }) => s.guardarMarca(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/marcas/:id', resumen: 'Editar marca', permiso: CATALOGO, params: idParam, body: marcaSchema, manejar: ({ idUsuario, body, params }) => s.guardarMarca(idUsuario, body, params.id) }),
  ruta({ metodo: 'get', ruta: '/atributos', resumen: 'Listar atributos y valores', acceso: 'publico', manejar: () => s.listarAtributos() }),
  ruta({
    metodo: 'post', ruta: '/atributos/:id/valores', resumen: 'Agregar un valor a un atributo (un color o talla nueva)', permiso: CATALOGO, status: 201, params: idParam, body: valorAtributoSchema,
    manejar: ({ idUsuario, params, body }) => s.agregarValorAtributo(idUsuario, params.id, body.valor),
  }),
];

const rutasProductos = (s: CatalogoService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/productos', resumen: 'Buscar productos con filtros', acceso: 'publico', query: busquedaSchema, manejar: ({ query }) => s.buscarProductos(query) }),
  ruta({ metodo: 'get', ruta: '/admin/productos', resumen: 'Listar productos, incluidos inactivos', permiso: CATALOGO, query: filtroAdminSchema, manejar: ({ idUsuario, query }) => s.listarProductosAdmin(idUsuario, query) }),
  ruta({
    metodo: 'get', ruta: '/productos/:referencia', resumen: 'Detalle por id o slug', acceso: 'publico', params: z.object({ referencia: z.string().max(220) }),
    manejar: ({ params }) => s.obtenerProducto(params.referencia),
  }),
  ruta({ metodo: 'post', ruta: '/productos', resumen: 'Crear producto', permiso: CATALOGO, status: 201, body: productoSchema, manejar: ({ idUsuario, body }) => s.guardarProducto(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/productos/:id', resumen: 'Editar producto', permiso: CATALOGO, params: idParam, body: productoSchema, manejar: ({ idUsuario, body, params }) => s.guardarProducto(idUsuario, body, params.id) }),
  ruta({ metodo: 'delete', ruta: '/productos/:id', resumen: 'Dar de baja producto', permiso: CATALOGO, params: idParam, manejar: ({ idUsuario, params }) => s.eliminarProducto(idUsuario, params.id) }),
  ruta({ metodo: 'post', ruta: '/productos/:id/variantes', resumen: 'Crear variante', permiso: CATALOGO, status: 201, params: idParam, body: varianteSchema, manejar: ({ idUsuario, params, body }) => s.guardarVariante(idUsuario, params.id, body) }),
  ruta({
    metodo: 'put', ruta: '/productos/:id/variantes/:idVariante', resumen: 'Editar variante', permiso: CATALOGO, params: varianteParam, body: varianteSchema.omit({ precio: true }),
    manejar: ({ idUsuario, params, body }) => s.guardarVariante(idUsuario, params.id, body, params.idVariante),
  }),
  ruta({
    metodo: 'post', ruta: '/imagenes/archivo', resumen: 'Subir un archivo de imagen (cuerpo binario JPG, PNG o WEBP, max. 5 MB); devuelve su URL', permiso: CATALOGO, status: 201,
    limitador: leerImagen, manejar: ({ req }) => s.subirImagen(req.body),
  }),
  ruta({ metodo: 'post', ruta: '/productos/:id/imagenes', resumen: 'Agregar imagen', permiso: CATALOGO, status: 201, params: idParam, body: imagenSchema, manejar: ({ idUsuario, params, body }) => s.guardarImagen(idUsuario, params.id, body) }),
  ruta({ metodo: 'delete', ruta: '/imagenes/:id', resumen: 'Eliminar imagen', permiso: CATALOGO, status: 204, params: idParam, manejar: ({ idUsuario, params }) => s.eliminarImagen(idUsuario, params.id) }),
  ruta({
    metodo: 'put', ruta: '/variantes/:id/precio', resumen: 'Cambiar precio', permiso: PRECIOS, status: 204, params: idParam, body: z.object({ precio: dinero }),
    manejar: ({ idUsuario, params, body }) => s.cambiarPrecio(idUsuario, params.id, body.precio),
  }),
  ruta({ metodo: 'get', ruta: '/variantes/:id/precios', resumen: 'Historial de precios', permiso: PRECIOS, params: idParam, manejar: ({ idUsuario, params }) => s.historialPrecios(idUsuario, params.id) }),
];

export const rutasCatalogo = (servicio: CatalogoService): RutaDefinida[] => [...rutasCategorias(servicio), ...rutasProductos(servicio)];
