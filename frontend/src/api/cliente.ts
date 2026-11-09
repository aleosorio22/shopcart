import axios, { type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';
import { ApiError } from './error';
import type { MetaPagina, Pagina, RespuestaOk } from './tipos';

/**
 * Cliente HTTP unico de la aplicacion.
 * - El access token vive solo en memoria (no en localStorage): un XSS no puede robarlo de disco.
 * - El refresh token es una cookie HttpOnly que el navegador envia solo a /api/v1/auth.
 * - Un 401 dispara una sola renovacion compartida y luego repite la peticion original.
 */
export const http = axios.create({ baseURL: '/api/v1', withCredentials: true, timeout: 20_000 });

export interface SesionRenovada {
  accessToken: string;
  expiraEnSegundos: number;
  usuario: { idUsuario: number; correo: string; rol: Rol };
}
export type Rol = 'CLIENTE' | 'OPERADOR' | 'ADMINISTRADOR';

let accessToken: string | null = null;
let renovacionEnCurso: Promise<SesionRenovada> | null = null;
const oyentes = new Set<(sesion: SesionRenovada | null) => void>();

export const tokenActual = () => accessToken;

/** El AuthContext se suscribe para enterarse de renovaciones y cierres hechos por el interceptor. */
export function alCambiarSesion(oyente: (sesion: SesionRenovada | null) => void): () => void {
  oyentes.add(oyente);
  return () => oyentes.delete(oyente);
}

export function fijarSesion(sesion: SesionRenovada | null): void {
  accessToken = sesion?.accessToken ?? null;
  oyentes.forEach((oyente) => oyente(sesion));
}

/**
 * Comparte una sola promesa entre todas las peticiones que fallen a la vez.
 * Es obligatorio: el backend rota el refresh token y detecta su reutilizacion,
 * asi que dos renovaciones simultaneas cerrarian la sesion.
 */
export function renovarSesion(): Promise<SesionRenovada> {
  renovacionEnCurso ??= axios
    .post<RespuestaOk<SesionRenovada>>('/api/v1/auth/refresh', undefined, { withCredentials: true })
    .then(({ data }) => {
      fijarSesion(data.data);
      return data.data;
    })
    .catch((error: unknown) => {
      fijarSesion(null);
      throw ApiError.desde(error);
    })
    .finally(() => {
      renovacionEnCurso = null;
    });
  return renovacionEnCurso;
}

http.interceptors.request.use((config) => {
  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`;
  return config;
});

interface ConfigReintento extends InternalAxiosRequestConfig {
  _reintentada?: boolean;
}

http.interceptors.response.use(undefined, async (error: unknown) => {
  const apiError = ApiError.desde(error);
  const config = (error as { config?: ConfigReintento }).config;
  const esRutaDeSesion = config?.url?.startsWith('/auth/') ?? false;

  if (apiError.status === 401 && config && !config._reintentada && !esRutaDeSesion && accessToken) {
    config._reintentada = true;
    try {
      await renovarSesion();
      return await http.request(config);
    } catch {
      throw apiError;
    }
  }
  throw apiError;
});

/** Atajos que devuelven solo `data`, ya desenvuelto. */
export async function obtener<T>(url: string, params?: object, config?: AxiosRequestConfig): Promise<T> {
  const { data } = await http.get<RespuestaOk<T>>(url, { ...config, params: limpiar(params) });
  return data.data;
}

export async function obtenerPagina<T>(url: string, params?: object): Promise<Pagina<T>> {
  const { data } = await http.get<RespuestaOk<T[]>>(url, { params: limpiar(params) });
  const meta: MetaPagina = data.meta ?? { total: data.data.length, pagina: 1, tamanoPagina: data.data.length };
  return { filas: data.data, meta };
}

export async function enviar<T = void>(
  metodo: 'post' | 'put' | 'patch' | 'delete',
  url: string,
  cuerpo?: unknown,
  config?: AxiosRequestConfig,
): Promise<T> {
  const { data } = await http.request<RespuestaOk<T> | ''>({ ...config, method: metodo, url, data: cuerpo });
  return (data === '' ? undefined : data.data) as T;
}

/** Quita filtros vacios para no mandar `?texto=` y obtener un 400 de validacion. */
function limpiar(params?: object): Record<string, unknown> | undefined {
  if (!params) return undefined;
  return Object.fromEntries(Object.entries(params).filter(([, valor]) => valor !== undefined && valor !== null && valor !== ''));
}
