import type { Carrito, CarritoRepository, DuenoCarrito } from '../domain/carrito.js';

export class CarritoService {
  constructor(private readonly repositorio: CarritoRepository) {}

  obtener(dueno: DuenoCarrito): Promise<Carrito> {
    return this.repositorio.obtener(dueno);
  }

  agregar(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
    return this.repositorio.agregar(dueno, idVariante, cantidad);
  }

  actualizarCantidad(dueno: DuenoCarrito, idVariante: number, cantidad: number): Promise<Carrito> {
    return this.repositorio.actualizarCantidad(dueno, idVariante, cantidad);
  }

  eliminar(dueno: DuenoCarrito, idVariante: number): Promise<Carrito> {
    return this.repositorio.eliminar(dueno, idVariante);
  }

  aplicarCupon(dueno: DuenoCarrito, codigo: string): Promise<Carrito> {
    return this.repositorio.aplicarCupon(dueno, codigo);
  }

  quitarCupon(dueno: DuenoCarrito): Promise<Carrito> {
    return this.repositorio.quitarCupon(dueno);
  }

  fusionar(idUsuario: number, hashInvitado: Buffer): Promise<void> {
    return this.repositorio.fusionarInvitado(idUsuario, hashInvitado);
  }
}
