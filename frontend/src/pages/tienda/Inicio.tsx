import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { obtener } from '../../api/cliente';
import { TarjetaProducto, TarjetaProductoEsqueleto } from '../../components/tienda/TarjetaProducto';
import { EnlaceBoton } from '../../components/ui/Boton';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { useBusquedaProductos, useCategorias } from '../../hooks/useCatalogo';
import type { Categoria } from '../../services/catalogo.service';

interface Anuncio {
  IDAnuncio: number;
  Titulo: string;
  Subtitulo: string | null;
  ImagenEscritorioUrl: string | null;
  ImagenMovilUrl: string | null;
}

/** Foto de cada categoria raiz en el inicio. Una categoria nueva sin foto usa un fondo gris. */
const FOTO_CATEGORIA: Record<string, string> = {
  computacion: '/img/tienda/computacion.webp',
  celulares: '/img/tienda/celulares.webp',
  audio: '/img/tienda/audio.webp',
  ropa: '/img/tienda/ropa.webp',
};

function Portada({ anuncio }: { anuncio?: Anuncio }) {
  const imagen = anuncio?.ImagenEscritorioUrl ?? '/img/anuncios/audio.webp';
  return (
    <section className="bg-nube">
      <div className="contenedor-ancho flex flex-col items-center pt-14 text-center sm:pt-20">
        <p className="text-[17px] font-semibold text-alerta">{anuncio ? anuncio.Titulo : 'Nuevo en ShopCart'}</p>
        <h1 className="mt-2 max-w-3xl text-[44px] font-semibold leading-[1.07] tracking-tight sm:text-[64px]">Tecnología que se siente bien.</h1>
        <p className="mt-4 max-w-xl text-[19px] text-tinta-suave sm:text-[21px]">
          {anuncio?.Subtitulo ?? 'Compra en línea y recibe en casa, o recoge en tu tienda favorita.'}
        </p>
        <div className="mt-7 flex flex-wrap justify-center gap-4">
          <EnlaceBoton to="/tienda" tamano="lg">
            Comprar ahora
          </EnlaceBoton>
          <EnlaceBoton to="/tienda?oferta=true" tamano="lg" variante="fantasma">
            Ver ofertas ›
          </EnlaceBoton>
        </div>
        <picture className="mt-12 block w-full overflow-hidden rounded-t-[28px] sm:mt-16">
          {anuncio?.ImagenMovilUrl && <source media="(max-width: 640px)" srcSet={anuncio.ImagenMovilUrl} />}
          <img src={imagen} alt="" className="aspect-[16/10] w-full object-cover sm:aspect-[21/9]" fetchPriority="high" />
        </picture>
      </div>
    </section>
  );
}

function Categorias({ categorias }: { categorias: Categoria[] }) {
  if (categorias.length === 0) return null;
  return (
    <section className="contenedor-ancho py-14">
      <h2 className="mb-6 text-[28px] font-semibold sm:text-[32px]">Explora por categoría.</h2>
      <ul className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {categorias.map((categoria) => {
          const foto = FOTO_CATEGORIA[categoria.Slug];
          return (
            <li key={categoria.IDCategoria}>
              <Link to={`/tienda?categoria=${categoria.IDCategoria}`} className="group relative block aspect-[4/5] overflow-hidden rounded-tarjeta bg-nube">
                {foto && <img src={foto} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105" />}
                <div className="absolute inset-0 bg-gradient-to-t from-black/55 via-black/0 to-black/0" />
                <div className="absolute inset-x-0 bottom-0 p-5 text-white">
                  <p className="text-[21px] font-semibold">{categoria.Nombre}</p>
                  <p className="text-[14px] opacity-90">Comprar ›</p>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

/** Dos mosaicos grandes, como en la portada de una tienda de tecnologia. */
function Destacados({ categorias }: { categorias: Categoria[] }) {
  const id = (slug: string) => categorias.find((categoria) => categoria.Slug === slug)?.IDCategoria;
  const mosaicos = [
    { slug: 'notebooks', titulo: 'Notebooks', texto: 'Potencia para trabajar y estudiar.', foto: '/img/productos/notebook-1.webp', oscuro: false },
    { slug: 'celulares', titulo: 'Celulares', texto: 'Tu mundo, en la palma de tu mano.', foto: '/img/productos/celular-2.webp', oscuro: true },
  ];
  return (
    <section className="contenedor-ancho grid gap-4 pb-4 md:grid-cols-2">
      {mosaicos.map((mosaico) => (
        <Link
          key={mosaico.slug}
          to={id(mosaico.slug) ? `/tienda?categoria=${id(mosaico.slug)}` : '/tienda'}
          className={`group relative flex aspect-[4/5] flex-col items-center overflow-hidden rounded-tarjeta pt-12 text-center sm:aspect-square ${mosaico.oscuro ? 'bg-black text-white' : 'bg-nube text-tinta'}`}
        >
          <h3 className="text-[32px] font-semibold sm:text-[40px]">{mosaico.titulo}</h3>
          <p className={`mt-1 text-[17px] ${mosaico.oscuro ? 'text-white/75' : 'text-tinta-suave'}`}>{mosaico.texto}</p>
          <span className={`mt-4 text-[17px] ${mosaico.oscuro ? 'text-[#2997ff]' : 'text-enlace'} group-hover:underline`}>Ver modelos ›</span>
          <img src={mosaico.foto} alt="" loading="lazy" className="mt-8 w-full flex-1 object-cover transition-transform duration-700 group-hover:scale-[1.03]" />
        </Link>
      ))}
    </section>
  );
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
  const raices = categorias.filter((categoria) => categoria.IDCategoriaPadre === null && categoria.Activo).sort((a, b) => a.Orden - b.Orden);

  return (
    <>
      <Portada anuncio={anuncios?.[0]} />
      <Categorias categorias={raices} />
      <Destacados categorias={categorias} />
      <Rejilla titulo="Lo más reciente." />
      <div className="bg-nube">
        <Rejilla titulo="Ofertas de la semana." soloEnOferta />
      </div>
    </>
  );
}
