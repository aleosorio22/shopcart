import { zodResolver } from '@hookform/resolvers/zod';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { z } from 'zod';
import { Boton } from '../../components/ui/Boton';
import { Campo } from '../../components/ui/Campo';
import { useAuth } from '../../context/AuthContext';
import { mostrarErrorApi } from '../../utils/formularios';
import { rutaSegura } from '../../utils/navegacion';

const esquema = z.object({
  correo: z.string().trim().min(1, 'Escribe tu correo').email('Correo invalido'),
  contrasena: z.string().min(1, 'Escribe tu contrasena'),
});
type Datos = z.infer<typeof esquema>;

export default function Ingresar() {
  const { iniciarSesion, estado } = useAuth();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const volver = parametros.get('volver');
  const { register, handleSubmit, setError, formState } = useForm<Datos>({ resolver: zodResolver(esquema) });

  if (estado === 'autenticado') return <Navigate to={rutaSegura(volver, '/')} replace />;

  const enviar = handleSubmit(async ({ correo, contrasena }) => {
    try {
      const perfil = await iniciarSesion(correo, contrasena);
      toast.success(`Hola, ${perfil.usuario.Nombres}`);
      const inicio = perfil.usuario.Rol === 'CLIENTE' ? '/' : '/panel';
      navegar(rutaSegura(volver, inicio), { replace: true });
    } catch (error) {
      mostrarErrorApi(error, setError, ['correo', 'contrasena']);
    }
  });

  return (
    <div className="contenedor flex justify-center py-16">
      <div className="w-full max-w-sm">
        <h1 className="text-center text-[32px] font-semibold">Inicia sesion en ShopCart.</h1>
        <form noValidate onSubmit={enviar} className="mt-8 space-y-4">
          <Campo etiqueta="Correo" type="email" autoComplete="email" {...register('correo')} error={formState.errors.correo?.message} />
          <Campo etiqueta="Contrasena" type="password" autoComplete="current-password" {...register('contrasena')} error={formState.errors.contrasena?.message} />
          <Boton type="submit" tamano="lg" className="w-full" cargando={formState.isSubmitting}>
            Continuar
          </Boton>
        </form>
        <p className="mt-6 text-center text-[15px] text-tinta-suave">
          ¿No tienes cuenta?{' '}
          <Link to={`/registro${volver ? `?volver=${encodeURIComponent(volver)}` : ''}`} className="enlace">
            Crea una ahora ›
          </Link>
        </p>
      </div>
    </div>
  );
}
