import { EnlaceBoton } from '../components/ui/Boton';
import { EstadoVacio } from '../components/ui/Estados';

export default function NoEncontrado() {
  return <EstadoVacio titulo="No encontramos esta pagina" descripcion="El enlace puede estar roto o la pagina ya no existe." accion={<EnlaceBoton to="/">Ir al inicio</EnlaceBoton>} />;
}
