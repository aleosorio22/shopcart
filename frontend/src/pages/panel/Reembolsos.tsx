import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';
import { mensajeDe } from '../../api/error';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { Boton } from '../../components/ui/Boton';
import { Campo, Selector } from '../../components/ui/Campo';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { pedidosService, type Reembolso } from '../../services/pedidos.service';
import { fechaYHora, quetzales } from '../../utils/formato';

export default function Reembolsos() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ estado: 'PENDIENTE' as string | undefined });
  const queryClient = useQueryClient();
  const [procesando, setProcesando] = useState<Reembolso | null>(null);
  const [referencia, setReferencia] = useState('');
  const filtro = { pagina, tamanoPagina: 15, estado: (valores.estado || undefined) as Reembolso['Estado'] | undefined };
  const consulta = useQuery({ queryKey: ['pedidos', 'reembolsos', filtro], queryFn: () => pedidosService.reembolsos(filtro), placeholderData: keepPreviousData });

  const procesar = useMutation({
    mutationFn: () => pedidosService.procesarReembolso(procesando!.IDReembolso, referencia.trim()),
    onSuccess: async () => {
      toast.success('Reembolso marcado como procesado');
      setProcesando(null);
      setReferencia('');
      await queryClient.invalidateQueries({ queryKey: ['pedidos', 'reembolsos'] });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  const columnas: Columna<Reembolso>[] = [
    {
      titulo: 'Pedido',
      celda: (reembolso) => (
        <Link to={`/panel/pedidos/${reembolso.IDPedido}`} className="enlace font-medium">
          {reembolso.NumeroPedido}
        </Link>
      ),
    },
    { titulo: 'Fecha', celda: (reembolso) => fechaYHora(reembolso.Fecha), secundaria: true },
    { titulo: 'Origen', celda: (reembolso) => (reembolso.IDDevolucion ? 'Devolución' : 'Cancelación o pago tardío'), secundaria: true },
    { titulo: 'Estado', celda: (reembolso) => <Insignia tono={reembolso.Estado === 'PENDIENTE' ? 'alerta' : 'exito'}>{reembolso.Estado === 'PENDIENTE' ? 'Pendiente' : 'Procesado'}</Insignia> },
    { titulo: 'Monto', celda: (reembolso) => quetzales(reembolso.Monto), alinear: 'derecha' },
    {
      titulo: 'Acción',
      alinear: 'derecha',
      celda: (reembolso) =>
        reembolso.Estado === 'PENDIENTE' ? (
          <Boton tamano="sm" variante="secundario" onClick={() => setProcesando(reembolso)}>
            Procesar
          </Boton>
        ) : (
          <span className="text-[13px] text-tinta-tenue">{reembolso.Referencia}</span>
        ),
    },
  ];

  return (
    <>
      <Encabezado titulo="Reembolsos" descripcion="Pagos a devolver por cancelaciones y devoluciones." />
      <BarraFiltros>
        <Selector etiqueta="Estado" value={valores.estado ?? ''} onChange={(evento) => actualizar({ estado: evento.target.value })}>
          <option value="">Todos</option>
          <option value="PENDIENTE">Pendientes</option>
          <option value="PROCESADO">Procesados</option>
        </Selector>
      </BarraFiltros>
      <TablaDatos columnas={columnas} consulta={consulta} claveFila={(reembolso) => reembolso.IDReembolso} alCambiarPagina={irAPagina} />
      <Modal abierto={procesando !== null} alCerrar={() => setProcesando(null)} titulo="Procesar reembolso">
        <p className="mb-4 text-[15px] text-tinta-suave">
          Registra la referencia del reembolso ejecutado en la pasarela por {procesando ? quetzales(procesando.Monto) : ''}.
        </p>
        <Campo etiqueta="Referencia de la pasarela" value={referencia} maxLength={100} onChange={(evento) => setReferencia(evento.target.value)} />
        <Boton className="mt-5 w-full" disabled={!referencia.trim()} cargando={procesar.isPending} onClick={() => procesar.mutate()}>
          Marcar como procesado
        </Boton>
      </Modal>
    </>
  );
}
