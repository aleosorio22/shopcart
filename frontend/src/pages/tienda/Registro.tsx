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

// Mismas reglas que el backend, para avisar antes de enviar.
const esquema = z
  .object({
    nombres: z.string().trim().min(1, 'Escribe tu nombre').max(100),
    apellidos: z.string().trim().min(1, 'Escribe tu apellido').max(100),
    correo: z.string().trim().min(1, 'Escribe tu correo').email('Correo inválido').max(254),
    telefono: z
      .string()
      .trim()
      .regex(/^(\+?\d{8,15})?$/, 'Usa de 8 a 15 dígitos')
      .transform((valor) => valor || undefined),
    contrasena: z
      .string()
      .min(10, 'Mínimo 10 caracteres')
      .max(72, 'Máximo 72 caracteres')
      .refine((valor) => /[a-zA-Z]/.test(valor) && /\d/.test(valor), 'Debe incluir letras y números'),
    confirmacion: z.string(),
  })
  .refine((datos) => datos.contrasena === datos.confirmacion, { path: ['confirmacion'], message: 'Las contraseñas no coinciden' });
type Entrada = z.input<typeof esquema>;
type Datos = z.output<typeof esquema>;

export default function Registro() {
  const { registrar, estado } = useAuth();
  const navegar = useNavigate();
  const [parametros] = useSearchParams();
  const { register, handleSubmit, setError, formState } = useForm<Entrada, unknown, Datos>({ resolver: zodResolver(esquema) });
  const errores = formState.errors;

  if (estado === 'autenticado') return <Navigate to="/" replace />;

  const enviar = handleSubmit(async ({ confirmacion: _confirmacion, ...datos }) => {
    try {
      const perfil = await registrar(datos);
      toast.success(`Te damos la bienvenida, ${perfil.usuario.Nombres}`);
      navegar(rutaSegura(parametros.get('volver'), '/'), { replace: true });
    } catch (error) {
      mostrarErrorApi(error, setError, ['correo', 'contrasena', 'nombres', 'apellidos', 'telefono']);
    }
  });

  return (
    <div className="contenedor flex justify-center py-16">
      <div className="w-full max-w-md">
        <h1 className="text-center text-[32px] font-semibold">Crea tu cuenta.</h1>
        <p className="mt-2 text-center text-tinta-suave">Una cuenta para comprar y seguir tus pedidos.</p>
        <form noValidate onSubmit={enviar} className="mt-8 grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombres" autoComplete="given-name" {...register('nombres')} error={errores.nombres?.message} />
          <Campo etiqueta="Apellidos" autoComplete="family-name" {...register('apellidos')} error={errores.apellidos?.message} />
          <div className="sm:col-span-2">
            <Campo etiqueta="Correo" type="email" autoComplete="email" {...register('correo')} error={errores.correo?.message} />
          </div>
          <div className="sm:col-span-2">
            <Campo etiqueta="Teléfono (opcional)" type="tel" autoComplete="tel" {...register('telefono')} error={errores.telefono?.message} />
          </div>
          <Campo
            etiqueta="Contraseña"
            type="password"
            autoComplete="new-password"
            ayuda="10 caracteres con letras y números"
            {...register('contrasena')}
            error={errores.contrasena?.message}
          />
          <Campo etiqueta="Confirmar" type="password" autoComplete="new-password" {...register('confirmacion')} error={errores.confirmacion?.message} />
          <Boton type="submit" tamano="lg" className="w-full sm:col-span-2" cargando={formState.isSubmitting}>
            Crear cuenta
          </Boton>
        </form>
        <p className="mt-6 text-center text-[15px] text-tinta-suave">
          ¿Ya tienes cuenta?{' '}
          <Link to="/ingresar" className="enlace">
            Inicia sesión ›
          </Link>
        </p>
      </div>
    </div>
  );
}
