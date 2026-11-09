/** Solo se aceptan rutas internas en ?volver= para no abrir una redireccion a otro sitio. */
export function rutaSegura(volver: string | null, porDefecto: string): string {
  return volver && volver.startsWith('/') && !volver.startsWith('//') ? volver : porDefecto;
}
