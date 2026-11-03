import { idParam, paginado } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { MarketingService } from '../application/marketing.service.js';
import { anuncioSchema, eventoSchema, promocionSchema, zonaSchema } from '../domain/marketing.js';

const PERMISO = 'MARKETING_GESTIONAR';

export const rutasMarketing = (s: MarketingService): RutaDefinida[] => [
  ruta({ metodo: 'get', ruta: '/promociones', resumen: 'Listar promociones', permiso: PERMISO, query: paginado, manejar: ({ idUsuario, query }) => s.listarPromociones(idUsuario, query) }),
  ruta({ metodo: 'post', ruta: '/promociones', resumen: 'Crear promocion', permiso: PERMISO, status: 201, body: promocionSchema, manejar: ({ idUsuario, body }) => s.guardarPromocion(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/promociones/:id', resumen: 'Editar promocion', permiso: PERMISO, params: idParam, body: promocionSchema, manejar: ({ idUsuario, body, params }) => s.guardarPromocion(idUsuario, body, params.id) }),
  ruta({ metodo: 'get', ruta: '/anuncios', resumen: 'Listar anuncios con metricas', permiso: PERMISO, query: paginado, manejar: ({ idUsuario, query }) => s.listarAnuncios(idUsuario, query) }),
  ruta({ metodo: 'post', ruta: '/anuncios', resumen: 'Crear anuncio', permiso: PERMISO, status: 201, body: anuncioSchema, manejar: ({ idUsuario, body }) => s.guardarAnuncio(idUsuario, body) }),
  ruta({ metodo: 'put', ruta: '/anuncios/:id', resumen: 'Editar anuncio', permiso: PERMISO, params: idParam, body: anuncioSchema, manejar: ({ idUsuario, body, params }) => s.guardarAnuncio(idUsuario, body, params.id) }),
  ruta({ metodo: 'get', ruta: '/anuncios/vigentes', resumen: 'Anuncios visibles en una zona', acceso: 'publico', query: zonaSchema, manejar: ({ query }) => s.anunciosVigentes(query.zona) }),
  ruta({ metodo: 'post', ruta: '/anuncios/:id/eventos', resumen: 'Registrar impresion o clic', acceso: 'publico', status: 204, params: idParam, body: eventoSchema, manejar: ({ params, body }) => s.registrarEvento(params.id, body.evento) }),
];
