import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useForm, useWatch } from 'react-hook-form';
import toast from 'react-hot-toast';
import { z } from 'zod';
import { CLAVE_DIRECCIONES, useMunicipios } from '../../hooks/useDirecciones';
import { clientesService, type DatosDireccion, type Direccion, type Municipio } from '../../services/clientes.service';
import { EstadoCargando } from '../ui/Estados';
import { mostrarErrorApi } from '../../utils/formularios';
import { Boton } from '../ui/Boton';
import { Campo, Casilla, Selector } from '../ui/Campo';

const esquema = z.object({
  alias: z.string().trim().min(1, 'Ponle un nombre, por ejemplo Casa').max(40),
  destinatario: z.string().trim().min(1, 'Indica quién recibe').max(150),
  telefono: z.string().trim().regex(/^\+?\d{8,15}$/, 'Usa de 8 a 15 dígitos'),
  idDepartamento: z.coerce.number<string>().int().positive('Elige un departamento'),
  idMunicipio: z.coerce.number<string>().int().positive('Elige un municipio'),
  linea1: z.string().trim().min(1, 'Escribe la dirección').max(200),
  linea2: z.string().trim().max(200).optional(),
  referencia: z.string().trim().max(300).optional(),
  esPredeterminada: z.boolean(),
});
type Entrada = z.input<typeof esquema>;
type Datos = z.output<typeof esquema>;

interface Props {
  direccion?: Direccion;
  alGuardar: (idDireccion?: number) => void;
}

export function FormularioDireccion(props: Props) {
  const municipios = useMunicipios();
  if (municipios.isPending) return <EstadoCargando />;
  return <Formulario {...props} municipios={municipios.data ?? []} />;
}

function Formulario({ direccion, alGuardar, municipios }: Props & { municipios: Municipio[] }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, control, setError, setValue, formState } = useForm<Entrada, unknown, Datos>({
    resolver: zodResolver(esquema),
    defaultValues: {
      alias: direccion?.Alias ?? '',
      destinatario: direccion?.Destinatario ?? '',
      telefono: direccion?.Telefono ?? '',
      idDepartamento: String(direccion?.IDDepartamento ?? ''),
      idMunicipio: String(direccion?.IDMunicipio ?? ''),
      linea1: direccion?.Linea1 ?? '',
      linea2: direccion?.Linea2 ?? '',
      referencia: direccion?.Referencia ?? '',
      esPredeterminada: direccion?.EsPredeterminada ?? false,
    },
  });
  const errores = formState.errors;

  const departamentos = useMemo(() => {
    const unicos = new Map(municipios.map((municipio) => [municipio.IDDepartamento, municipio.Departamento]));
    return [...unicos].sort((a, b) => a[1].localeCompare(b[1]));
  }, [municipios]);
  const idDepartamento = Number(useWatch({ control, name: 'idDepartamento' }));
  const municipiosDelDepartamento = municipios.filter((municipio) => municipio.IDDepartamento === idDepartamento);

  const guardar = useMutation({
    mutationFn: ({ idDepartamento: _departamento, ...datos }: Datos) => {
      const cuerpo: DatosDireccion = { ...datos, linea2: datos.linea2 || undefined, referencia: datos.referencia || undefined };
      return direccion ? clientesService.editarDireccion(direccion.IDDireccion, cuerpo).then(() => undefined) : clientesService.crearDireccion(cuerpo);
    },
    onSuccess: async (resultado) => {
      await queryClient.invalidateQueries({ queryKey: CLAVE_DIRECCIONES });
      toast.success('Dirección guardada');
      alGuardar(resultado?.idDireccion);
    },
    onError: (error) => mostrarErrorApi(error, setError),
  });

  return (
    <form noValidate onSubmit={handleSubmit((datos) => guardar.mutate(datos))} className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombre de la dirección" placeholder="Casa, Oficina..." {...register('alias')} error={errores.alias?.message} />
      <Campo etiqueta="Teléfono" type="tel" {...register('telefono')} error={errores.telefono?.message} />
      <div className="sm:col-span-2">
        <Campo etiqueta="Quién recibe" {...register('destinatario')} error={errores.destinatario?.message} />
      </div>
      <Selector
        etiqueta="Departamento"
        {...register('idDepartamento', { onChange: () => setValue('idMunicipio', '') })}
        error={errores.idDepartamento?.message}
      >
        <option value="">Elige uno</option>
        {departamentos.map(([id, nombre]) => (
          <option key={id} value={id}>
            {nombre}
          </option>
        ))}
      </Selector>
      <Selector etiqueta="Municipio" {...register('idMunicipio')} disabled={!idDepartamento} error={errores.idMunicipio?.message}>
        <option value="">Elige uno</option>
        {municipiosDelDepartamento.map((municipio) => (
          <option key={municipio.IDMunicipio} value={municipio.IDMunicipio}>
            {municipio.Municipio}
          </option>
        ))}
      </Selector>
      <div className="sm:col-span-2">
        <Campo etiqueta="Dirección" placeholder="Calle, avenida, número y zona" {...register('linea1')} error={errores.linea1?.message} />
      </div>
      <Campo etiqueta="Complemento (opcional)" placeholder="Apartamento, edificio" {...register('linea2')} error={errores.linea2?.message} />
      <Campo etiqueta="Referencia (opcional)" placeholder="Frente al parque" {...register('referencia')} error={errores.referencia?.message} />
      <div className="sm:col-span-2">
        <Casilla etiqueta="Usar como dirección predeterminada" {...register('esPredeterminada')} />
      </div>
      <Boton type="submit" tamano="lg" className="sm:col-span-2" cargando={guardar.isPending}>
        Guardar dirección
      </Boton>
    </form>
  );
}
