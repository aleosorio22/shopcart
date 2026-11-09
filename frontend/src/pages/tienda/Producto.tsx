import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { HiMinus, HiOutlineBuildingStorefront, HiOutlineShieldCheck, HiOutlineTruck, HiPlus } from 'react-icons/hi2';
import { Link, useParams } from 'react-router-dom';
import { ImagenProducto } from '../../components/tienda/ImagenProducto';
import { Precio } from '../../components/tienda/Precio';
import { Boton } from '../../components/ui/Boton';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { useAccionesCarrito } from '../../hooks/useCarrito';
import { useDetalleProducto } from '../../hooks/useCatalogo';
import { checkoutService } from '../../services/checkout.service';
import { atributosDe, type DetalleProducto, type VarianteTienda } from '../../services/catalogo.service';

const descripcionVariante = (variante: VarianteTienda) =>
  atributosDe(variante)
    .map((atributo) => atributo.Valor)
    .join(' · ') || variante.SKU;

function Disponibilidad({ idVariante }: { idVariante: number }) {
  const { data: sucursales } = useQuery({
    queryKey: ['sucursales', idVariante],
    queryFn: () => checkoutService.sucursales(idVariante),
  });
  if (!sucursales?.length) return null;
  return (
    <ul className="space-y-1 text-[14px] text-tinta-suave">
      {sucursales.map((sucursal) => (
        <li key={sucursal.IDSucursal} className="flex justify-between gap-4">
          <span>{sucursal.Nombre}</span>
          <span className={sucursal.Disponible ? 'text-exito' : 'text-tinta-tenue'}>{sucursal.Disponible ? 'Disponible para recoger' : 'No disponible'}</span>
        </li>
      ))}
    </ul>
  );
}

function Ficha({ detalle }: { detalle: DetalleProducto }) {
  const producto = detalle.producto!;
  const variantes = detalle.variantes;
  const [idSeleccionada, setIdSeleccionada] = useState(() => (variantes.find((variante) => variante.Disponible > 0) ?? variantes[0])?.IDVariante);
  const [cantidad, setCantidad] = useState(1);
  const { agregar } = useAccionesCarrito();
  const variante = variantes.find((opcion) => opcion.IDVariante === idSeleccionada);
  const imagen = detalle.imagenes.find((foto) => foto.IDVariante === idSeleccionada) ?? detalle.imagenes[0];
  const maximo = Math.min(variante?.Disponible ?? 0, 999);

  return (
    <div className="contenedor-ancho grid gap-10 py-10 lg:grid-cols-[1.2fr_1fr] lg:gap-16">
      <div className="aspect-square overflow-hidden rounded-[28px] bg-nube lg:sticky lg:top-20">
        <ImagenProducto url={imagen?.Url} nombre={imagen?.TextoAlt ?? producto.Nombre} categoria={producto.Categoria} />
      </div>

      <div className="flex flex-col gap-6">
        <div>
          <Link to={`/tienda?categoria=${producto.IDCategoria}`} className="text-[14px] text-tinta-suave hover:underline">
            {producto.Categoria}
          </Link>
          <h1 className="mt-1 text-[36px] font-semibold leading-tight sm:text-[44px]">{producto.Nombre}</h1>
          {producto.Marca && <p className="mt-1 text-tinta-suave">{producto.Marca}</p>}
        </div>

        {variante && <Precio final={variante.PrecioFinal} lista={variante.PrecioLista} className="text-[24px]" />}

        {variantes.length > 1 && (
          <fieldset>
            <legend className="mb-3 text-[17px] font-semibold">Elige tu modelo.</legend>
            <div className="grid gap-3">
              {variantes.map((opcion) => (
                <label
                  key={opcion.IDVariante}
                  className={`flex cursor-pointer items-center justify-between gap-4 rounded-2xl border-2 px-5 py-4 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-40 ${opcion.IDVariante === idSeleccionada ? 'border-accion' : 'border-linea hover:border-tinta-tenue'}`}
                >
                  <input
                    type="radio"
                    name="variante"
                    className="sr-only"
                    checked={opcion.IDVariante === idSeleccionada}
                    disabled={opcion.Disponible <= 0}
                    onChange={() => {
                      setIdSeleccionada(opcion.IDVariante);
                      setCantidad(1);
                    }}
                  />
                  <span className="font-medium">{descripcionVariante(opcion)}</span>
                  <Precio final={opcion.PrecioFinal} lista={opcion.PrecioLista} className="text-[15px] text-tinta-suave" />
                </label>
              ))}
            </div>
          </fieldset>
        )}

        {variante && variante.Disponible > 0 ? (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center rounded-full bg-nube" role="group" aria-label="Cantidad">
              <button className="p-3 disabled:opacity-30" onClick={() => setCantidad((actual) => actual - 1)} disabled={cantidad <= 1} aria-label="Restar uno">
                <HiMinus />
              </button>
              <span className="w-8 text-center" aria-live="polite">
                {cantidad}
              </span>
              <button className="p-3 disabled:opacity-30" onClick={() => setCantidad((actual) => actual + 1)} disabled={cantidad >= maximo} aria-label="Sumar uno">
                <HiPlus />
              </button>
            </div>
            <Boton tamano="lg" className="flex-1" cargando={agregar.isPending} onClick={() => agregar.mutate({ idVariante: variante.IDVariante, cantidad })}>
              Agregar a la bolsa
            </Boton>
            {variante.Disponible <= 5 && <p className="w-full text-[14px] text-alerta">Solo quedan {variante.Disponible} en linea.</p>}
          </div>
        ) : (
          <p className="rounded-2xl bg-nube p-4 text-tinta-suave">Este modelo esta agotado por ahora.</p>
        )}

        <ul className="divide-y divide-linea/70 rounded-2xl border border-linea/70 text-[14px]">
          <li className="flex gap-3 p-4">
            <HiOutlineTruck className="mt-0.5 shrink-0 text-xl" aria-hidden />
            <span>Envio a domicilio en 1 a 3 dias. Gratis desde Q1,000.</span>
          </li>
          <li className="flex gap-3 p-4">
            <HiOutlineBuildingStorefront className="mt-0.5 shrink-0 text-xl" aria-hidden />
            <div className="flex-1 space-y-2">
              <span>Recoge sin costo en tienda.</span>
              {variante && <Disponibilidad idVariante={variante.IDVariante} />}
            </div>
          </li>
          {producto.MesesGarantia > 0 && (
            <li className="flex gap-3 p-4">
              <HiOutlineShieldCheck className="mt-0.5 shrink-0 text-xl" aria-hidden />
              <span>{producto.MesesGarantia} meses de garantia.</span>
            </li>
          )}
        </ul>

        {producto.Descripcion && (
          <section>
            <h2 className="mb-2 text-[21px] font-semibold">Descripcion</h2>
            <p className="leading-relaxed text-tinta-suave">{producto.Descripcion}</p>
          </section>
        )}
        {detalle.especificaciones.length > 0 && (
          <section>
            <h2 className="mb-2 text-[21px] font-semibold">Especificaciones</h2>
            <dl className="divide-y divide-linea/70 text-[15px]">
              {detalle.especificaciones.map((especificacion, indice) => (
                <div key={indice} className="flex justify-between gap-4 py-2.5">
                  <dt className="text-tinta-suave">{especificacion.Atributo}</dt>
                  <dd>{especificacion.Valor}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
      </div>
    </div>
  );
}

export default function Producto() {
  const { slug } = useParams();
  const consulta = useDetalleProducto(slug);
  return (
    <Consulta
      consulta={consulta}
      esVacio={(detalle) => !detalle.producto || detalle.variantes.length === 0}
      vacio={<EstadoVacio titulo="Este producto no esta disponible" accion={<Link className="enlace" to="/tienda">Volver a la tienda</Link>} />}
    >
      {(detalle) => <Ficha key={detalle.producto?.IDProducto} detalle={detalle} />}
    </Consulta>
  );
}
