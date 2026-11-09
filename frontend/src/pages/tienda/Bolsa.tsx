import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import { HiOutlineShoppingBag, HiOutlineTrash } from 'react-icons/hi2';
import { Link, useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { mensajeDe } from '../../api/error';
import { ImagenProducto } from '../../components/tienda/ImagenProducto';
import { Boton, EnlaceBoton } from '../../components/ui/Boton';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { useAuth } from '../../context/AuthContext';
import { useAccionesCarrito, useCarrito } from '../../hooks/useCarrito';
import type { Carrito, LineaCarrito } from '../../services/carrito.service';
import { quetzales } from '../../utils/formato';

const esquemaCupon = z.object({ codigo: z.string().trim().min(3, 'Escribe el código del cupón').max(40) });

function Linea({ linea }: { linea: LineaCarrito }) {
  const { cambiarCantidad, quitar } = useAccionesCarrito();
  const ocupada = cambiarCantidad.isPending || quitar.isPending;
  const maximo = Math.max(linea.Cantidad, Math.min(linea.Disponible, 999));

  return (
    <li className={`flex gap-5 py-6 ${ocupada ? 'opacity-60' : ''}`}>
      <Link to={`/productos/${linea.IDProducto}`} className="h-28 w-28 shrink-0 overflow-hidden rounded-2xl bg-nube">
        <ImagenProducto nombre={linea.NombreProducto} />
      </Link>
      <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Link to={`/productos/${linea.IDProducto}`} className="text-[19px] font-semibold hover:underline">
            {linea.NombreProducto}
          </Link>
          <p className="text-[13px] text-tinta-tenue">SKU {linea.SKU}</p>
          {!linea.Vendible && <p className="mt-1 text-[14px] text-peligro">Ya no hay existencia suficiente. Reduce la cantidad o quítalo.</p>}
        </div>
        <div className="flex items-center gap-4 sm:flex-col sm:items-end">
          <select
            aria-label={`Cantidad de ${linea.NombreProducto}`}
            value={linea.Cantidad}
            disabled={ocupada}
            onChange={(evento) => cambiarCantidad.mutate({ idVariante: linea.IDVariante, cantidad: Number(evento.target.value) })}
            className="rounded-full bg-nube px-3 py-1.5 outline-none"
          >
            {Array.from({ length: Math.min(maximo, 20) }, (_, indice) => indice + 1).map((numero) => (
              <option key={numero} value={numero}>
                {numero}
              </option>
            ))}
          </select>
          <span className="text-[19px] font-semibold">{quetzales(linea.Subtotal)}</span>
          {linea.DescuentoUnitario > 0 && <s className="text-[13px] text-tinta-tenue">{quetzales(linea.PrecioLista * linea.Cantidad)}</s>}
          <button onClick={() => quitar.mutate(linea.IDVariante)} disabled={ocupada} className="inline-flex items-center gap-1 text-[14px] text-enlace hover:underline">
            <HiOutlineTrash aria-hidden /> Quitar
          </button>
        </div>
      </div>
    </li>
  );
}

function Cupon({ codigo }: { codigo: string | null }) {
  const { aplicarCupon, quitarCupon } = useAccionesCarrito();
  const { register, handleSubmit, setError, reset, formState } = useForm({ resolver: zodResolver(esquemaCupon), defaultValues: { codigo: '' } });

  if (codigo)
    return (
      <div className="flex items-center justify-between rounded-2xl bg-exito/5 px-4 py-3 text-[15px]">
        <span>
          Cupón <strong className="font-semibold">{codigo}</strong> aplicado
        </span>
        <button className="enlace text-[14px]" onClick={() => quitarCupon.mutate()} disabled={quitarCupon.isPending}>
          Quitar
        </button>
      </div>
    );

  return (
    <form
      noValidate
      onSubmit={handleSubmit((datos) =>
        aplicarCupon.mutateAsync(datos.codigo).then(
          () => reset(),
          // Cada causa de rechazo (vencido, agotado, monto minimo...) trae su propio mensaje.
          (error: unknown) => setError('codigo', { message: mensajeDe(error) }),
        ),
      )}
      className="space-y-1.5"
    >
      <div className="flex gap-2">
        <input
          {...register('codigo')}
          placeholder="Código de cupón"
          aria-label="Código de cupón"
          aria-invalid={Boolean(formState.errors.codigo)}
          className="flex-1 rounded-full border border-linea px-4 py-2 text-[15px] uppercase outline-none focus:border-accion"
        />
        <Boton type="submit" variante="secundario" cargando={aplicarCupon.isPending}>
          Aplicar
        </Boton>
      </div>
      {formState.errors.codigo && (
        <p role="alert" className="px-4 text-[13px] text-peligro">
          {formState.errors.codigo.message}
        </p>
      )}
    </form>
  );
}

function Resumen({ carrito }: { carrito: Carrito }) {
  const { estado } = useAuth();
  const navegar = useNavigate();
  const bloqueado = carrito.lineas.some((linea) => !linea.Vendible);
  return (
    <aside className="h-fit space-y-5 rounded-3xl bg-nube p-6 lg:sticky lg:top-20">
      <Cupon codigo={carrito.resumen.CodigoCupon} />
      <dl className="space-y-2 text-[15px]">
        <div className="flex justify-between">
          <dt className="text-tinta-suave">Subtotal</dt>
          <dd>{quetzales(carrito.resumen.Subtotal)}</dd>
        </div>
        {carrito.resumen.Descuento > 0 && (
          <div className="flex justify-between text-exito">
            <dt>Descuento</dt>
            <dd>−{quetzales(carrito.resumen.Descuento)}</dd>
          </div>
        )}
        <div className="flex justify-between">
          <dt className="text-tinta-suave">Envío</dt>
          <dd className="text-tinta-suave">Se calcula al pagar</dd>
        </div>
        <div className="flex justify-between border-t border-linea pt-3 text-[21px] font-semibold">
          <dt>Total</dt>
          <dd>{quetzales(carrito.resumen.Total)}</dd>
        </div>
        <p className="text-[12px] text-tinta-tenue">IVA del 12 % incluido.</p>
      </dl>
      <Boton tamano="lg" className="w-full" disabled={bloqueado} onClick={() => navegar(estado === 'autenticado' ? '/checkout' : '/ingresar?volver=%2Fcheckout')}>
        {estado === 'autenticado' ? 'Pagar' : 'Inicia sesión para pagar'}
      </Boton>
      {bloqueado && <p className="text-[13px] text-peligro">Corrige los artículos sin existencia para continuar.</p>}
    </aside>
  );
}

export default function Bolsa() {
  const consulta = useCarrito();
  return (
    <div className="contenedor-ancho py-10">
      <Consulta
        consulta={consulta}
        esVacio={(carrito) => carrito.lineas.length === 0}
        vacio={
          <EstadoVacio
            icono={<HiOutlineShoppingBag />}
            titulo="Tu bolsa está vacía."
            descripcion="Agrega productos y aparecerán aquí."
            accion={<EnlaceBoton to="/tienda">Seguir comprando</EnlaceBoton>}
          />
        }
      >
        {(carrito) => (
          <>
            <h1 className="text-[40px] font-semibold">Revisa tu bolsa.</h1>
            <p className="mt-1 text-tinta-suave">Total {quetzales(carrito.resumen.Total)}</p>
            <div className="mt-8 grid gap-10 lg:grid-cols-[1fr_360px]">
              <ul className="divide-y divide-linea/70 border-y border-linea/70">
                {carrito.lineas.map((linea) => (
                  <Linea key={linea.IDVariante} linea={linea} />
                ))}
              </ul>
              <Resumen carrito={carrito} />
            </div>
          </>
        )}
      </Consulta>
    </div>
  );
}
