import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { useCategorias, useMarcas } from '../../hooks/useCatalogo';
import { catalogoService, type Categoria, type DatosProducto, type Marca } from '../../services/catalogo.service';
import { EstadoCargando } from '../ui/Estados';
import { aSlug } from '../../utils/formato';
import { mostrarErrorApi } from '../../utils/formularios';
import { Boton } from '../ui/Boton';
import { AreaTexto, Campo, Casilla, Selector } from '../ui/Campo';

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre').max(200),
  slug: z
    .string()
    .trim()
    .min(1, 'Escribe el slug')
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  idCategoria: z.coerce.number<string>().int().positive('Elige una categoría'),
  idMarca: z.string().transform((valor) => (valor ? Number(valor) : null)),
  descripcion: z
    .string()
    .max(10_000)
    .transform((valor) => valor.trim() || null),
  mesesGarantia: z.coerce.number<string>().int('Usa meses enteros').min(0).max(120, 'Máximo 120 meses'),
  codigoImpuesto: z.enum(['IVA', 'EXENTO']),
  activo: z.boolean(),
});
type Entrada = z.input<typeof esquema>;

interface Props {
  idProducto?: number;
  inicial?: Partial<DatosProducto>;
  alGuardar: (idProducto: number) => void;
}

/** Alta y edicion de producto. El precio no va aqui: pertenece a cada variante. */
/**
 * Los selects no controlados toman su valor inicial al montarse: el formulario espera
 * a tener categorias y marcas para que la opcion guardada aparezca seleccionada.
 */
export function FormularioProducto(props: Props) {
  const categorias = useCategorias();
  const marcas = useMarcas();
  if (categorias.isPending || marcas.isPending) return <EstadoCargando />;
  return <Formulario {...props} categorias={categorias.data ?? []} marcas={marcas.data ?? []} />;
}

function Formulario({ idProducto, inicial, alGuardar, categorias, marcas }: Props & { categorias: Categoria[]; marcas: Marca[] }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setValue, getValues, setError, formState } = useForm<Entrada, unknown, DatosProducto>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: inicial?.nombre ?? '',
      slug: inicial?.slug ?? '',
      idCategoria: String(inicial?.idCategoria ?? ''),
      idMarca: String(inicial?.idMarca ?? ''),
      descripcion: inicial?.descripcion ?? '',
      mesesGarantia: String(inicial?.mesesGarantia ?? 0),
      codigoImpuesto: inicial?.codigoImpuesto ?? 'IVA',
      activo: inicial?.activo ?? true,
    },
  });
  const errores = formState.errors;

  const guardar = useMutation({
    mutationFn: (datos: DatosProducto) => (idProducto ? catalogoService.editarProducto(idProducto, datos) : catalogoService.crearProducto(datos)),
    onSuccess: async ({ idProducto: id }) => {
      toast.success('Producto guardado');
      await queryClient.invalidateQueries({ queryKey: ['productos'] });
      await queryClient.invalidateQueries({ queryKey: ['producto'] });
      alGuardar(id);
    },
    onError: (error) => mostrarErrorApi(error, setError),
  });

  return (
    <form noValidate onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="grid gap-4 sm:grid-cols-2">
      <Campo
        etiqueta="Nombre"
        {...register('nombre', {
          // Mientras se crea, el slug se propone a partir del nombre.
          onChange: (evento: { target: { value: string } }) => {
            if (!idProducto && !formState.dirtyFields.slug) setValue('slug', aSlug(evento.target.value));
          },
        })}
        error={errores.nombre?.message}
      />
      <Campo etiqueta="Slug (URL)" {...register('slug')} onBlur={() => setValue('slug', aSlug(getValues('slug')))} error={errores.slug?.message} />
      <Selector etiqueta="Categoría" {...register('idCategoria')} error={errores.idCategoria?.message}>
        <option value="">Elige una</option>
        {categorias.map((categoria) => (
          <option key={categoria.IDCategoria} value={categoria.IDCategoria}>
            {categoria.IDCategoriaPadre ? `· ${categoria.Nombre}` : categoria.Nombre}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Marca" {...register('idMarca')}>
        <option value="">Sin marca</option>
        {marcas.map((marca) => (
          <option key={marca.IDMarca} value={marca.IDMarca}>
            {marca.Nombre}
          </option>
        ))}
      </Selector>
      <Campo etiqueta="Garantía (meses)" type="number" min={0} max={120} {...register('mesesGarantia')} error={errores.mesesGarantia?.message} />
      <Selector etiqueta="Impuesto" {...register('codigoImpuesto')}>
        <option value="IVA">IVA 12 % incluido</option>
        <option value="EXENTO">Exento</option>
      </Selector>
      <div className="sm:col-span-2">
        <AreaTexto etiqueta="Descripción" rows={4} {...register('descripcion')} error={errores.descripcion?.message} />
      </div>
      <Casilla etiqueta="Visible en la tienda" {...register('activo')} />
      <Boton type="submit" className="sm:col-span-2" cargando={guardar.isPending}>
        {idProducto ? 'Guardar cambios' : 'Crear producto'}
      </Boton>
    </form>
  );
}
