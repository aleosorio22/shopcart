import { describe, expect, it } from 'vitest';
import { aSlug, quetzales } from '../utils/formato';
import { rutaSegura } from '../utils/navegacion';
import { esDevolvible, siguientesEstados } from '../utils/pedidos';

describe('aSlug', () => {
  it('quita acentos, mayusculas y simbolos', () => {
    expect(aSlug('  Audífonos JBL Tune 520BT!! ')).toBe('audifonos-jbl-tune-520bt');
  });
});

describe('quetzales', () => {
  it('formatea en GTQ', () => {
    expect(quetzales(1234.5)).toContain('1,234.50');
  });
});

describe('rutaSegura', () => {
  it('acepta rutas internas', () => {
    expect(rutaSegura('/checkout', '/')).toBe('/checkout');
  });
  it('rechaza redirecciones a otros sitios', () => {
    expect(rutaSegura('//evil.example', '/')).toBe('/');
    expect(rutaSegura('https://evil.example', '/')).toBe('/');
    expect(rutaSegura(null, '/panel')).toBe('/panel');
  });
});

describe('siguientesEstados', () => {
  it('distingue envio a domicilio y recoger en tienda', () => {
    expect(siguientesEstados('EN_PREPARACION', false)).toEqual(['DESPACHADO']);
    expect(siguientesEstados('EN_PREPARACION', true)).toEqual(['LISTO_RECOGER']);
  });
  it('no ofrece avanzar estados finales', () => {
    expect(siguientesEstados('ENTREGADO', false)).toEqual([]);
    expect(siguientesEstados('CANCELADO', false)).toEqual([]);
  });
  it('solo permite devolver pedidos entregados', () => {
    expect(esDevolvible('ENTREGADO')).toBe(true);
    expect(esDevolvible('DESPACHADO')).toBe(false);
  });
});
