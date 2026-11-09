import { useQuery } from '@tanstack/react-query';
import { clientesService } from '../services/clientes.service';

export const CLAVE_DIRECCIONES = ['direcciones'] as const;
export const useDirecciones = () => useQuery({ queryKey: CLAVE_DIRECCIONES, queryFn: clientesService.direcciones });
export const useMunicipios = () => useQuery({ queryKey: ['municipios'], queryFn: clientesService.municipios, staleTime: Infinity });
