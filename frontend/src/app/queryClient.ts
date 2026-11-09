import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../api/error';

/** Errores del cliente (4xx) no se reintentan: repetirlos daria el mismo resultado. */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (intentos, error) => {
        const status = ApiError.desde(error).status;
        return status >= 400 && status < 500 ? false : intentos < 2;
      },
    },
    mutations: { retry: false },
  },
});
