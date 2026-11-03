import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { ConfiguracionService } from '../application/configuracion.service.js';
import { claveSchema, parametroSchema, tarifaSchema } from '../domain/configuracion.js';

const PERMISO = 'CONFIG_GESTIONAR';

export const rutasConfiguracion = (s: ConfiguracionService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/parametros', resumen: 'Listar parametros', permiso: PERMISO, manejar: ({ idUsuario }) => s.listarParametros(idUsuario) }),
  ruta({ metodo: 'put', ruta: '/parametros/:clave', resumen: 'Cambiar parametro', permiso: PERMISO, status: 204, params: claveSchema, body: parametroSchema, manejar: ({ idUsuario, params, body }) => s.guardarParametro(idUsuario, params.clave, body.valor) }),
  ruta({ metodo: 'put', ruta: '/tarifas-envio', resumen: 'Crear o cambiar tarifa de envio', permiso: PERMISO, status: 204, body: tarifaSchema, manejar: ({ idUsuario, body }) => s.guardarTarifa(idUsuario, body) }),
];
