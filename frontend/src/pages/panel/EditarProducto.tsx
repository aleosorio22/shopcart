import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiPlus } from 'react-icons/hi2';
import { Link, useLocation, useParams } from 'react-router-dom';
import { mensajeDe } from '../../api/error';
import { FormularioProducto } from '../../components/panel/FormularioProducto';
import { GestorImagenes } from '../../components/panel/GestorImagenes';
import { Tarjeta } from '../../components/panel/Tarjeta';
import { Boton } from '../../components/ui/Boton';
import { Campo, Casilla } from '../../components/ui/Campo';
import { Consulta, EstadoCargando, EstadoVacio } from '../../components/ui/Estados';
import { Modal } from '../../components/ui/Modal';
import { useAuth } from '../../context/AuthContext';
import { atributosDe, catalogoService, type ProductoAdmin, type ValorAtributo, type VarianteTienda } from '../../services/catalogo.service';
import { fechaYHora, quetzales } from '../../utils/formato';

const SKU = /^[A-Za-z0-9-]{1,40}$/;

/** Agrega un valor nuevo (un color, una talla) al atributo sin salir del formulario de la variante. */
function NuevoValor({ idAtributo, nombre, alCrear }: { idAtributo: number; nombre: string; alCrear: (idValor: number) => void }) {
  const queryClient = useQueryClient();
  const [abierto, setAbierto] = useState(false);
  const [valor, setValor] = useState('');
  const [error, setError] = useState<string>();

  const crear = useMutation({
    mutationFn: () => catalogoService.agregarValorAtributo(idAtributo, valor.trim()),
    onSuccess: async ({ idValorAtributo }) => {
      await queryClient.invalidateQueries({ queryKey: ['atributos'] });
      toast.success(`${nombre} “${valor.trim()}” agregado`);
      alCrear(idValorAtributo);
      setValor('');
      setAbierto(false);
    },
    // VALOR_DUPLICADO llega cuando ya existe, aunque cambien mayusculas o acentos.
    onError: (fallo) => setError(mensajeDe(fallo)),
  });

  if (!abierto)
    return (
      <button type="button" onClick={() => setAbierto(true)} className="inline-flex items-center gap-1 rounded-full border border-dashed border-linea px-3.5 py-1.5 text-[14px] text-enlace hover:border-accion">
        <HiPlus aria-hidden /> Nuevo
      </button>
    );

  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex items-center gap-2">
        <input
          ref={(campo) => campo?.focus()}
          value={valor}
          maxLength={100}
          placeholder={`Nuevo valor de ${nombre.toLowerCase()}`}
          aria-label={`Nuevo valor de ${nombre}`}
          aria-invalid={Boolean(error)}
          onChange={(evento) => {
            setValor(evento.target.value);
            setError(undefined);
          }}
          onKeyDown={(evento) => {
            if (evento.key === 'Enter' && valor.trim()) {
              evento.preventDefault();
              crear.mutate();
            }
            if (evento.key === 'Escape') setAbierto(false);
          }}
          className="min-w-0 flex-1 rounded-full border border-linea px-3.5 py-1.5 text-[14px] outline-none focus:border-accion"
        />
        <Boton tamano="sm" disabled={!valor.trim()} cargando={crear.isPending} onClick={() => crear.mutate()}>
          Agregar
        </Boton>
        <Boton tamano="sm" variante="fantasma" onClick={() => setAbierto(false)}>
          Cancelar
        </Boton>
      </div>
      {error && (
        <p role="alert" className="px-3.5 text-[13px] text-peligro">
          {error}
        </p>
      )}
    </div>
  );
}

function FormularioVariante({ idProducto, variante, alTerminar }: { idProducto: number; variante?: VarianteTienda; alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const { data: atributos = [] } = useQuery({ queryKey: ['atributos'], queryFn: catalogoService.atributos, staleTime: Infinity });
  // Los atributos de la variante llegan por nombre: se traducen a sus IDs para editarlos.
  const actuales = variante
    ? atributosDe(variante).flatMap(({ Atributo, Valor }) => atributos.filter((valor) => valor.Atributo === Atributo && valor.Valor === Valor).map((valor) => valor.IDValorAtributo))
    : [];
  const [sku, setSku] = useState(variante?.SKU ?? '');
  const [precio, setPrecio] = useState('');
  const [seleccion, setSeleccion] = useState<number[] | null>(null);
  const [activo, setActivo] = useState(true);
  const valores = seleccion ?? actuales;
  const porAtributo = atributos.reduce<Record<string, ValorAtributo[]>>((grupos, valor) => ({ ...grupos, [valor.Atributo]: [...(grupos[valor.Atributo] ?? []), valor] }), {});

  const skuValido = SKU.test(sku.trim());
  const precioValido = variante !== undefined || (/^\d+(\.\d{1,2})?$/.test(precio) && Number(precio) > 0);

  const guardar = useMutation({
    mutationFn: () => {
      const datos = { sku: sku.trim(), activo, valoresAtributo: valores };
      return variante
        ? catalogoService.editarVariante(idProducto, variante.IDVariante, datos)
        : catalogoService.crearVariante(idProducto, { ...datos, precio: Number(precio) });
    },
    onSuccess: async () => {
      toast.success('Variante guardada');
      await queryClient.invalidateQueries({ queryKey: ['producto'] });
      alTerminar();
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="SKU" value={sku} onChange={(evento) => setSku(evento.target.value.toUpperCase())} error={sku && !skuValido ? 'Solo letras, números y guiones' : undefined} />
        {!variante && <Campo etiqueta="Precio (Q, IVA incluido)" type="number" min={0} step="0.01" value={precio} onChange={(evento) => setPrecio(evento.target.value)} error={precio && !precioValido ? 'Precio inválido' : undefined} />}
      </div>
      {Object.entries(porAtributo).map(([nombre, opciones]) => (
        <fieldset key={nombre}>
          <legend className="mb-2 text-[13px] font-medium text-tinta-suave">{nombre}</legend>
          <div className="flex flex-wrap gap-2">
            {opciones.map((opcion) => {
              const elegido = valores.includes(opcion.IDValorAtributo);
              return (
                <button
                  key={opcion.IDValorAtributo}
                  type="button"
                  aria-pressed={elegido}
                  onClick={() =>
                    // Un solo valor por atributo: elegir otro reemplaza al anterior.
                    setSeleccion([...valores.filter((id) => !opciones.some((otra) => otra.IDValorAtributo === id)), ...(elegido ? [] : [opcion.IDValorAtributo])])
                  }
                  className={`rounded-full px-3.5 py-1.5 text-[14px] ${elegido ? 'bg-tinta text-white' : 'bg-nube hover:bg-[#e8e8ed]'}`}
                >
                  {opcion.Valor}
                </button>
              );
            })}
            <NuevoValor
              idAtributo={opciones[0]!.IDAtributo}
              nombre={nombre}
              // El valor recien creado queda elegido, reemplazando al de su mismo atributo.
              alCrear={(idValor) => setSeleccion([...valores.filter((id) => !opciones.some((otra) => otra.IDValorAtributo === id)), idValor])}
            />
          </div>
        </fieldset>
      ))}
      {variante && <Casilla etiqueta="Activa (se puede vender)" checked={activo} onChange={(evento) => setActivo(evento.target.checked)} />}
      <Boton className="w-full" disabled={!skuValido || !precioValido} cargando={guardar.isPending} onClick={() => guardar.mutate()}>
        Guardar variante
      </Boton>
    </div>
  );
}

function CambioPrecio({ variante, alTerminar }: { variante: VarianteTienda; alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const [precio, setPrecio] = useState(String(variante.PrecioLista));
  const historial = useQuery({ queryKey: ['precios', variante.IDVariante], queryFn: () => catalogoService.historialPrecios(variante.IDVariante) });
  const valido = /^\d+(\.\d{1,2})?$/.test(precio) && Number(precio) > 0 && Number(precio) !== variante.PrecioLista;

  const cambiar = useMutation({
    mutationFn: () => catalogoService.cambiarPrecio(variante.IDVariante, Number(precio)),
    onSuccess: async () => {
      toast.success('Precio actualizado. Los pedidos anteriores conservan su precio.');
      await queryClient.invalidateQueries({ queryKey: ['producto'] });
      await queryClient.invalidateQueries({ queryKey: ['precios', variante.IDVariante] });
      alTerminar();
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-end gap-3">
        <div className="flex-1">
          <Campo etiqueta="Nuevo precio de lista (Q)" type="number" min={0} step="0.01" value={precio} onChange={(evento) => setPrecio(evento.target.value)} />
        </div>
        <Boton disabled={!valido} cargando={cambiar.isPending} onClick={() => cambiar.mutate()}>
          Aplicar
        </Boton>
      </div>
      <div>
        <h3 className="mb-2 font-semibold">Historial</h3>
        <Consulta consulta={historial} esVacio={(lista) => lista.length === 0}>
          {(lista) => (
            <ul className="divide-y divide-linea/70 text-[14px]">
              {lista.map((registro) => (
                <li key={registro.IDPrecioVariante} className="flex justify-between gap-4 py-2">
                  <span>
                    {fechaYHora(registro.VigenteDesde)}
                    <span className="block text-[12px] text-tinta-tenue">
                      {registro.VigenteHasta ? `hasta ${fechaYHora(registro.VigenteHasta)}` : 'vigente'} · {registro.CorreoUsuario}
                    </span>
                  </span>
                  <span className="font-medium">{quetzales(registro.Precio)}</span>
                </li>
              ))}
            </ul>
          )}
        </Consulta>
      </div>
    </div>
  );
}

type Dialogo = { tipo: 'variante'; variante?: VarianteTienda } | { tipo: 'precio'; variante: VarianteTienda } | null;

export default function EditarProducto() {
  const { id = '' } = useParams();
  const idProducto = Number(id);
  const { state } = useLocation() as { state: ProductoAdmin | null };
  const { tienePermiso } = useAuth();
  const queryClient = useQueryClient();
  const [dialogo, setDialogo] = useState<Dialogo>(null);
  // El detalle publico solo existe para productos activos; uno inactivo se edita con los datos del listado.
  const detalle = useQuery({ queryKey: ['producto', id], queryFn: () => catalogoService.detalle(idProducto), retry: false });

  const baja = useMutation({
    mutationFn: () => catalogoService.eliminarProducto(idProducto),
    onSuccess: async () => {
      toast.success('Producto dado de baja. Su historial se conserva.');
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      await queryClient.invalidateQueries({ queryKey: ['producto'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  if (detalle.isPending) return <EstadoCargando />;
  const producto = detalle.data?.producto;
  const inicial = producto
    ? { nombre: producto.Nombre, slug: producto.Slug, idCategoria: producto.IDCategoria, idMarca: producto.IDMarca, descripcion: producto.Descripcion, mesesGarantia: producto.MesesGarantia, activo: true }
    : state
      ? { nombre: state.Nombre, slug: state.Slug, idCategoria: state.IDCategoria, idMarca: state.IDMarca, activo: state.Activo }
      : null;

  if (!inicial)
    return <EstadoVacio titulo="Producto no disponible" descripcion="Si está inactivo, ábrelo desde el listado para reactivarlo." accion={<Link className="enlace" to="/panel/productos">Ir a productos</Link>} />;

  const variantes = detalle.data?.variantes ?? [];
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link to="/panel/productos" className="text-[14px] text-enlace hover:underline">
            ‹ Productos
          </Link>
          <h1 className="mt-1 text-[32px] font-semibold">{inicial.nombre}</h1>
        </div>
        <div className="flex gap-2">
          {producto && (
            <Link to={`/productos/${producto.Slug}`} className="rounded-full bg-nube px-5 py-2.5 text-[15px] hover:bg-[#e8e8ed]">
              Ver en tienda
            </Link>
          )}
          {producto && (
            <Boton variante="peligro" cargando={baja.isPending} onClick={() => baja.mutate()}>
              Dar de baja
            </Boton>
          )}
        </div>
      </div>

      <Tarjeta titulo="Información">
        <div className="rounded-2xl bg-white p-5">
          <FormularioProducto key={JSON.stringify(inicial)} idProducto={idProducto} inicial={inicial} alGuardar={() => undefined} />
        </div>
      </Tarjeta>

      <Tarjeta>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[17px] font-semibold">Variantes activas</h2>
          <Boton tamano="sm" icono={<HiPlus />} onClick={() => setDialogo({ tipo: 'variante' })}>
            Nueva variante
          </Boton>
        </div>
        {variantes.length === 0 ? (
          <EstadoVacio titulo="Sin variantes activas" descripcion="Crea una variante con su SKU y precio para poder venderlo." />
        ) : (
          <ul className="divide-y divide-linea/70 rounded-2xl bg-white">
            {variantes.map((variante) => (
              <li key={variante.IDVariante} className="flex flex-wrap items-center gap-4 p-4">
                <div className="min-w-40 flex-1">
                  <p className="font-medium">{variante.SKU}</p>
                  <p className="text-[13px] text-tinta-tenue">{atributosDe(variante).map((atributo) => `${atributo.Atributo}: ${atributo.Valor}`).join(' · ') || 'Sin atributos'}</p>
                </div>
                <span className="text-[14px] text-tinta-suave">{variante.Disponible} disponibles</span>
                <span className="w-28 text-right font-medium">{quetzales(variante.PrecioLista)}</span>
                <div className="flex gap-3 text-[14px]">
                  <button className="enlace" onClick={() => setDialogo({ tipo: 'variante', variante })}>
                    Editar
                  </button>
                  {tienePermiso('PRECIOS_GESTIONAR') && (
                    <button className="enlace" onClick={() => setDialogo({ tipo: 'precio', variante })}>
                      Precio
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Tarjeta>

      {detalle.data && (
        <Tarjeta titulo="Imágenes">
          <GestorImagenes idProducto={idProducto} nombreProducto={inicial.nombre} imagenes={detalle.data.imagenes} variantes={variantes} />
        </Tarjeta>
      )}

      <Modal abierto={dialogo?.tipo === 'variante'} alCerrar={() => setDialogo(null)} titulo={dialogo?.variante ? 'Editar variante' : 'Nueva variante'}>
        {dialogo?.tipo === 'variante' && <FormularioVariante idProducto={idProducto} variante={dialogo.variante} alTerminar={() => setDialogo(null)} />}
      </Modal>
      <Modal abierto={dialogo?.tipo === 'precio'} alCerrar={() => setDialogo(null)} titulo={`Precio de ${dialogo?.variante?.SKU ?? ''}`}>
        {dialogo?.tipo === 'precio' && <CambioPrecio variante={dialogo.variante} alTerminar={() => setDialogo(null)} />}
      </Modal>
    </div>
  );
}
