import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';
import { z } from 'zod';
import { Boton } from '../../components/ui/Boton';
import { Campo } from '../../components/ui/Campo';
import { useAuth } from '../../context/AuthContext';
import { authService } from '../../services/auth.service';
import { mostrarErrorApi } from '../../utils/formularios';

const esquemaPerfil = z.object({
  nombres: z.string().trim().min(1, 'Escribe tu nombre').max(100),
  apellidos: z.string().trim().min(1, 'Escribe tu apellido').max(100),
  telefono: z
    .string()
    .trim()
    .regex(/^(\+?\d{8,15})?$/, 'Usa de 8 a 15 dígitos')
    .transform((valor) => valor || undefined),
});

const esquemaContrasena = z
  .object({
    actual: z.string().min(1, 'Escribe tu contraseña actual'),
    nueva: z
      .string()
      .min(10, 'Mínimo 10 caracteres')
      .max(72, 'Máximo 72 caracteres')
      .refine((valor) => /[a-zA-Z]/.test(valor) && /\d/.test(valor), 'Debe incluir letras y números'),
    confirmacion: z.string(),
  })
  .refine((datos) => datos.nueva === datos.confirmacion, { path: ['confirmacion'], message: 'Las contraseñas no coinciden' });

function FormularioPerfil() {
  const { perfil, recargarPerfil } = useAuth();
  const usuario = perfil!.usuario;
  const { register, handleSubmit, setError, formState } = useForm<z.input<typeof esquemaPerfil>, unknown, z.output<typeof esquemaPerfil>>({
    resolver: zodResolver(esquemaPerfil),
    defaultValues: { nombres: usuario.Nombres, apellidos: usuario.Apellidos, telefono: usuario.Telefono ?? '' },
  });

  const guardar = handleSubmit(async (datos) => {
    try {
      await authService.actualizarPerfil(datos);
      await recargarPerfil();
      toast.success('Perfil actualizado');
    } catch (error) {
      mostrarErrorApi(error, setError);
    }
  });

  return (
    <form noValidate onSubmit={guardar} className="grid gap-4 sm:grid-cols-2">
      <Campo etiqueta="Nombres" {...register('nombres')} error={formState.errors.nombres?.message} />
      <Campo etiqueta="Apellidos" {...register('apellidos')} error={formState.errors.apellidos?.message} />
      <Campo etiqueta="Correo" value={usuario.Correo} disabled readOnly />
      <Campo etiqueta="Teléfono" type="tel" {...register('telefono')} error={formState.errors.telefono?.message} />
      <div className="sm:col-span-2">
        <Boton type="submit" cargando={formState.isSubmitting}>
          Guardar cambios
        </Boton>
      </div>
    </form>
  );
}

function FormularioContrasena() {
  const { cerrarSesion } = useAuth();
  const navegar = useNavigate();
  const { register, handleSubmit, setError, formState } = useForm<z.infer<typeof esquemaContrasena>>({ resolver: zodResolver(esquemaContrasena) });

  const cambiar = handleSubmit(async ({ actual, nueva }) => {
    try {
      await authService.cambiarContrasena(actual, nueva);
      // El backend revoca todas las sesiones: se pide iniciar sesion con la nueva contrasena.
      toast.success('Contraseña actualizada. Inicia sesión de nuevo.');
      await cerrarSesion();
      navegar('/ingresar', { replace: true });
    } catch (error) {
      mostrarErrorApi(error, setError, ['actual', 'nueva']);
    }
  });

  return (
    <form noValidate onSubmit={cambiar} className="grid gap-4 sm:grid-cols-3">
      <Campo etiqueta="Actual" type="password" autoComplete="current-password" {...register('actual')} error={formState.errors.actual?.message} />
      <Campo etiqueta="Nueva" type="password" autoComplete="new-password" {...register('nueva')} error={formState.errors.nueva?.message} />
      <Campo etiqueta="Confirmar" type="password" autoComplete="new-password" {...register('confirmacion')} error={formState.errors.confirmacion?.message} />
      <div className="sm:col-span-3">
        <Boton type="submit" variante="secundario" cargando={formState.isSubmitting}>
          Cambiar contraseña
        </Boton>
      </div>
    </form>
  );
}

export default function Perfil() {
  return (
    <div className="space-y-12">
      <section>
        <h1 className="mb-6 text-[32px] font-semibold">Perfil.</h1>
        <FormularioPerfil />
      </section>
      <section>
        <h2 className="mb-6 text-[24px] font-semibold">Contraseña</h2>
        <FormularioContrasena />
      </section>
    </div>
  );
}
