import { zodResolver } from '@hookform/resolvers/zod';
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { HiPlus } from 'react-icons/hi2';
import { z } from 'zod';
import type { Rol } from '../../api/cliente';
import { mensajeDe } from '../../api/error';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { Boton } from '../../components/ui/Boton';
import { Campo, Selector } from '../../components/ui/Campo';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useAuth } from '../../context/AuthContext';
import { useDebounce } from '../../hooks/useDebounce';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { usuariosService, type DatosUsuario, type UsuarioListado } from '../../services/usuarios.service';
import { fecha, fechaYHora } from '../../utils/formato';
import { mostrarErrorApi } from '../../utils/formularios';

const ETIQUETA_ROL: Record<Rol, string> = { CLIENTE: 'Cliente', OPERADOR: 'Operador', ADMINISTRADOR: 'Administrador' };

const esquema = z.object({
  nombres: z.string().trim().min(1, 'Escribe el nombre').max(100),
  apellidos: z.string().trim().min(1, 'Escribe el apellido').max(100),
  correo: z.string().trim().toLowerCase().email('Correo inválido').max(254),
  contrasena: z
    .string()
    .min(10, 'Mínimo 10 caracteres')
    .max(72)
    .refine((valor) => /[a-zA-Z]/.test(valor) && /\d/.test(valor), 'Debe incluir letras y números'),
  rol: z.enum(['CLIENTE', 'OPERADOR', 'ADMINISTRADOR']),
});

function FormularioUsuario({ alTerminar }: { alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const { register, handleSubmit, setError, formState } = useForm<DatosUsuario>({ resolver: zodResolver(esquema), defaultValues: { rol: 'OPERADOR' } });
  const crear = useMutation({
    mutationFn: usuariosService.crear,
    onSuccess: async () => {
      toast.success('Usuario creado');
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
      alTerminar();
    },
    onError: (error) => mostrarErrorApi(error, setError),
  });
  const errores = formState.errors;
  return (
    <form noValidate onSubmit={handleSubmit((datos) => crear.mutate(datos))} className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombres" {...register('nombres')} error={errores.nombres?.message} />
      <Campo etiqueta="Apellidos" {...register('apellidos')} error={errores.apellidos?.message} />
      <Campo etiqueta="Correo" type="email" autoComplete="off" {...register('correo')} error={errores.correo?.message} />
      <Selector etiqueta="Rol" {...register('rol')}>
        <option value="OPERADOR">Operador</option>
        <option value="ADMINISTRADOR">Administrador</option>
        <option value="CLIENTE">Cliente</option>
      </Selector>
      <div className="sm:col-span-2">
        <Campo etiqueta="Contraseña temporal" type="password" autoComplete="new-password" ayuda="Compártela por un canal seguro; la persona podrá cambiarla en su perfil." {...register('contrasena')} error={errores.contrasena?.message} />
      </div>
      <Boton type="submit" className="sm:col-span-2" cargando={crear.isPending}>
        Crear usuario
      </Boton>
    </form>
  );
}

export default function Usuarios() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ texto: undefined as string | undefined, rol: undefined as string | undefined, activo: undefined as string | undefined });
  const { perfil } = useAuth();
  const queryClient = useQueryClient();
  const [creando, setCreando] = useState(false);
  const [texto, setTexto] = useState(valores.texto ?? '');
  const textoListo = useDebounce(texto);
  useEffect(() => {
    if (textoListo !== (valores.texto ?? '')) actualizar({ texto: textoListo });
    // eslint-disable-next-line react/exhaustive-deps
  }, [textoListo]);

  const filtro = { pagina, tamanoPagina: 15, texto: valores.texto, rol: (valores.rol || undefined) as Rol | undefined, activo: valores.activo ? valores.activo === 'true' : undefined };
  const consulta = useQuery({ queryKey: ['usuarios', filtro], queryFn: () => usuariosService.listar(filtro), placeholderData: keepPreviousData });

  const cambiarEstado = useMutation({
    mutationFn: ({ id, activo }: { id: number; activo: boolean }) => usuariosService.cambiarEstado(id, activo),
    onSuccess: async (_vacio, { activo }) => {
      toast.success(activo ? 'Usuario activado' : 'Usuario desactivado y sesiones cerradas');
      await queryClient.invalidateQueries({ queryKey: ['usuarios'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  const columnas: Columna<UsuarioListado>[] = [
    {
      titulo: 'Usuario',
      celda: (usuario) => (
        <div>
          <p className="font-medium">
            {usuario.Nombres} {usuario.Apellidos}
          </p>
          <p className="text-[12px] text-tinta-tenue">{usuario.Correo}</p>
        </div>
      ),
    },
    { titulo: 'Rol', celda: (usuario) => ETIQUETA_ROL[usuario.Rol] },
    { titulo: 'Último acceso', celda: (usuario) => (usuario.UltimoAcceso ? fechaYHora(usuario.UltimoAcceso) : 'Nunca'), secundaria: true },
    { titulo: 'Alta', celda: (usuario) => fecha(usuario.CreadoEn), secundaria: true },
    { titulo: 'Estado', celda: (usuario) => (usuario.Activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia>Inactivo</Insignia>) },
    {
      titulo: 'Acción',
      alinear: 'derecha',
      celda: (usuario) =>
        usuario.IDUsuario === perfil?.usuario.IDUsuario ? (
          <span className="text-[13px] text-tinta-tenue">Tú</span>
        ) : (
          <button
            className={usuario.Activo ? 'text-[14px] text-peligro hover:underline' : 'enlace text-[14px]'}
            disabled={cambiarEstado.isPending}
            onClick={() => cambiarEstado.mutate({ id: usuario.IDUsuario, activo: !usuario.Activo })}
          >
            {usuario.Activo ? 'Desactivar' : 'Activar'}
          </button>
        ),
    },
  ];

  return (
    <>
      <Encabezado
        titulo="Usuarios"
        descripcion="Clientes y personal interno."
        acciones={
          <Boton icono={<HiPlus />} onClick={() => setCreando(true)}>
            Nuevo usuario
          </Boton>
        }
      />
      <BarraFiltros>
        <Campo etiqueta="Buscar" placeholder="Nombre o correo" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
        <Selector etiqueta="Rol" value={valores.rol ?? ''} onChange={(evento) => actualizar({ rol: evento.target.value })}>
          <option value="">Todos los roles</option>
          {Object.entries(ETIQUETA_ROL).map(([rol, etiqueta]) => (
            <option key={rol} value={rol}>
              {etiqueta}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Estado" value={valores.activo ?? ''} onChange={(evento) => actualizar({ activo: evento.target.value })}>
          <option value="">Activos e inactivos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Selector>
      </BarraFiltros>
      <TablaDatos columnas={columnas} consulta={consulta} claveFila={(usuario) => usuario.IDUsuario} alCambiarPagina={irAPagina} />
      <Modal abierto={creando} alCerrar={() => setCreando(false)} titulo="Nuevo usuario" ancho="lg">
        {creando && <FormularioUsuario alTerminar={() => setCreando(false)} />}
      </Modal>
    </>
  );
}
