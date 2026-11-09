import { Link } from 'react-router-dom';
import type { ProductoResumen } from '../../services/catalogo.service';
import { ImagenProducto } from './ImagenProducto';
import { Precio } from './Precio';

export function TarjetaProducto({ producto }: { producto: ProductoResumen }) {
  const enOferta = producto.PrecioListaDesde > producto.PrecioDesde;
  const agotado = producto.Disponible <= 0;
  return (
    <Link
      to={`/productos/${producto.Slug}`}
      className="group flex flex-col overflow-hidden rounded-tarjeta bg-white transition-shadow duration-300 hover:shadow-[0_4px_24px_rgba(0,0,0,0.08)]"
    >
      <div className="relative aspect-square overflow-hidden bg-nube">
        <ImagenProducto url={producto.ImagenUrl} nombre={producto.Nombre} categoria={producto.Categoria} className="transition-transform duration-500 group-hover:scale-[1.03]" />
        {enOferta && <span className="absolute left-4 top-4 text-xs font-medium text-alerta">Oferta</span>}
      </div>
      <div className="flex flex-1 flex-col gap-1 p-5">
        {producto.Marca && <span className="text-xs uppercase tracking-wide text-tinta-tenue">{producto.Marca}</span>}
        <h3 className="text-[17px] font-semibold leading-snug">{producto.Nombre}</h3>
        <Precio final={producto.PrecioDesde} lista={producto.PrecioListaDesde} desde className="mt-auto pt-2 text-[15px]" />
        {agotado && <span className="text-xs text-peligro">Agotado</span>}
      </div>
    </Link>
  );
}

export function TarjetaProductoEsqueleto() {
  return (
    <div className="flex animate-pulse flex-col overflow-hidden rounded-tarjeta">
      <div className="aspect-square bg-nube" />
      <div className="space-y-2 p-5">
        <div className="h-3 w-16 rounded bg-nube" />
        <div className="h-4 w-3/4 rounded bg-nube" />
        <div className="h-4 w-1/3 rounded bg-nube" />
      </div>
    </div>
  );
}
