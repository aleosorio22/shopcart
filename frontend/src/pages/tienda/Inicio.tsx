import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { obtener } from '../../api/cliente';
import { TarjetaProducto, TarjetaProductoEsqueleto } from '../../components/tienda/TarjetaProducto';
import { EnlaceBoton } from '../../components/ui/Boton';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { useBusquedaProductos, useCategorias } from '../../hooks/useCatalogo';

interface Anuncio {
  IDAnuncio: number;
  Titulo: string;
  Subtitulo: string | null;
}

function Rejilla({ titulo, soloEnOferta = false }: { titulo: string; soloEnOferta?: boolean }) {
  const consulta = useBusquedaProductos({ tamanoPagina: 8, orden: 'RECIENTES', soloEnOferta });
  return (
    <section className="contenedor-ancho py-14">
      <div className="mb-6 flex items-end justify-between">
        <h2 className="text-[28px] font-semibold sm:text-[32px]">{titulo}</h2>
        <Link to={soloEnOferta ? '/tienda?oferta=true' : '/tienda'} className="enlace text-[15px]">
          Ver todo ›
        </Link>
      </div>
      <Consulta
        consulta={consulta}
        esVacio={(pagina) => pagina.filas.length === 0}
        vacio={<EstadoVacio titulo="Pronto tendremos novedades" />}
        cargando={
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }, (_, indice) => (
              <TarjetaProductoEsqueleto key={indice} />
            ))}
          </div>
        }
      >
        {(pagina) => (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {pagina.filas.map((producto) => (
              <TarjetaProducto key={producto.IDProducto} producto={producto} />
            ))}
          </div>
        )}
      </Consulta>
    </section>
  );
}

export default function Inicio() {
  const { data: anuncios } = useQuery({
    queryKey: ['anuncios', 'HOME_HERO'],
    queryFn: () => obtener<Anuncio[]>('/marketing/anuncios/vigentes', { zona: 'HOME_HERO' }),
    staleTime: 5 * 60_000,
  });
  const { data: categorias = [] } = useCategorias();
  const anuncio = anuncios?.[0];
  const raices = categorias.filter((categoria) => categoria.IDCategoriaPadre === null && categoria.Activo).sort((a, b) => a.Orden - b.Orden);

  return (
    <>
      <section className="bg-nube">
        <div className="contenedor flex flex-col items-center py-20 text-center sm:py-28">
          <p className="text-[17px] font-semibold text-alerta">{anuncio ? anuncio.Titulo : 'Nuevo en ShopCart'}</p>
          <h1 className="mt-2 max-w-3xl text-[44px] font-semibold leading-[1.07] tracking-tight sm:text-[64px]">Tecnología que se siente bien.</h1>
          <p className="mt-4 max-w-xl text-[19px] text-tinta-suave sm:text-[21px]">
            {anuncio?.Subtitulo ?? 'Compra en línea y recibe en casa, o recoge en tu tienda favorita.'}
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <EnlaceBoton to="/tienda" tamano="lg">
              Comprar ahora
            </EnlaceBoton>
            <EnlaceBoton to="/tienda?oferta=true" tamano="lg" variante="fantasma">
              Ver ofertas ›
            </EnlaceBoton>
          </div>
        </div>
      </section>

      {raices.length > 0 && (
        <nav aria-label="Categorias" className="contenedor-ancho pt-14">
          <ul className="flex gap-3 overflow-x-auto pb-2 sm:justify-center">
            {raices.map((categoria) => (
              <li key={categoria.IDCategoria} className="shrink-0">
                <Link to={`/tienda?categoria=${categoria.IDCategoria}`} className="block rounded-full bg-nube px-5 py-2.5 text-[15px] hover:bg-[#e8e8ed]">
                  {categoria.Nombre}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      )}

      <Rejilla titulo="Lo más reciente." />
      <div className="bg-nube">
        <Rejilla titulo="Ofertas de la semana." soloEnOferta />
      </div>
    </>
  );
}
