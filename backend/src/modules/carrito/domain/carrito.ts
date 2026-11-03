import { z } from 'zod';
import type { Fila } from '../../../core/db/sql-gateway.js';
import { id } from '../../../core/http/esquemas.js';

export const itemSchema = z.object({ idVariante: id, cantidad: z.number().int().min(1).max(999).default(1) });
export const cantidadSchema = z.object({ cantidad: z.number().int().min(1).max(999) });
export const cuponSchema = z.object({ codigo: z.string().trim().min(1).max(40) });

/** El duenio sale de la sesion o de la cookie: el API no acepta un IDCarrito. */
export interface DuenoCarrito {
  idUsuario?: number | undefined;
  hashInvitado?: Buffer | undefined;
}

export interface Carrito {
  resumen: Fila | undefined;
  lineas: Fila[];
}

export interface CarritoRepository {
  obtener(dueno: DuenoCarrito): Promise<Carrito>;
  agregar(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito>;
  actualizarCantidad(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito>;
  eliminar(dueno: DuenoCarrito, idVariante: number): Promise<Carrito>;
  aplicarCupon(dueno: DuenoCarrito, codigo: string): Promise<Carrito>;
  quitarCupon(dueno: DuenoCarrito): Promise<Carrito>;
  fusionarInvitado(idUsuario: number, hashInvitado: Buffer): Promise<void>;
}
