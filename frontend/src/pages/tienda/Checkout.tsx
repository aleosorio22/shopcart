import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineBuildingStorefront, HiOutlineClock, HiOutlineHome, HiPlus } from 'react-icons/hi2';
import { Navigate, useNavigate } from 'react-router-dom';
import { ApiError } from '../../api/error';
import { FormularioDireccion } from '../../components/tienda/FormularioDireccion';
import { Boton, EnlaceBoton } from '../../components/ui/Boton';
import { Campo } from '../../components/ui/Campo';
import { Consulta, EstadoCargando, EstadoVacio } from '../../components/ui/Estados';
import { Modal } from '../../components/ui/Modal';
import { CLAVE_CARRITO, useCarrito } from '../../hooks/useCarrito';
import { useDirecciones } from '../../hooks/useDirecciones';
import { useLlaveIdempotencia } from '../../hooks/useLlaveIdempotencia';
import { checkoutService, type Checkout as CheckoutActivo, type DatosInicio } from '../../services/checkout.service';
import { quetzales } from '../../utils/formato';

const ID_METODO_TARJETA = 1;
const NIT_VALIDO = /^(CF|\d{1,14}[0-9Kk]?)$/;

type Modo = 'DOMICILIO' | 'RECOGER';

function Opcion({ activa, onClick, children }: { activa: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={activa}
      onClick={onClick}
      className={`w-full rounded-2xl border-2 p-4 text-left transition-colors ${activa ? 'border-accion' : 'border-linea hover:border-tinta-tenue'}`}
    >
      {children}
    </button>
  );
}

/** Paso 1: entrega. Elige domicilio o tienda y congela precios y existencia por 15 minutos. */
function PasoEntrega({ alIniciar }: { alIniciar: (checkout: CheckoutActivo) => void }) {
  const [modo, setModo] = useState<Modo>('DOMICILIO');
  const [idDireccion, setIdDireccion] = useState<number>();
  const [idSucursal, setIdSucursal] = useState<number>();
  const [agregando, setAgregando] = useState(false);
  const llave = useLlaveIdempotencia();
  const direcciones = useDirecciones();
  const sucursales = useQuery({ queryKey: ['sucursales', 'recoger'], queryFn: () => checkoutService.sucursales() });

  const direccionElegida = idDireccion ?? direcciones.data?.find((direccion) => direccion.EsPredeterminada)?.IDDireccion ?? direcciones.data?.[0]?.IDDireccion;
  const envios = useQuery({ queryKey: ['envios', direccionElegida], queryFn: () => checkoutService.envios(direccionElegida) });
  const metodo = envios.data?.find((opcion) => (modo === 'RECOGER' ? opcion.EsRecogerEnTienda : !opcion.EsRecogerEnTienda));

  const iniciar = useMutation({
    mutationFn: (datos: DatosInicio) => checkoutService.iniciar(datos, llave.actual()),
    onSuccess: (checkout) => {
      llave.renovar();
      alIniciar(checkout);
    },
    onError: (error) => {
      llave.renovar();
      toast.error(ApiError.desde(error).message);
    },
  });

  const listo = metodo && (modo === 'DOMICILIO' ? Boolean(direccionElegida) : Boolean(idSucursal));
  const continuar = () => {
    if (!metodo) return;
    iniciar.mutate(
      modo === 'DOMICILIO'
        ? { idMetodoEnvio: metodo.IDMetodoEnvio, idDireccion: direccionElegida }
        : { idMetodoEnvio: metodo.IDMetodoEnvio, idSucursalRecoger: idSucursal },
    );
  };

  return (
    <section className="space-y-8">
      <div>
        <h2 className="mb-4 text-[24px] font-semibold">¿Cómo quieres recibir tu pedido?</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Opcion activa={modo === 'DOMICILIO'} onClick={() => setModo('DOMICILIO')}>
            <HiOutlineHome className="mb-2 text-2xl" aria-hidden />
            <p className="font-semibold">Envío a domicilio</p>
            <p className="text-[14px] text-tinta-suave">Gratis desde Q1,000.</p>
          </Opcion>
          <Opcion activa={modo === 'RECOGER'} onClick={() => setModo('RECOGER')}>
            <HiOutlineBuildingStorefront className="mb-2 text-2xl" aria-hidden />
            <p className="font-semibold">Recoger en tienda</p>
            <p className="text-[14px] text-tinta-suave">Sin costo.</p>
          </Opcion>
        </div>
      </div>

      {modo === 'DOMICILIO' ? (
        <div>
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-[19px] font-semibold">Dirección de entrega</h3>
            <Boton variante="fantasma" tamano="sm" icono={<HiPlus />} onClick={() => setAgregando(true)}>
              Nueva dirección
            </Boton>
          </div>
          <Consulta
            consulta={direcciones}
            esVacio={(lista) => lista.length === 0}
            vacio={<EstadoVacio titulo="Aún no tienes direcciones" accion={<Boton onClick={() => setAgregando(true)}>Agregar dirección</Boton>} />}
          >
            {(lista) => (
              <div className="grid gap-3">
                {lista.map((direccion) => (
                  <Opcion key={direccion.IDDireccion} activa={direccion.IDDireccion === direccionElegida} onClick={() => setIdDireccion(direccion.IDDireccion)}>
                    <p className="font-semibold">{direccion.Alias}</p>
                    <p className="text-[14px] text-tinta-suave">
                      {direccion.Destinatario} · {direccion.Linea1}, {direccion.Municipio}, {direccion.Departamento}
                    </p>
                  </Opcion>
                ))}
              </div>
            )}
          </Consulta>
          {metodo && direccionElegida && (
            <p className="mt-3 text-[14px] text-tinta-suave">
              {metodo.Nombre}: {metodo.Costo ? quetzales(metodo.Costo) : 'gratis'}
              {metodo.MontoEnvioGratis ? ` (gratis desde ${quetzales(metodo.MontoEnvioGratis)})` : ''}
              {metodo.DiasEstimados ? ` · llega en ${metodo.DiasEstimados} día(s) hábil(es)` : ''}
            </p>
          )}
          {envios.isSuccess && !metodo && direccionElegida && <p className="mt-3 text-[14px] text-peligro">No hay envío disponible a esta dirección.</p>}
        </div>
      ) : (
        <div>
          <h3 className="mb-3 text-[19px] font-semibold">Elige la tienda</h3>
          <Consulta consulta={sucursales} esVacio={(lista) => lista.length === 0} vacio={<EstadoVacio titulo="No hay tiendas disponibles para recoger" />}>
            {(lista) => (
              <div className="grid gap-3">
                {lista.map((sucursal) => (
                  <Opcion key={sucursal.IDSucursal} activa={sucursal.IDSucursal === idSucursal} onClick={() => setIdSucursal(sucursal.IDSucursal)}>
                    <p className="font-semibold">{sucursal.Nombre}</p>
                    <p className="text-[14px] text-tinta-suave">
                      {sucursal.Direccion}, {sucursal.Municipio} · {sucursal.Horario}
                    </p>
                  </Opcion>
                ))}
              </div>
            )}
          </Consulta>
          <p className="mt-3 text-[13px] text-tinta-tenue">Todo tu pedido debe estar disponible en la misma tienda.</p>
        </div>
      )}

      <Boton tamano="lg" className="w-full" disabled={!listo} cargando={iniciar.isPending} onClick={continuar}>
        Continuar al pago
      </Boton>

      <Modal abierto={agregando} alCerrar={() => setAgregando(false)} titulo="Nueva dirección" ancho="lg">
        <FormularioDireccion
          alGuardar={(id) => {
            setAgregando(false);
            if (id) setIdDireccion(id);
          }}
        />
      </Modal>
    </section>
  );
}

function useSegundosRestantes(expiraEn: string) {
  const calcular = () => Math.max(0, Math.floor((new Date(expiraEn).getTime() - Date.now()) / 1000));
  const [segundos, setSegundos] = useState(calcular);
  useEffect(() => {
    const intervalo = setInterval(() => setSegundos(calcular), 1000);
    return () => clearInterval(intervalo);
    // calcular solo depende de expiraEn.
    // eslint-disable-next-line react/exhaustive-deps
  }, [expiraEn]);
  return segundos;
}

/** Paso 2: pago. La llave de idempotencia evita un segundo cobro si se pulsa dos veces. */
function PasoPago({ checkout, alCancelar }: { checkout: CheckoutActivo; alCancelar: () => void }) {
  const queryClient = useQueryClient();
  const navegar = useNavigate();
  const llave = useLlaveIdempotencia();
  const segundos = useSegundosRestantes(checkout.ExpiraEn);
  const [nit, setNit] = useState('CF');
  const [nombre, setNombre] = useState('');
  const [tarjeta, setTarjeta] = useState<'tok_visa' | 'tok_rechazada'>('tok_visa');
  const [errorPago, setErrorPago] = useState<string>();
  const nitValido = NIT_VALIDO.test(nit.trim().toUpperCase());

  const pagar = useMutation({
    mutationFn: () =>
      checkoutService.pagar(
        checkout.IDCheckout,
        { idMetodoPago: ID_METODO_TARJETA, tokenPago: tarjeta, nitFactura: nit.trim().toUpperCase(), nombreFactura: nombre.trim() || undefined },
        llave.actual(),
      ),
    onSuccess: async (pedido) => {
      await queryClient.invalidateQueries({ queryKey: CLAVE_CARRITO });
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      navegar(`/cuenta/pedidos/${pedido.IDPedido}?nuevo=1`, { replace: true });
    },
    onError: (error) => {
      // Un rechazo o un error de red termina este intento: el siguiente usa una llave nueva.
      llave.renovar();
      setErrorPago(ApiError.desde(error).message);
    },
  });

  const cancelar = useMutation({ mutationFn: () => checkoutService.cancelar(checkout.IDCheckout), onSettled: alCancelar });

  if (segundos === 0 && !pagar.isPending)
    return (
      <EstadoVacio
        icono={<HiOutlineClock />}
        titulo="Tu reserva expiró"
        descripcion="Liberamos los productos para otros clientes. Vuelve a la bolsa para intentarlo de nuevo."
        accion={<EnlaceBoton to="/bolsa">Volver a la bolsa</EnlaceBoton>}
      />
    );

  const minutos = String(Math.floor(segundos / 60)).padStart(2, '0');
  const resto = String(segundos % 60).padStart(2, '0');

  return (
    <section className="space-y-6">
      <div className="flex items-center gap-2 rounded-2xl bg-alerta/5 px-4 py-3 text-[14px] text-alerta" role="timer" aria-live="off">
        <HiOutlineClock aria-hidden />
        Apartamos tus productos y precios por {minutos}:{resto} minutos.
      </div>

      <div>
        <h2 className="mb-4 text-[24px] font-semibold">Facturación</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="NIT" value={nit} onChange={(evento) => setNit(evento.target.value)} error={nitValido ? undefined : 'Escribe CF o un NIT válido'} />
          <Campo etiqueta="Nombre en la factura (opcional)" value={nombre} onChange={(evento) => setNombre(evento.target.value)} maxLength={200} />
        </div>
      </div>

      <div>
        <h2 className="mb-1 text-[24px] font-semibold">Pago</h2>
        <p className="mb-4 text-[14px] text-tinta-suave">
          Entorno de demostración: la pasarela es simulada y nunca se piden datos reales de tarjeta.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <Opcion activa={tarjeta === 'tok_visa'} onClick={() => setTarjeta('tok_visa')}>
            <p className="font-semibold">Tarjeta de prueba</p>
            <p className="text-[14px] text-tinta-suave">El cobro se aprueba.</p>
          </Opcion>
          <Opcion activa={tarjeta === 'tok_rechazada'} onClick={() => setTarjeta('tok_rechazada')}>
            <p className="font-semibold">Tarjeta rechazada</p>
            <p className="text-[14px] text-tinta-suave">Para probar un rechazo y reintentar.</p>
          </Opcion>
        </div>
      </div>

      {errorPago && (
        <p role="alert" className="rounded-2xl bg-peligro/5 px-4 py-3 text-[14px] text-peligro">
          {errorPago} Puedes intentarlo de nuevo mientras dure la reserva.
        </p>
      )}

      <div className="flex flex-col gap-3 sm:flex-row-reverse">
        <Boton
          tamano="lg"
          className="flex-1"
          disabled={!nitValido}
          cargando={pagar.isPending}
          onClick={() => {
            setErrorPago(undefined);
            pagar.mutate();
          }}
        >
          Pagar {quetzales(checkout.Total)}
        </Boton>
        <Boton variante="secundario" tamano="lg" cargando={cancelar.isPending} disabled={pagar.isPending} onClick={() => cancelar.mutate()}>
          Cambiar entrega
        </Boton>
      </div>
    </section>
  );
}

function ResumenCheckout({ checkout }: { checkout?: CheckoutActivo }) {
  const { data: carrito } = useCarrito();
  if (!carrito) return null;
  const filas: [string, number, string?][] = checkout
    ? [
        ['Subtotal', checkout.Subtotal],
        ['Descuento', -checkout.DescuentoCupon, 'text-exito'],
        ['Envío', checkout.CostoEnvio],
      ]
    : [
        ['Subtotal', carrito.resumen.Subtotal],
        ['Descuento', -carrito.resumen.Descuento, 'text-exito'],
      ];
  return (
    <aside className="h-fit space-y-4 rounded-3xl bg-nube p-6 lg:sticky lg:top-20">
      <h2 className="text-[19px] font-semibold">Tu pedido</h2>
      <ul className="space-y-2 text-[14px]">
        {carrito.lineas.map((linea) => (
          <li key={linea.IDVariante} className="flex justify-between gap-4">
            <span className="text-tinta-suave">
              {linea.Cantidad} × {linea.NombreProducto}
            </span>
            <span>{quetzales(linea.Subtotal)}</span>
          </li>
        ))}
      </ul>
      <dl className="space-y-2 border-t border-linea pt-4 text-[15px]">
        {filas
          .filter(([etiqueta, valor]) => valor !== 0 || etiqueta !== 'Descuento')
          .map(([etiqueta, valor, clase]) => (
            <div key={etiqueta} className={`flex justify-between ${clase ?? ''}`}>
              <dt className={clase ? '' : 'text-tinta-suave'}>{etiqueta}</dt>
              <dd>{valor < 0 ? `−${quetzales(-valor)}` : quetzales(valor)}</dd>
            </div>
          ))}
        <div className="flex justify-between border-t border-linea pt-3 text-[21px] font-semibold">
          <dt>Total</dt>
          <dd>{quetzales(checkout?.Total ?? carrito.resumen.Total)}</dd>
        </div>
        <p className="text-[12px] text-tinta-tenue">{checkout ? 'Precios congelados. ' : ''}IVA del 12 % incluido.</p>
      </dl>
    </aside>
  );
}

export default function Checkout() {
  const carrito = useCarrito();
  const [checkout, setCheckout] = useState<CheckoutActivo>();

  if (carrito.isPending) return <EstadoCargando />;
  if (!checkout && carrito.data && carrito.data.lineas.length === 0) return <Navigate to="/bolsa" replace />;

  return (
    <div className="contenedor-ancho py-10">
      <ol className="mb-6 flex gap-2 text-[13px] text-tinta-tenue" aria-label="Pasos">
        <li className={checkout ? '' : 'font-medium text-tinta'}>1. Entrega</li>
        <li aria-hidden>›</li>
        <li className={checkout ? 'font-medium text-tinta' : ''}>2. Pago</li>
      </ol>
      <h1 className="mb-8 text-[40px] font-semibold">{checkout ? 'Paga tu pedido.' : 'Finaliza tu compra.'}</h1>
      <div className="grid gap-10 lg:grid-cols-[1fr_360px]">
        {checkout ? <PasoPago checkout={checkout} alCancelar={() => setCheckout(undefined)} /> : <PasoEntrega alIniciar={setCheckout} />}
        <ResumenCheckout checkout={checkout} />
      </div>
    </div>
  );
}
