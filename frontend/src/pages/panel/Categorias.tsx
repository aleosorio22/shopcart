import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { HiPlus } from 'react-icons/hi2';
import { z } from 'zod';
import { mensajeDe } from '../../api/error';
import { Encabezado } from '../../components/panel/Encabezado';
import { Boton } from '../../components/ui/Boton';
import { AreaTexto, Campo, Casilla, Selector } from '../../components/ui/Campo';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { catalogoService, type Categoria, type DatosCategoria } from '../../services/catalogo.service';
import { aSlug } from '../../utils/formato';
import { mostrarErrorApi } from '../../utils/formularios';

const CLAVE = ['categorias', 'admin'] as const;

const esquema = z.object({
  nombre: z.string().trim().min(1, 'Escribe el nombre').max(100),
  slug: z
    .string()
    .trim()
    .min(1, 'Escribe el slug')
    .max(120)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minúsculas, números y guiones'),
  idCategoriaPadre: z.string().transform((valor) => (valor ? Number(valor) : null)),
  descripcion: z
    .string()
    .max(500)
    .transform((valor) => valor.trim() || null),
  orden: z.coerce.number<string>().int('Usa un entero').min(0).max(32767),
  activo: z.boolean(),
});
type Entrada = z.input<typeof esquema>;

/** Una categoria no puede colgar de si misma ni de sus descendientes: se excluyen de la lista de padres. */
function descendientes(id: number, todas: Categoria[]): Set<number> {
  const resultado = new Set([id]);
  let cambio = true;
  while (cambio) {
    cambio = false;
    for (const categoria of todas) {
      if (categoria.IDCategoriaPadre !== null && resultado.has(categoria.IDCategoriaPadre) && !resultado.has(categoria.IDCategoria)) {
        resultado.add(categoria.IDCategoria);
        cambio = true;
      }
    }
  }
  return resultado;
}

function FormularioCategoria({ categoria, todas, alTerminar }: { categoria?: Categoria; todas: Categoria[]; alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const excluidas = categoria ? descendientes(categoria.IDCategoria, todas) : new Set<number>();
  const { register, handleSubmit, setValue, getValues, setError, formState } = useForm<Entrada, unknown, DatosCategoria>({
    resolver: zodResolver(esquema),
    defaultValues: {
      nombre: categoria?.Nombre ?? '',
      slug: categoria?.Slug ?? '',
      idCategoriaPadre: categoria?.IDCategoriaPadre ? String(categoria.IDCategoriaPadre) : '',
      descripcion: categoria?.Descripcion ?? '',
      orden: String(categoria?.Orden ?? 0),
      activo: categoria?.Activo ?? true,
    },
  });
  const errores = formState.errors;

  const guardar = useMutation({
    mutationFn: (datos: DatosCategoria) => (categoria ? catalogoService.editarCategoria(categoria.IDCategoria, datos) : catalogoService.crearCategoria(datos)),
    onSuccess: async () => {
      toast.success('Categoría guardada');
      await queryClient.invalidateQueries({ queryKey: ['categorias'] });
      alTerminar();
    },
    onError: (error) => mostrarErrorApi(error, setError),
  });

  return (
    <form noValidate onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="grid gap-4 sm:grid-cols-2">
      <Campo
        etiqueta="Nombre"
        {...register('nombre', {
          onChange: (evento: { target: { value: string } }) => {
            if (!categoria && !formState.dirtyFields.slug) setValue('slug', aSlug(evento.target.value));
          },
        })}
        error={errores.nombre?.message}
      />
      <Campo etiqueta="Slug (URL)" {...register('slug')} onBlur={() => setValue('slug', aSlug(getValues('slug')))} error={errores.slug?.message} />
      <Selector etiqueta="Categoría padre" {...register('idCategoriaPadre')}>
        <option value="">Ninguna (categoría principal)</option>
        {todas
          .filter((opcion) => !excluidas.has(opcion.IDCategoria))
          .map((opcion) => (
            <option key={opcion.IDCategoria} value={opcion.IDCategoria}>
              {opcion.IDCategoriaPadre ? `· ${opcion.Nombre}` : opcion.Nombre}
            </option>
          ))}
      </Selector>
      <Campo etiqueta="Orden en el menú" type="number" min={0} {...register('orden')} error={errores.orden?.message} />
      <div className="sm:col-span-2">
        <AreaTexto etiqueta="Descripción (opcional)" {...register('descripcion')} error={errores.descripcion?.message} />
      </div>
      <Casilla etiqueta="Visible en la tienda" {...register('activo')} />
      <Boton type="submit" className="sm:col-span-2" cargando={guardar.isPending}>
        {categoria ? 'Guardar cambios' : 'Crear categoría'}
      </Boton>
    </form>
  );
}

export default function Categorias() {
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: CLAVE, queryFn: () => catalogoService.categorias(true) });
  const [editando, setEditando] = useState<Categoria | 'nueva' | null>(null);

  const eliminar = useMutation({
    mutationFn: catalogoService.eliminarCategoria,
    // Con productos, subcategorias o cupones asociados el backend la desactiva en lugar de borrarla.
    onSuccess: async ({ resultado }) => {
      toast.success(resultado === 'ELIMINADA' ? 'Categoría eliminada' : 'Tiene productos o subcategorías: se desactivó');
      await queryClient.invalidateQueries({ queryKey: ['categorias'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  // Arbol plano: cada raiz seguida de sus hijas, en el orden del menu.
  const ordenar = (lista: Categoria[]) => {
    const porOrden = (a: Categoria, b: Categoria) => a.Orden - b.Orden || a.Nombre.localeCompare(b.Nombre);
    const resultado: { categoria: Categoria; nivel: number }[] = [];
    const agregar = (padre: number | null, nivel: number) => {
      for (const categoria of lista.filter((item) => item.IDCategoriaPadre === padre).sort(porOrden)) {
        resultado.push({ categoria, nivel });
        agregar(categoria.IDCategoria, nivel + 1);
      }
    };
    agregar(null, 0);
    return resultado;
  };

  return (
    <>
      <Encabezado
        titulo="Categorías"
        descripcion="Árbol del catálogo y orden del menú de la tienda."
        acciones={
          <Boton icono={<HiPlus />} onClick={() => setEditando('nueva')}>
            Nueva categoría
          </Boton>
        }
      />
      <Consulta consulta={consulta} esVacio={(lista) => lista.length === 0} vacio={<EstadoVacio titulo="Aún no hay categorías" />}>
        {(lista) => (
          <ul className="divide-y divide-linea/70 rounded-2xl border border-linea/70">
            {ordenar(lista).map(({ categoria, nivel }) => (
              <li key={categoria.IDCategoria} className="flex flex-wrap items-center gap-3 px-4 py-3 text-[14px]" style={{ paddingLeft: `${16 + nivel * 28}px` }}>
                <div className="min-w-40 flex-1">
                  <p className="font-medium">
                    {nivel > 0 && <span className="mr-1 text-tinta-tenue">└</span>}
                    {categoria.Nombre}
                  </p>
                  <p className="text-[12px] text-tinta-tenue">/{categoria.Slug}</p>
                </div>
                <span className="text-tinta-suave">Orden {categoria.Orden}</span>
                {categoria.Activo ? <Insignia tono="exito">Activa</Insignia> : <Insignia>Inactiva</Insignia>}
                <div className="flex gap-3">
                  <button className="enlace" onClick={() => setEditando(categoria)}>
                    Editar
                  </button>
                  {categoria.Activo && (
                    <button className="text-peligro hover:underline" disabled={eliminar.isPending} onClick={() => eliminar.mutate(categoria.IDCategoria)}>
                      Eliminar
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </Consulta>
      <Modal abierto={editando !== null} alCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva categoría' : 'Editar categoría'} ancho="lg">
        {editando !== null && consulta.data && <FormularioCategoria categoria={editando === 'nueva' ? undefined : editando} todas={consulta.data} alTerminar={() => setEditando(null)} />}
      </Modal>
    </>
  );
}
