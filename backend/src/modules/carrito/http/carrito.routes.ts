import type { Request, Response } from 'express';
import { z } from 'zod';
import { asegurarHashInvitado } from '../../../core/http/cookies.js';
import { id } from '../../../core/http/esquemas.js';
import { ruta, type RutaDefinida, type UsuarioSesion } from '../../../core/http/route.js';
import type { CarritoService } from '../application/carrito.service.js';
import { cantidadSchema, cuponSchema, itemSchema, type DuenoCarrito } from '../domain/carrito.js';

const varianteParam = z.object({ idVariante: id });

export function rutasCarrito(s: CarritoService, cookieSegura: boolean): RutaDefinida[] {
  const dueno = ({ usuario, req, res }: { usuario: UsuarioSesion | undefined; req: Request; res: Response }): DuenoCarrito =>
    usuario ? { idUsuario: usuario.idUsuario } : { hashInvitado: asegurarHashInvitado(req, res, cookieSegura) };

  return [
    ruta({ metodo: 'get', ruta: '/', resumen: 'Ver carrito con subtotal, descuento y total', acceso: 'opcional', manejar: (c) => s.obtener(dueno(c)) }),
    ruta({ metodo: 'post', ruta: '/items', resumen: 'Agregar producto', acceso: 'opcional', body: itemSchema, manejar: (c) => s.agregar(dueno(c), c.body.idVariante, c.body.cantidad) }),
    ruta({
      metodo: 'patch', ruta: '/items/:idVariante', resumen: 'Modificar cantidad', acceso: 'opcional', params: varianteParam, body: cantidadSchema,
      manejar: (c) => s.actualizarCantidad(dueno(c), c.params.idVariante, c.body.cantidad),
    }),
    ruta({ metodo: 'delete', ruta: '/items/:idVariante', resumen: 'Eliminar producto', acceso: 'opcional', params: varianteParam, manejar: (c) => s.eliminar(dueno(c), c.params.idVariante) }),
    ruta({ metodo: 'post', ruta: '/cupon', resumen: 'Aplicar cupon', acceso: 'opcional', body: cuponSchema, manejar: (c) => s.aplicarCupon(dueno(c), c.body.codigo) }),
    ruta({ metodo: 'delete', ruta: '/cupon', resumen: 'Quitar cupon', acceso: 'opcional', manejar: (c) => s.quitarCupon(dueno(c)) }),
  ];
}
