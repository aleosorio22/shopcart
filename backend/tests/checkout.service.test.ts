import { describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/core/errors/app-error.js';
import { CheckoutService } from '../src/modules/checkout/application/checkout.service.js';
import type { Checkout, CheckoutRepository, DatosPago } from '../src/modules/checkout/domain/checkout.js';
import { PasarelaSimulada, TOKEN_RECHAZADO } from '../src/modules/checkout/infrastructure/pasarela-simulada.js';

const IDEMPOTENCIA = { llave: '6f1b6b1e-3c5c-4a8e-9d0a-3f2a1c9e7b11', hashSolicitud: Buffer.alloc(32) };
const PAGO: DatosPago = { idMetodoPago: 1, tokenPago: 'tok_visa', nitFactura: 'CF' };
const checkout = (cambios: Partial<Checkout> = {}): Checkout => ({
  IDCheckout: 1, Subtotal: 100, DescuentoCupon: 0, CostoEnvio: 0, Total: 100, Estado: 'ACTIVO', ExpiraEn: new Date(Date.now() + 60_000), ...cambios,
});

function repositorioFalso(estado: Checkout = checkout()) {
  return {
    opcionesEnvio: vi.fn(),
    iniciarPago: vi.fn(),
    obtener: vi.fn(async () => estado),
    cancelar: vi.fn(),
    registrarRechazo: vi.fn(async () => undefined),
    crearPedido: vi.fn(async () => ({ IDPedido: 9, NumeroPedido: 'SC-1', Total: 100, Estado: 'PAGADO' })),
  } satisfies CheckoutRepository;
}

describe('CheckoutService.pagar', () => {
  it('un doble clic produce un solo cobro con la misma referencia', async () => {
    const repositorio = repositorioFalso();
    const pasarela = new PasarelaSimulada();
    const cobrar = vi.spyOn(pasarela, 'cobrar');
    const servicio = new CheckoutService(repositorio, pasarela);

    await Promise.all([servicio.pagar(1, 5, PAGO, IDEMPOTENCIA), servicio.pagar(1, 5, PAGO, IDEMPOTENCIA)]);

    const referencias = await Promise.all(cobrar.mock.results.map((r) => r.value as Promise<{ referencia: string }>));
    expect(new Set(referencias.map((r) => r.referencia)).size).toBe(1);
    expect(new Set(cobrar.mock.calls.map(([s]) => s.llave))).toEqual(new Set(['checkout-5']));
  });

  it('un pago rechazado se registra y no crea pedido', async () => {
    const repositorio = repositorioFalso();
    const servicio = new CheckoutService(repositorio, new PasarelaSimulada());
    const error = await servicio.pagar(1, 5, { ...PAGO, tokenPago: TOKEN_RECHAZADO }, IDEMPOTENCIA).catch((e: unknown) => e);
    expect((error as AppError).status).toBe(402);
    expect(repositorio.registrarRechazo).toHaveBeenCalledOnce();
    expect(repositorio.crearPedido).not.toHaveBeenCalled();
  });

  it('tras un rechazo se puede reintentar con otra tarjeta', async () => {
    const repositorio = repositorioFalso();
    const servicio = new CheckoutService(repositorio, new PasarelaSimulada());
    await servicio.pagar(1, 5, { ...PAGO, tokenPago: TOKEN_RECHAZADO }, IDEMPOTENCIA).catch(() => undefined);
    await expect(servicio.pagar(1, 5, PAGO, IDEMPOTENCIA)).resolves.toMatchObject({ NumeroPedido: 'SC-1' });
  });

  it.each([
    ['expirado', checkout({ ExpiraEn: new Date(Date.now() - 1) }), 'CHECKOUT_EXPIRADO'],
    ['cancelado', checkout({ Estado: 'CANCELADO' }), 'CHECKOUT_NO_ACTIVO'],
  ])('no cobra un checkout %s', async (_nombre, estado, codigo) => {
    const pasarela = new PasarelaSimulada();
    const cobrar = vi.spyOn(pasarela, 'cobrar');
    const error = await new CheckoutService(repositorioFalso(estado), pasarela).pagar(1, 5, PAGO, IDEMPOTENCIA).catch((e: unknown) => e);
    expect((error as AppError).codigo).toBe(codigo);
    expect(cobrar).not.toHaveBeenCalled();
  });

  it('cobra el total guardado en la BD', async () => {
    const pasarela = new PasarelaSimulada();
    const cobrar = vi.spyOn(pasarela, 'cobrar');
    await new CheckoutService(repositorioFalso(checkout({ Total: 77.5 })), pasarela).pagar(1, 5, PAGO, IDEMPOTENCIA);
    expect(cobrar.mock.calls[0]?.[0].monto).toBe(77.5);
  });
});
