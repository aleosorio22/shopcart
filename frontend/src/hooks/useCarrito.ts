import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { mensajeDe } from '../api/error';
import { useAuth } from '../context/AuthContext';
import { carritoService, type Carrito } from '../services/carrito.service';

export const CLAVE_CARRITO = ['carrito'] as const;

/**
 * El carrito depende de quien lo pide (invitado por cookie o usuario por token),
 * asi que la clave incluye al dueno y la consulta espera a que la sesion se resuelva.
 * Sin esa espera, al recargar se pediria como invitado y se veria una bolsa vacia.
 */
function useClaveCarrito() {
  const { estado, perfil } = useAuth();
  return { clave: [...CLAVE_CARRITO, perfil?.usuario.IDUsuario ?? 'invitado'] as const, lista: estado !== 'verificando' };
}

export function useCarrito() {
  const { clave, lista } = useClaveCarrito();
  return useQuery({ queryKey: clave, queryFn: carritoService.obtener, staleTime: 10_000, enabled: lista });
}

/**
 * Las operaciones del carrito devuelven el carrito recalculado por la BD.
 * Se escribe directo en la cache: no hace falta una segunda peticion.
 */
export function useAccionesCarrito() {
  const queryClient = useQueryClient();
  const { clave } = useClaveCarrito();
  const actualizar = (carrito: Carrito) => queryClient.setQueryData(clave, carrito);
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
