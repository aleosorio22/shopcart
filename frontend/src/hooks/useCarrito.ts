import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mensajeDe } from '../api/error';
import { carritoService, type Carrito } from '../services/carrito.service';

export const CLAVE_CARRITO = ['carrito'] as const;

export function useCarrito() {
  return useQuery({ queryKey: CLAVE_CARRITO, queryFn: carritoService.obtener, staleTime: 10_000 });
}

/**
 * Las operaciones del carrito devuelven el carrito recalculado por la BD.
 * Se escribe directo en la cache: no hace falta una segunda peticion.
 */
export function useAccionesCarrito() {
  const queryClient = useQueryClient();
  const actualizar = (carrito: Carrito) => queryClient.setQueryData(CLAVE_CARRITO, carrito);
  const alFallar = (error: unknown) => toast.error(mensajeDe(error));

  const agregar = useMutation({
    mutationFn: ({ idVariante, cantidad }: { idVariante: number; cantidad: number }) => carritoService.agregar(idVariante, cantidad),
    onSuccess: (carrito) => {
      actualizar(carrito);
      toast.success('Agregado a tu bolsa');
    },
    onError: alFallar,
  });
  const cambiarCantidad = useMutation({
    mutationFn: ({ idVariante, cantidad }: { idVariante: number; cantidad: number }) => carritoService.cambiarCantidad(idVariante, cantidad),
    onSuccess: actualizar,
    onError: alFallar,
  });
  const quitar = useMutation({ mutationFn: carritoService.quitar, onSuccess: actualizar, onError: alFallar });
  const aplicarCupon = useMutation({ mutationFn: carritoService.aplicarCupon, onSuccess: actualizar });
  const quitarCupon = useMutation({ mutationFn: carritoService.quitarCupon, onSuccess: actualizar, onError: alFallar });

  return { agregar, cambiarCantidad, quitar, aplicarCupon, quitarCupon };
}
