import { enviar, obtener } from '../api/cliente';

export interface LineaCarrito {
  IDVariante: number;
  SKU: string;
  IDProducto: number;
  NombreProducto: string;
  Cantidad: number;
  PrecioLista: number;
  DescuentoUnitario: number;
  PrecioFinal: number;
  Subtotal: number;
  Disponible: number;
  Vendible: boolean;
}
export interface Carrito {
  resumen: { IDCarrito: string | null; CodigoCupon: string | null; Subtotal: number; Descuento: number; Total: number };
  lineas: LineaCarrito[];
}

/** Cada operacion devuelve el carrito completo recalculado por la base de datos. */
export const carritoService = {
  obtener: () => obtener<Carrito>('/carrito'),
  agregar: (idVariante: number, cantidad: number) => enviar<Carrito>('post', '/carrito/items', { idVariante, cantidad }),
  cambiarCantidad: (idVariante: number, cantidad: number) => enviar<Carrito>('patch', `/carrito/items/${idVariante}`, { cantidad }),
  quitar: (idVariante: number) => enviar<Carrito>('delete', `/carrito/items/${idVariante}`),
  aplicarCupon: (codigo: string) => enviar<Carrito>('post', '/carrito/cupon', { codigo }),
  quitarCupon: () => enviar<Carrito>('delete', '/carrito/cupon'),
};
