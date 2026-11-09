import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link, useParams } from 'react-router-dom';
import { mensajeDe } from '../../api/error';
import { InsigniaEstado } from '../../components/pedidos/InsigniaEstado';
import { LineaTiempo } from '../../components/pedidos/LineaTiempo';
import { ResumenPedido } from '../../components/pedidos/ResumenPedido';
import { Boton } from '../../components/ui/Boton';
import { AreaTexto, Casilla } from '../../components/ui/Campo';
import { Consulta } from '../../components/ui/Estados';
import { Modal } from '../../components/ui/Modal';
import { pedidosService, type DetallePedido, type EstadoAvanzable } from '../../services/pedidos.service';
import { fechaYHora, quetzales } from '../../utils/formato';
import { esDevolvible, ETIQUETA_ESTADO, siguientesEstados } from '../../utils/pedidos';

type Accion = { tipo: 'avanzar'; estado: EstadoAvanzable } | { tipo: 'cancelar' } | { tipo: 'devolver' } | null;

function FormularioDevolucion({ detalle, alTerminar }: { detalle: DetallePedido; alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const devolvibles = detalle.lineas.filter((linea) => linea.Cantidad > linea.CantidadDevuelta);
  const [cantidades, setCantidades] = useState<Record<string, number>>({});
  const [reingresa, setReingresa] = useState(true);
  const [motivo, setMotivo] = useState('');
  const lineas = Object.entries(cantidades)
    .filter(([, cantidad]) => cantidad > 0)
    .map(([idPedidoDetalle, cantidad]) => ({ idPedidoDetalle: Number(idPedidoDetalle), cantidad, reingresaInventario: reingresa }));
  const monto = devolvibles.reduce((total, linea) => total + (cantidades[linea.IDPedidoDetalle] ?? 0) * (linea.TotalLinea / linea.Cantidad), 0);

  const devolver = useMutation({
    mutationFn: () => pedidosService.devolver(detalle.pedido.IDPedido, { motivo: motivo.trim(), lineas }),
    onSuccess: async () => {
      toast.success('Devolución registrada. El reembolso quedó pendiente.');
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      alTerminar();
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <div className="space-y-5">
      <ul className="divide-y divide-linea/70">
        {devolvibles.map((linea) => {
          const maximo = linea.Cantidad - linea.CantidadDevuelta;
          return (
            <li key={linea.IDPedidoDetalle} className="flex items-center justify-between gap-4 py-3">
              <div>
                <p className="font-medium">{linea.NombreProducto}</p>
                <p className="text-[13px] text-tinta-tenue">Puedes devolver hasta {maximo}</p>
              </div>
              <input
                type="number"
                min={0}
                max={maximo}
                aria-label={`Unidades a devolver de ${linea.NombreProducto}`}
                value={cantidades[linea.IDPedidoDetalle] ?? 0}
                onChange={(evento) =>
                  setCantidades({ ...cantidades, [linea.IDPedidoDetalle]: Math.min(maximo, Math.max(0, Number(evento.target.value) || 0)) })
                }
                className="w-20 rounded-xl border border-linea px-3 py-2 text-right"
              />
            </li>
          );
        })}
      </ul>
      <Casilla etiqueta="Reingresar al inventario (producto en buen estado)" checked={reingresa} onChange={(evento) => setReingresa(evento.target.checked)} />
      <AreaTexto etiqueta="Motivo" value={motivo} maxLength={300} onChange={(evento) => setMotivo(evento.target.value)} />
      <p className="text-[14px] text-tinta-suave">Reembolso estimado: {quetzales(monto)} (no incluye el envío).</p>
      <Boton className="w-full" disabled={lineas.length === 0 || !motivo.trim()} cargando={devolver.isPending} onClick={() => devolver.mutate()}>
        Registrar devolución
      </Boton>
    </div>
  );
}

function Acciones({ detalle }: { detalle: DetallePedido }) {
  const queryClient = useQueryClient();
  const [accion, setAccion] = useState<Accion>(null);
  // El titulo se conserva mientras el dialogo se cierra con su animacion.
  const [titulo, setTitulo] = useState('');
  const [motivo, setMotivo] = useState('');
  const abrir = (nueva: NonNullable<Accion>) => {
    setTitulo(nueva.tipo === 'cancelar' ? 'Cancelar pedido' : nueva.tipo === 'avanzar' ? `Pasar a ${ETIQUETA_ESTADO[nueva.estado].toLowerCase()}` : 'Registrar devolución');
    setAccion(nueva);
  };
  const { pedido } = detalle;
  const siguientes = siguientesEstados(pedido.Estado, Boolean(pedido.SucursalRecoger));

  const cerrar = () => {
    setAccion(null);
    setMotivo('');
  };
  const ejecutar = useMutation({
    mutationFn: async () => {
      if (accion?.tipo === 'avanzar') await pedidosService.cambiarEstado(pedido.IDPedido, accion.estado, motivo.trim() || undefined);
      if (accion?.tipo === 'cancelar') await pedidosService.cancelar(pedido.IDPedido, motivo.trim());
    },
    onSuccess: async () => {
      toast.success('Pedido actualizado');
      await queryClient.invalidateQueries({ queryKey: ['pedidos'] });
      cerrar();
    },
    // Si otra persona movio el pedido antes, el backend responde TRANSICION_NO_PERMITIDA: se recarga.
    onError: async (error) => {
      toast.error(mensajeDe(error));
      await queryClient.invalidateQueries({ queryKey: ['pedidos', 'detalle', pedido.IDPedido] });
    },
  });

  return (
    <div className="flex flex-wrap gap-2">
      {siguientes.map((estado) => (
        <Boton key={estado} onClick={() => abrir({ tipo: 'avanzar', estado })}>
          Marcar como {ETIQUETA_ESTADO[estado].toLowerCase()}
        </Boton>
      ))}
      {pedido.EsCancelable && (
        <Boton variante="peligro" onClick={() => abrir({ tipo: 'cancelar' })}>
          Cancelar
        </Boton>
      )}
      {esDevolvible(pedido.Estado) && (
        <Boton variante="secundario" onClick={() => abrir({ tipo: 'devolver' })}>
          Registrar devolución
        </Boton>
      )}

      <Modal
        abierto={accion?.tipo === 'avanzar' || accion?.tipo === 'cancelar'}
        alCerrar={cerrar}
        titulo={titulo}
      >
        <AreaTexto
          etiqueta={titulo === 'Cancelar pedido' ? 'Motivo (obligatorio)' : 'Nota (opcional)'}
          value={motivo}
          maxLength={300}
          onChange={(evento) => setMotivo(evento.target.value)}
        />
        {accion?.tipo === 'cancelar' && <p className="mt-2 text-[13px] text-tinta-suave">Se libera la existencia, se devuelve el cupón y se registra un reembolso pendiente.</p>}
        <div className="mt-5 flex justify-end gap-2">
          <Boton variante="secundario" onClick={cerrar}>
            Volver
          </Boton>
          <Boton
            variante={accion?.tipo === 'cancelar' ? 'peligro' : 'primario'}
            disabled={accion?.tipo === 'cancelar' && !motivo.trim()}
            cargando={ejecutar.isPending}
            onClick={() => ejecutar.mutate()}
          >
            Confirmar
          </Boton>
        </div>
      </Modal>
      <Modal abierto={accion?.tipo === 'devolver'} alCerrar={cerrar} titulo={titulo} ancho="lg">
        <FormularioDevolucion detalle={detalle} alTerminar={cerrar} />
      </Modal>
    </div>
  );
}

export default function DetallePedidoPanel() {
  const { id = '' } = useParams();
  const consulta = useQuery({ queryKey: ['pedidos', 'detalle', id], queryFn: () => pedidosService.detalle(id) });
  return (
    <Consulta consulta={consulta}>
      {(detalle) => (
        <div className="space-y-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Link to="/panel/pedidos" className="text-[14px] text-enlace hover:underline">
                ‹ Pedidos
              </Link>
              <div className="mt-1 flex items-center gap-3">
                <h1 className="text-[32px] font-semibold">{detalle.pedido.NumeroPedido}</h1>
                <InsigniaEstado estado={detalle.pedido.Estado} />
              </div>
              <p className="text-tinta-suave">{fechaYHora(detalle.pedido.FechaPedido)}</p>
            </div>
            <Acciones detalle={detalle} />
          </div>
          <div className="grid gap-10 lg:grid-cols-[1fr_300px]">
            <ResumenPedido detalle={detalle} />
            <section>
              <h2 className="mb-4 text-[19px] font-semibold">Historial</h2>
              <LineaTiempo historial={detalle.historial} mostrarUsuario />
            </section>
          </div>
        </div>
      )}
    </Consulta>
  );
}
