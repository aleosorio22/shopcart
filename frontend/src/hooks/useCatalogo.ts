import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { catalogoService, type FiltroCatalogo } from '../services/catalogo.service';

const UNA_HORA = 60 * 60_000;

/** Categorias y marcas cambian poco: se guardan en cache una hora. */
export const useCategorias = () => useQuery({ queryKey: ['categorias'], queryFn: () => catalogoService.categorias(), staleTime: UNA_HORA });
export const useMarcas = () => useQuery({ queryKey: ['marcas'], queryFn: catalogoService.marcas, staleTime: UNA_HORA });

export const useBusquedaProductos = (filtro: FiltroCatalogo) =>
  useQuery({ queryKey: ['productos', filtro], queryFn: () => catalogoService.buscar(filtro), placeholderData: keepPreviousData });

export const useDetalleProducto = (referencia: string | undefined) =>
  useQuery({ queryKey: ['producto', referencia], queryFn: () => catalogoService.detalle(referencia!), enabled: Boolean(referencia) });
