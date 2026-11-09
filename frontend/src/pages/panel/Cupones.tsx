import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { HiPlus } from 'react-icons/hi2';
import { z } from 'zod';
import { mensajeDe } from '../../api/error';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { Boton } from '../../components/ui/Boton';
import { Campo, Casilla, Selector } from '../../components/ui/Campo';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useCategorias } from '../../hooks/useCatalogo';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import type { Categoria } from '../../services/catalogo.service';
import { cuponesService, type Cupon, type DatosCupon } from '../../services/cupones.service';
import { EstadoCargando } from '../../components/ui/Estados';
import { fecha, quetzales } from '../../utils/formato';
import { mostrarErrorApi } from '../../utils/formularios';

const opcionalPositivo = z.string().transform((valor, ctx) => {
  if (!valor) return null;
  const numero = Number(valor);
  if (!(numero > 0)) ctx.addIssue({ code: 'custom', message: 'Debe ser mayor que cero' });
  return numero;
});
const aLocal = (iso: string) => {
  const fechaBase = new Date(iso);
  return new Date(fechaBase.getTime() - fechaBase.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
};

const esquema = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,40}$/, 'De 3 a 40 letras, números, guiones'),
    descripcion: z.string().max(200).transform((valor) => valor.trim() || null),
    tipoDescuento: z.enum(['PORCENTAJE', 'MONTO']),
    valor: z.coerce.number<string>().positive('Debe ser mayor que cero').multipleOf(0.01, 'Máximo dos decimales'),
    descuentoMaximo: opcionalPositivo,
    montoMinimo: z.coerce.number<string>().min(0, 'No puede ser negativo'),
    vigenteDesde: z.string().min(1, 'Indica el inicio'),
    vigenteHasta: z.string().min(1, 'Indica el fin'),
    limiteTotal: opcionalPositivo,
    limitePorCliente: z.coerce.number<string>().int('Usa un entero').positive('Mínimo 1'),
    idCategoria: z.string().transform((valor) => (valor ? Number(valor) : null)),
    activo: z.boolean(),
  })
  .refine((datos) => datos.tipoDescuento !== 'PORCENTAJE' || datos.valor <= 100, { path: ['valor'], message: 'Un porcentaje no puede superar 100' })
  .refine((datos) => datos.vigenteDesde < datos.vigenteHasta, { path: ['vigenteHasta'], message: 'Debe ser posterior al inicio' })
  .transform((datos): DatosCupon => ({ ...datos, vigenteDesde: new Date(datos.vigenteDesde).toISOString(), vigenteHasta: new Date(datos.vigenteHasta).toISOString() }));
type Entrada = z.input<typeof esquema>;

function FormularioCupon(props: { cupon?: Cupon; alTerminar: () => void }) {
  const categorias = useCategorias();
  if (categorias.isPending) return <EstadoCargando />;
  return <Formulario {...props} categorias={categorias.data ?? []} />;
}

function Formulario({ cupon, alTerminar, categorias }: { cupon?: Cupon; alTerminar: () => void; categorias: Categoria[] }) {
  const queryClient = useQueryClient();
  const [ahora] = useState(() => new Date().toISOString());
  const { register, handleSubmit, control, setError, formState } = useForm<Entrada, unknown, DatosCupon>({
    resolver: zodResolver(esquema),
    defaultValues: {
      codigo: cupon?.Codigo ?? '',
      descripcion: cupon?.Descripcion ?? '',
      tipoDescuento: cupon?.TipoDescuento ?? 'PORCENTAJE',
      valor: String(cupon?.Valor ?? ''),
      descuentoMaximo: cupon?.DescuentoMaximo ? String(cupon.DescuentoMaximo) : '',
      montoMinimo: String(cupon?.MontoMinimo ?? 0),
      vigenteDesde: aLocal(cupon?.VigenteDesde ?? ahora),
      vigenteHasta: cupon ? aLocal(cupon.VigenteHasta) : '',
      limiteTotal: cupon?.LimiteTotal ? String(cupon.LimiteTotal) : '',
      limitePorCliente: String(cupon?.LimitePorCliente ?? 1),
      idCategoria: cupon?.IDCategoria ? String(cupon.IDCategoria) : '',
      activo: cupon?.Activo ?? true,
    },
  });
  const tipo = useWatch({ control, name: 'tipoDescuento' });
  const errores = formState.errors;

  const guardar = useMutation({
    mutationFn: async (datos: DatosCupon) => {
      if (cupon) await cuponesService.editar(cupon.IDCupon, datos);
      else await cuponesService.crear(datos);
    },
    onSuccess: async () => {
      toast.success('Cupón guardado');
      await queryClient.invalidateQueries({ queryKey: ['cupones'] });
      alTerminar();
    },
    onError: (error) => mostrarErrorApi(error, setError),
  });

  return (
    <form noValidate onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Código" className="uppercase" {...register('codigo')} error={errores.codigo?.message} />
      <Campo etiqueta="Descripción (opcional)" {...register('descripcion')} error={errores.descripcion?.message} />
      <Selector etiqueta="Tipo" {...register('tipoDescuento')}>
        <option value="PORCENTAJE">Porcentaje</option>
        <option value="MONTO">Monto fijo</option>
      </Selector>
      <Campo etiqueta={tipo === 'PORCENTAJE' ? 'Porcentaje (%)' : 'Monto (Q)'} type="number" step="0.01" min={0} {...register('valor')} error={errores.valor?.message} />
      <Campo etiqueta="Descuento máximo (Q, opcional)" type="number" step="0.01" min={0} {...register('descuentoMaximo')} error={errores.descuentoMaximo?.message} />
      <Campo etiqueta="Compra mínima (Q)" type="number" step="0.01" min={0} {...register('montoMinimo')} error={errores.montoMinimo?.message} />
      <Campo etiqueta="Vigente desde" type="datetime-local" {...register('vigenteDesde')} error={errores.vigenteDesde?.message} />
      <Campo etiqueta="Vigente hasta" type="datetime-local" {...register('vigenteHasta')} error={errores.vigenteHasta?.message} />
      <Campo etiqueta="Usos totales (vacío = sin límite)" type="number" min={1} {...register('limiteTotal')} error={errores.limiteTotal?.message} />
      <Campo etiqueta="Usos por cliente" type="number" min={1} {...register('limitePorCliente')} error={errores.limitePorCliente?.message} />
      <Selector etiqueta="Aplica a" {...register('idCategoria')}>
        <option value="">Todo el carrito</option>
        {categorias.map((categoria) => (
          <option key={categoria.IDCategoria} value={categoria.IDCategoria}>
            Solo {categoria.Nombre}
          </option>
        ))}
      </Selector>
      <div className="flex items-end pb-2">
        <Casilla etiqueta="Activo" {...register('activo')} />
      </div>
      <Boton type="submit" className="sm:col-span-2" cargando={guardar.isPending}>
        {cupon ? 'Guardar cambios' : 'Crear cupón'}
      </Boton>
    </form>
  );
}

export default function Cupones() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ activo: undefined as string | undefined });
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Cupon | 'nuevo' | null>(null);
  const filtro = { pagina, tamanoPagina: 15, activo: valores.activo ? valores.activo === 'true' : undefined };
  const consulta = useQuery({ queryKey: ['cupones', filtro], queryFn: () => cuponesService.listar(filtro), placeholderData: keepPreviousData });

  const desactivar = useMutation({
    mutationFn: cuponesService.desactivar,
    onSuccess: async () => {
      toast.success('Cupón desactivado');
      await queryClient.invalidateQueries({ queryKey: ['cupones'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  const columnas: Columna<Cupon>[] = [
    {
      titulo: 'Código',
      celda: (cupon) => (
        <div>
          <p className="font-medium">{cupon.Codigo}</p>
          <p className="text-[12px] text-tinta-tenue">{cupon.Descripcion}</p>
        </div>
      ),
    },
    { titulo: 'Descuento', celda: (cupon) => (cupon.TipoDescuento === 'PORCENTAJE' ? `${cupon.Valor} %` : quetzales(cupon.Valor)) },
    { titulo: 'Vigencia', celda: (cupon) => `${fecha(cupon.VigenteDesde)} – ${fecha(cupon.VigenteHasta)}`, secundaria: true },
    { titulo: 'Usos', celda: (cupon) => `${cupon.UsosActuales} / ${cupon.LimiteTotal ?? '∞'}`, alinear: 'derecha', secundaria: true },
    {
      titulo: 'Estado',
      celda: (cupon) => {
        const vencido = new Date(cupon.VigenteHasta) < new Date();
        return !cupon.Activo ? <Insignia>Inactivo</Insignia> : vencido ? <Insignia tono="alerta">Vencido</Insignia> : <Insignia tono="exito">Activo</Insignia>;
      },
    },
    {
      titulo: 'Acciones',
      alinear: 'derecha',
      celda: (cupon) => (
        <div className="flex justify-end gap-3 text-[14px]">
          <button className="enlace" onClick={() => setEditando(cupon)}>
            Editar
          </button>
          {cupon.Activo && (
            <button className="text-peligro hover:underline" disabled={desactivar.isPending} onClick={() => desactivar.mutate(cupon.IDCupon)}>
              Desactivar
            </button>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Encabezado
        titulo="Cupones"
        descripcion="Descuentos con vigencia, compra mínima y límites de uso."
        acciones={
          <Boton icono={<HiPlus />} onClick={() => setEditando('nuevo')}>
            Nuevo cupón
          </Boton>
        }
      />
      <BarraFiltros>
        <Selector etiqueta="Estado" value={valores.activo ?? ''} onChange={(evento) => actualizar({ activo: evento.target.value })}>
          <option value="">Todos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Selector>
      </BarraFiltros>
      <TablaDatos columnas={columnas} consulta={consulta} claveFila={(cupon) => cupon.IDCupon} alCambiarPagina={irAPagina} />
      <Modal abierto={editando !== null} alCerrar={() => setEditando(null)} titulo={editando === 'nuevo' ? 'Nuevo cupón' : 'Editar cupón'} ancho="lg">
        {editando !== null && <FormularioCupon cupon={editando === 'nuevo' ? undefined : editando} alTerminar={() => setEditando(null)} />}
      </Modal>
    </>
  );
}
