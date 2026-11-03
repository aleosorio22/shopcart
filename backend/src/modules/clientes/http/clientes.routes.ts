import { z } from 'zod';
import { id, idParam } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { ClientesService } from '../application/clientes.service.js';
import { datoFiscalSchema, direccionSchema } from '../domain/clientes.js';

export const rutasClientes = (servicio: ClientesService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/direcciones', resumen: 'Mis direcciones', manejar: ({ idUsuario }) => servicio.listarDirecciones(idUsuario) }),
  ruta({
    metodo: 'post', ruta: '/direcciones', resumen: 'Agregar direccion', status: 201, body: direccionSchema,
    manejar: ({ idUsuario, body }) => servicio.guardarDireccion(idUsuario, body),
  }),
  ruta({
    metodo: 'put', ruta: '/direcciones/:id', resumen: 'Editar direccion propia', params: idParam, body: direccionSchema,
    manejar: ({ idUsuario, params, body }) => servicio.guardarDireccion(idUsuario, body, params.id),
  }),
  ruta({
    metodo: 'delete', ruta: '/direcciones/:id', resumen: 'Desactivar direccion propia', status: 204, params: idParam,
    manejar: ({ idUsuario, params }) => servicio.desactivarDireccion(idUsuario, params.id),
  }),
  ruta({
    metodo: 'get', ruta: '/municipios', resumen: 'Departamentos y municipios', acceso: 'publico', query: z.object({ idDepartamento: id.optional() }),
    manejar: ({ query }) => servicio.listarMunicipios(query.idDepartamento),
  }),
  ruta({ metodo: 'get', ruta: '/datos-fiscales', resumen: 'Mis datos de facturacion', manejar: ({ idUsuario }) => servicio.listarDatosFiscales(idUsuario) }),
  ruta({
    metodo: 'post', ruta: '/datos-fiscales', resumen: 'Guardar datos de facturacion', status: 204, body: datoFiscalSchema,
    manejar: ({ idUsuario, body }) => servicio.guardarDatoFiscal(idUsuario, body),
  }),
];
