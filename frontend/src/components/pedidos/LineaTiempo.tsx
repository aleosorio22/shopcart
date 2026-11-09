import type { DetallePedido } from '../../services/pedidos.service';
import { fechaYHora } from '../../utils/formato';
import { ETIQUETA_ESTADO } from '../../utils/pedidos';

/** Historial de estados: quién lo cambió, cuándo y por qué (RF-07). */
export function LineaTiempo({ historial, mostrarUsuario = false }: { historial: DetallePedido['historial']; mostrarUsuario?: boolean }) {
  return (
    <ol className="relative space-y-5 border-l border-linea pl-6">
      {historial.map((cambio, indice) => (
        <li key={`${cambio.Fecha}-${indice}`} className="relative">
          <span className={`absolute -left-[29px] top-1.5 h-2.5 w-2.5 rounded-full ${indice === historial.length - 1 ? 'bg-accion' : 'bg-linea'}`} aria-hidden />
          <p className="font-medium">{ETIQUETA_ESTADO[cambio.EstadoNuevo]}</p>
          <p className="text-[13px] text-tinta-suave">
            {fechaYHora(cambio.Fecha)}
            {mostrarUsuario && cambio.CorreoUsuario ? ` · ${cambio.CorreoUsuario}` : ''}
          </p>
          {cambio.Motivo && <p className="mt-0.5 text-[14px] text-tinta-suave">“{cambio.Motivo}”</p>}
        </li>
      ))}
    </ol>
  );
}
