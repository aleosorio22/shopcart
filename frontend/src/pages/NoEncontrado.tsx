import { EnlaceBoton } from '../components/ui/Boton';
import { EstadoVacio } from '../components/ui/Estados';

export default function NoEncontrado() {
  return <EstadoVacio titulo="No encontramos esta página" descripcion="El enlace puede estar roto o la página ya no existe." accion={<EnlaceBoton to="/">Ir al inicio</EnlaceBoton>} />;
}
