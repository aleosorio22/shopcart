import { useEffect, useState } from 'react';
import { TarjetaProducto, TarjetaProductoEsqueleto } from '../../components/tienda/TarjetaProducto';
import { Boton } from '../../components/ui/Boton';
import { Casilla, Selector } from '../../components/ui/Campo';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { Paginacion } from '../../components/ui/Paginacion';
import { useBusquedaProductos, useCategorias, useMarcas } from '../../hooks/useCatalogo';
import { useDebounce } from '../../hooks/useDebounce';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import type { OrdenCatalogo } from '../../services/catalogo.service';

const FILTROS = {
  texto: undefined as string | undefined,
  categoria: undefined as string | undefined,
  marca: undefined as string | undefined,
  min: undefined as string | undefined,
  max: undefined as string | undefined,
  disponibles: undefined as string | undefined,
  oferta: undefined as string | undefined,
  orden: 'RECIENTES' as string | undefined,
};

const aNumero = (valor?: string) => (valor ? Number(valor) : undefined);

export default function Catalogo() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl(FILTROS);
  const { data: categorias = [] } = useCategorias();
  const { data: marcas = [] } = useMarcas();

  // El rango de precio se escribe a mano: se espera a que el usuario termine.
  const [rango, setRango] = useState({ min: valores.min ?? '', max: valores.max ?? '' });
  const rangoListo = useDebounce(rango, 500);
  useEffect(() => {
    if (rangoListo.min !== (valores.min ?? '') || rangoListo.max !== (valores.max ?? '')) actualizar({ min: rangoListo.min, max: rangoListo.max });
    // Solo reacciona al valor ya estabilizado.
    // eslint-disable-next-line react/exhaustive-deps
  }, [rangoListo]);

  const minimo = aNumero(valores.min);
  const maximo = aNumero(valores.max);
  const rangoInvalido = minimo !== undefined && maximo !== undefined && minimo > maximo;

  const consulta = useBusquedaProductos({
    pagina,
    tamanoPagina: 12,
    texto: valores.texto,
    idCategoria: aNumero(valores.categoria),
    idMarca: aNumero(valores.marca),
    precioMinimo: rangoInvalido ? undefined : minimo,
    precioMaximo: rangoInvalido ? undefined : maximo,
    soloDisponibles: valores.disponibles === 'true' || undefined,
    soloEnOferta: valores.oferta === 'true' || undefined,
    orden: (valores.orden as OrdenCatalogo) ?? 'RECIENTES',
  });

  const categoriaActual = categorias.find((categoria) => String(categoria.IDCategoria) === valores.categoria);
  const titulo = valores.texto ? `Resultados para “${valores.texto}”` : (categoriaActual?.Nombre ?? (valores.oferta ? 'Ofertas' : 'Todos los productos'));
  const hayFiltros = Object.entries(valores).some(([clave, valor]) => clave !== 'orden' && valor);

  return (
    <div className="contenedor-ancho py-10">
      <h1 className="text-[40px] font-semibold leading-tight sm:text-[48px]">{titulo}</h1>

      <div className="mt-8 grid gap-10 lg:grid-cols-[220px_1fr]">
        <aside aria-label="Filtros" className="space-y-5 text-[15px]">
          <Selector etiqueta="Categoria" value={valores.categoria ?? ''} onChange={(evento) => actualizar({ categoria: evento.target.value })}>
            <option value="">Todas</option>
            {categorias
              .filter((categoria) => categoria.Activo)
              .map((categoria) => (
                <option key={categoria.IDCategoria} value={categoria.IDCategoria}>
                  {categoria.IDCategoriaPadre ? `· ${categoria.Nombre}` : categoria.Nombre}
                </option>
              ))}
          </Selector>
          <Selector etiqueta="Marca" value={valores.marca ?? ''} onChange={(evento) => actualizar({ marca: evento.target.value })}>
            <option value="">Todas</option>
            {marcas.map((marca) => (
              <option key={marca.IDMarca} value={marca.IDMarca}>
                {marca.Nombre}
              </option>
            ))}
          </Selector>
          <fieldset className="space-y-1.5">
            <legend className="text-[13px] font-medium text-tinta-suave">Precio (Q)</legend>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Min"
                aria-label="Precio minimo"
                value={rango.min}
                onChange={(evento) => setRango((actual) => ({ ...actual, min: evento.target.value }))}
                className="w-full rounded-xl border border-linea px-3 py-2 text-[15px] outline-none focus:border-accion"
              />
              <span className="text-tinta-tenue">–</span>
              <input
                type="number"
                min={0}
                inputMode="numeric"
                placeholder="Max"
                aria-label="Precio maximo"
                value={rango.max}
                onChange={(evento) => setRango((actual) => ({ ...actual, max: evento.target.value }))}
                className="w-full rounded-xl border border-linea px-3 py-2 text-[15px] outline-none focus:border-accion"
              />
            </div>
            {rangoInvalido && (
              <p role="alert" className="text-[13px] text-peligro">
                El minimo no puede ser mayor que el maximo.
              </p>
            )}
          </fieldset>
          <div className="space-y-2">
            <Casilla etiqueta="Solo disponibles" checked={valores.disponibles === 'true'} onChange={(evento) => actualizar({ disponibles: evento.target.checked ? 'true' : undefined })} />
            <Casilla etiqueta="En oferta" checked={valores.oferta === 'true'} onChange={(evento) => actualizar({ oferta: evento.target.checked ? 'true' : undefined })} />
          </div>
          {hayFiltros && (
            <Boton
              variante="fantasma"
              tamano="sm"
              className="px-0"
              onClick={() => {
                setRango({ min: '', max: '' });
                actualizar({ texto: '', categoria: '', marca: '', min: '', max: '', disponibles: '', oferta: '' });
              }}
            >
              Limpiar filtros
            </Boton>
          )}
        </aside>

        <section aria-live="polite">
          <div className="mb-5 flex items-center justify-between gap-4">
            <p className="text-sm text-tinta-suave">{consulta.data ? `${consulta.data.meta.total} productos` : ' '}</p>
            <label className="flex items-center gap-2 text-sm text-tinta-suave">
              Ordenar
              <select
                value={valores.orden ?? 'RECIENTES'}
                onChange={(evento) => actualizar({ orden: evento.target.value })}
                className="rounded-full bg-nube px-3 py-1.5 text-tinta outline-none"
              >
                <option value="RECIENTES">Mas recientes</option>
                <option value="PRECIO_ASC">Precio: menor a mayor</option>
                <option value="PRECIO_DESC">Precio: mayor a menor</option>
                <option value="NOMBRE">Nombre</option>
              </select>
            </label>
          </div>
          <Consulta
            consulta={consulta}
            esVacio={(resultado) => resultado.filas.length === 0}
            vacio={<EstadoVacio titulo="No encontramos productos" descripcion="Prueba con otra busqueda o quita algunos filtros." />}
            cargando={
              <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                {Array.from({ length: 6 }, (_, indice) => (
                  <TarjetaProductoEsqueleto key={indice} />
                ))}
              </div>
            }
          >
            {(resultado) => (
              <div className={consulta.isPlaceholderData ? 'opacity-60' : ''}>
                <div className="grid grid-cols-2 gap-4 xl:grid-cols-3">
                  {resultado.filas.map((producto) => (
                    <TarjetaProducto key={producto.IDProducto} producto={producto} />
                  ))}
                </div>
                <Paginacion meta={resultado.meta} alCambiar={irAPagina} />
              </div>
            )}
          </Consulta>
        </section>
      </div>
    </div>
  );
}
