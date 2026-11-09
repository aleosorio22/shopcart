import { AxiosError, AxiosHeaders, type InternalAxiosRequestConfig } from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiError } from '../api/error';

describe('ApiError.desde', () => {
  const respuesta = (status: number, data: unknown) => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    return new AxiosError('fallo', 'ERR', config, null, { status, statusText: '', headers: {}, config, data });
  };

  it('conserva codigo, mensaje y detalles del backend', () => {
    const error = ApiError.desde(
      respuesta(400, { success: false, error: { codigo: 'DATOS_INVALIDOS', mensaje: 'Datos invalidos', detalles: [{ campo: 'correo', mensaje: 'Correo invalido' }], requestId: 'r1' } }),
    );
    expect(error.codigo).toBe('DATOS_INVALIDOS');
    expect(error.status).toBe(400);
    expect(error.detalles).toEqual([{ campo: 'correo', mensaje: 'Correo invalido' }]);
    expect(error.requestId).toBe('r1');
  });

  it('distingue la falta de conexion', () => {
    const config = { headers: new AxiosHeaders() } as InternalAxiosRequestConfig;
    expect(ApiError.desde(new AxiosError('Network Error', 'ERR_NETWORK', config)).codigo).toBe('SIN_CONEXION');
  });

  it('nunca expone errores desconocidos', () => {
    expect(ApiError.desde(new Error('detalle interno')).message).toBe('Ocurrio un error inesperado.');
  });
});

describe('renovarSesion', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.resetModules();
  });

  it('comparte una sola peticion de refresh entre llamadas simultaneas', async () => {
    const axios = (await import('axios')).default;
    const sesion = { accessToken: 'nuevo', expiraEnSegundos: 900, usuario: { idUsuario: 1, correo: 'a@b.c', rol: 'CLIENTE' } };
    const post = vi.spyOn(axios, 'post').mockResolvedValue({ data: { success: true, data: sesion } });
    const { renovarSesion, tokenActual } = await import('../api/cliente');

    // Con rotacion de refresh token, dos renovaciones en paralelo cerrarian la sesion.
    const [primera, segunda] = await Promise.all([renovarSesion(), renovarSesion()]);

    expect(post).toHaveBeenCalledTimes(1);
    expect(primera).toEqual(sesion);
    expect(segunda).toEqual(sesion);
    expect(tokenActual()).toBe('nuevo');
  });

  it('limpia el token si la renovacion falla', async () => {
    const axios = (await import('axios')).default;
    vi.spyOn(axios, 'post').mockRejectedValue(new Error('401'));
    const { renovarSesion, tokenActual, fijarSesion } = await import('../api/cliente');
    fijarSesion({ accessToken: 'viejo', expiraEnSegundos: 1, usuario: { idUsuario: 1, correo: 'a@b.c', rol: 'CLIENTE' } });

    await expect(renovarSesion()).rejects.toMatchObject({ name: 'ApiError' });
    expect(tokenActual()).toBeNull();
  });
});
