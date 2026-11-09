import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCheckCircle } from 'react-icons/hi2';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { mensajeDe } from '../../api/error';
import { InsigniaEstado } from '../../components/pedidos/InsigniaEstado';
import { LineaTiempo } from '../../components/pedidos/LineaTiempo';
import { ResumenPedido } from '../../components/pedidos/ResumenPedido';
import { Boton } from '../../components/ui/Boton';
import { AreaTexto } from '../../components/ui/Campo';
import { Consulta } from '../../components/ui/Estados';
import { Modal } from '../../components/ui/Modal';
import { pedidosService } from '../../services/pedidos.service';
import { fechaYHora } from '../../utils/formato';

export default function DetallePedido() {
  const { id = '' } = useParams();
  const [parametros] = useSearchParams();
  const queryClient = useQueryClient();
  const consulta = useQuery({ queryKey: ['pedidos', 'detalle', id], queryFn: () => pedidosService.detalle(id) });
  const [cancelando, setCancelando] = useState(false);
  const [motivo, setMotivo] = useState('');

  const cancelar = useMutation({
    mutationFn: () => pedidosService.cancelar(id, motivo.trim()),
    onSuccess: async () => {
      setCancelando(false);
      toast.success('Pedido cancelado. Te devolveremos el pago.');
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <Consulta consulta={consulta}>
      {(detalle) => (
        <div className="space-y-10">
          {parametros.get('nuevo') && (
            <div className="flex items-start gap-3 rounded-3xl bg-exito/5 p-6">
              <HiOutlineCheckCircle className="mt-0.5 shrink-0 text-2xl text-exito" aria-hidden />
              <div>
                <p className="text-[19px] font-semibold">¡Gracias por tu compra!</p>
                <p className="text-tinta-suave">Recibimos tu pago y ya estamos preparando tu pedido.</p>
              </div>
            </div>
          )}
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <Link to="/cuenta/pedidos" className="text-[14px] text-enlace hover:underline">
                ‹ Tus pedidos
              </Link>
              <h1 className="mt-1 text-[32px] font-semibold">Pedido {detalle.pedido.NumeroPedido}</h1>
              <p className="text-tinta-suave">{fechaYHora(detalle.pedido.FechaPedido)}</p>
            </div>
            <div className="flex items-center gap-3">
              <InsigniaEstado estado={detalle.pedido.Estado} />
              {detalle.pedido.EsCancelable && (
                <Boton variante="peligro" tamano="sm" onClick={() => setCancelando(true)}>
                  Cancelar pedido
                </Boton>
              )}
            </div>
          </div>

          <div className="grid gap-10 lg:grid-cols-[1fr_280px]">
            <ResumenPedido detalle={detalle} />
            <section>
              <h2 className="mb-4 text-[19px] font-semibold">Seguimiento</h2>
              <LineaTiempo historial={detalle.historial} />
            </section>
          </div>

          <Modal abierto={cancelando} alCerrar={() => setCancelando(false)} titulo="¿Cancelar este pedido?">
            <p className="mb-4 text-[15px] text-tinta-suave">Liberaremos los productos y registraremos el reembolso del total pagado.</p>
            <AreaTexto etiqueta="Motivo" value={motivo} maxLength={300} onChange={(evento) => setMotivo(evento.target.value)} error={cancelar.isError && !motivo.trim() ? 'Indica un motivo' : undefined} />
            <div className="mt-5 flex justify-end gap-2">
              <Boton variante="secundario" onClick={() => setCancelando(false)}>
                No, mantener
              </Boton>
              <Boton variante="peligro" disabled={!motivo.trim()} cargando={cancelar.isPending} onClick={() => cancelar.mutate()}>
                Sí, cancelar
              </Boton>
            </div>
          </Modal>
        </div>
      )}
    </Consulta>
  );
}
