import { z } from 'zod';
import { id, idParam } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida } from '../../../core/http/route.js';
import type { CheckoutService } from '../application/checkout.service.js';
import { iniciarSchema, pagoSchema } from '../domain/checkout.js';

export const rutasCheckout = (s: CheckoutService): RutaDefinida[] => [
  ruta({
    metodo: 'get', ruta: '/envios', resumen: 'Opciones de envio para una direccion propia', query: z.object({ idDireccion: id.optional() }),
    manejar: ({ idUsuario, query }) => s.opcionesEnvio(idUsuario, query.idDireccion),
  }),
  ruta({
    metodo: 'post', ruta: '/', resumen: 'Iniciar pago: congela precios y reserva 15 minutos', status: 201, idempotente: true, body: iniciarSchema,
    manejar: ({ idUsuario, body, idempotencia }) => s.iniciar(idUsuario, body, idempotencia),
  }),
  ruta({
    metodo: 'post', ruta: '/:id/pagar', resumen: 'Cobrar y crear el pedido', status: 201, idempotente: true, params: idParam, body: pagoSchema,
    manejar: ({ idUsuario, params, body, idempotencia }) => s.pagar(idUsuario, params.id, body, idempotencia),
  }),
  ruta({ metodo: 'delete', ruta: '/:id', resumen: 'Cancelar checkout y liberar la reserva', status: 204, params: idParam, manejar: ({ idUsuario, params }) => s.cancelar(idUsuario, params.id) }),
];
