import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppError } from '../src/core/errors/app-error.js';
import { sha256 } from '../src/core/security/hash.js';
import { AuthService } from '../src/modules/auth/application/auth.service.js';
import type { AuthRepository, Credenciales, FusionCarrito, HasherContrasena } from '../src/modules/auth/domain/auth.ports.js';
import { JwtEmisorTokens } from '../src/modules/auth/infrastructure/seguridad.adapters.js';

const SECRETO = 'secreto-de-prueba-con-mas-de-32-caracteres';
const META = { direccionIP: '127.0.0.1', agenteUsuario: 'vitest' };
const credenciales = (cambios: Partial<Credenciales> = {}): Credenciales => ({
  IDUsuario: 7, Correo: 'a@b.test', HashContrasena: 'hash:correcta', Activo: true, BloqueadoHasta: null, Rol: 'CLIENTE', ...cambios,
});

const hasher: HasherContrasena = {
  generar: async (c) => `hash:${c}`,
  comparar: vi.fn(async (c: string, h: string) => h === `hash:${c}`),
};

function repositorioFalso(): AuthRepository {
  return {
    registrarCliente: vi.fn(async () => 7),
    credencialesPorCorreo: vi.fn(async () => credenciales()),
    credencialesPorId: vi.fn(async () => credenciales()),
    registrarResultadoLogin: vi.fn(async () => undefined),
    crearTokenRefresco: vi.fn(async () => undefined),
    rotarTokenRefresco: vi.fn(async () => credenciales()),
    cerrarSesion: vi.fn(async () => undefined),
    obtenerPerfil: vi.fn(async () => ({ usuario: { Rol: 'CLIENTE' }, permisos: [] })),
    actualizarPerfil: vi.fn(async () => undefined),
    cambiarContrasena: vi.fn(async () => undefined),
  };
}

const fallaCon = async (promesa: Promise<unknown>, codigo: string) => {
  const error = await promesa.catch((e: unknown) => e);
  expect(error).toBeInstanceOf(AppError);
  expect((error as AppError).codigo).toBe(codigo);
};

describe('AuthService', () => {
  let repositorio: AuthRepository;
  let carrito: FusionCarrito;
  let servicio: AuthService;

  beforeEach(() => {
    vi.clearAllMocks();
    repositorio = repositorioFalso();
    carrito = { fusionar: vi.fn(async () => undefined) } as unknown as typeof carrito;
    servicio = new AuthService(repositorio, hasher, new JwtEmisorTokens(SECRETO, 900), carrito, { diasVidaRefresh: 7 });
  });

  it('guarda solo el hash del refresh token', async () => {
    const sesion = await servicio.iniciarSesion('a@b.test', 'correcta', META);
    const [, hashGuardado] = vi.mocked(repositorio.crearTokenRefresco).mock.calls[0] ?? [];
    expect(hashGuardado).toEqual(sha256(sesion.refreshToken));
    expect(hashGuardado?.toString()).not.toContain(sesion.refreshToken);
  });

  it('responde igual si el correo no existe, y aun asi compara un hash', async () => {
    vi.mocked(repositorio.credencialesPorCorreo).mockResolvedValue(undefined);
    await fallaCon(servicio.iniciarSesion('no@existe.test', 'x', META), 'CREDENCIALES_INVALIDAS');
    expect(hasher.comparar).toHaveBeenCalledOnce();
  });

  it('registra el intento fallido', async () => {
    await fallaCon(servicio.iniciarSesion('a@b.test', 'mala', META), 'CREDENCIALES_INVALIDAS');
    expect(repositorio.registrarResultadoLogin).toHaveBeenCalledWith(7, false);
  });

  it('rechaza una cuenta bloqueada aunque la contrasena sea correcta', async () => {
    vi.mocked(repositorio.credencialesPorCorreo).mockResolvedValue(credenciales({ BloqueadoHasta: new Date(Date.now() + 60_000) }));
    await fallaCon(servicio.iniciarSesion('a@b.test', 'correcta', META), 'CREDENCIALES_INVALIDAS');
    expect(repositorio.crearTokenRefresco).not.toHaveBeenCalled();
  });

  it('un usuario inactivo no obtiene sesion', async () => {
    vi.mocked(repositorio.credencialesPorCorreo).mockResolvedValue(credenciales({ Activo: false }));
    await fallaCon(servicio.iniciarSesion('a@b.test', 'correcta', META), 'USUARIO_INACTIVO');
  });

  it('rota el token: el nuevo es distinto y se guarda su hash', async () => {
    const sesion = await servicio.refrescar('token-viejo', META);
    expect(sesion.refreshToken).not.toBe('token-viejo');
    const [actual, nuevo] = vi.mocked(repositorio.rotarTokenRefresco).mock.calls[0] ?? [];
    expect(actual).toEqual(sha256('token-viejo'));
    expect(nuevo).toEqual(sha256(sesion.refreshToken));
  });

  it('fusiona el carrito de invitado al iniciar sesion', async () => {
    const hash = sha256('invitado');
    await servicio.iniciarSesion('a@b.test', 'correcta', META, hash);
    expect(carrito.fusionar).toHaveBeenCalledWith(7, hash);
  });

  it('cambiar contrasena exige la actual', async () => {
    await fallaCon(servicio.cambiarContrasena(7, 'mala', 'nuevaClave123'), 'CREDENCIALES_INVALIDAS');
    expect(repositorio.cambiarContrasena).not.toHaveBeenCalled();
  });

  it('invalidar la sesion obliga a consultar el perfil de nuevo', async () => {
    const token = new JwtEmisorTokens(SECRETO, 900).emitir(7, 'CLIENTE');
    await servicio.autenticar(token);
    await servicio.autenticar(token);
    expect(repositorio.obtenerPerfil).toHaveBeenCalledOnce();
    servicio.invalidarSesion(7);
    await servicio.autenticar(token);
    expect(repositorio.obtenerPerfil).toHaveBeenCalledTimes(2);
  });
});
