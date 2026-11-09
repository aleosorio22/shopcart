import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Encabezado, BarraFiltros } from '../../components/panel/Encabezado';
import { InsigniaEstado } from '../../components/pedidos/InsigniaEstado';
import { Campo, Selector } from '../../components/ui/Campo';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useDebounce } from '../../hooks/useDebounce';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { ESTADOS_PEDIDO, pedidosService, type EstadoPedido, type OrdenPedidos, type PedidoResumen } from '../../services/pedidos.service';
import { fechaYHora, quetzales } from '../../utils/formato';
import { ETIQUETA_ESTADO } from '../../utils/pedidos';

const COLUMNAS: Columna<PedidoResumen>[] = [
  { titulo: 'Pedido', celda: (pedido) => <span className="whitespace-nowrap font-medium">{pedido.NumeroPedido}</span> },
  { titulo: 'Fecha', celda: (pedido) => fechaYHora(pedido.FechaPedido), orden: { asc: 'FECHA_ASC', desc: 'FECHA_DESC' }, secundaria: true },
  {
    titulo: 'Cliente',
    celda: (pedido) => (
      <div>
        <p>{pedido.Cliente}</p>
        <p className="text-[12px] text-tinta-tenue">{pedido.Correo}</p>
      </div>
    ),
  },
  { titulo: 'Estado', celda: (pedido) => <InsigniaEstado estado={pedido.Estado} /> },
  { titulo: 'Total', celda: (pedido) => quetzales(pedido.Total), orden: { asc: 'TOTAL_ASC', desc: 'TOTAL_DESC' }, alinear: 'derecha' },
];

const FILTROS = {
  estado: undefined as string | undefined,
  cliente: undefined as string | undefined,
  desde: undefined as string | undefined,
  hasta: undefined as string | undefined,
  orden: 'FECHA_DESC' as string | undefined,
};

export default function Pedidos() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl(FILTROS);
  const navegar = useNavigate();
  const [cliente, setCliente] = useState(valores.cliente ?? '');
  const clienteListo = useDebounce(cliente);
  useEffect(() => {
    if (clienteListo !== (valores.cliente ?? '')) actualizar({ cliente: clienteListo });
    // eslint-disable-next-line react/exhaustive-deps
  }, [clienteListo]);

  const rangoInvalido = Boolean(valores.desde && valores.hasta && valores.desde > valores.hasta);
  const filtro = {
    pagina,
    tamanoPagina: 15,
    estado: valores.estado as EstadoPedido | undefined,
    textoCliente: valores.cliente,
    desde: rangoInvalido ? undefined : valores.desde,
    hasta: rangoInvalido ? undefined : valores.hasta,
    orden: (valores.orden ?? 'FECHA_DESC') as OrdenPedidos,
  };
  const consulta = useQuery({ queryKey: ['pedidos', 'panel', filtro], queryFn: () => pedidosService.listar(filtro), placeholderData: keepPreviousData });

  return (
    <>
      <Encabezado titulo="Pedidos" descripcion="Prepara, despacha y da seguimiento a los pedidos." />
      <BarraFiltros>
        <Campo etiqueta="Cliente" placeholder="Buscar por nombre o correo" value={cliente} onChange={(evento) => setCliente(evento.target.value)} />
        <Selector etiqueta="Estado" value={valores.estado ?? ''} onChange={(evento) => actualizar({ estado: evento.target.value })}>
          <option value="">Todos los estados</option>
          {ESTADOS_PEDIDO.map((estado) => (
            <option key={estado} value={estado}>
              {ETIQUETA_ESTADO[estado]}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Desde" type="date" value={valores.desde ?? ''} onChange={(evento) => actualizar({ desde: evento.target.value })} />
        <Campo
          etiqueta="Hasta"
          type="date"
          value={valores.hasta ?? ''}
          onChange={(evento) => actualizar({ hasta: evento.target.value })}
          error={rangoInvalido ? 'Debe ser posterior a “desde”' : undefined}
        />
      </BarraFiltros>
      <TablaDatos
        columnas={COLUMNAS}
        consulta={consulta}
        claveFila={(pedido) => pedido.IDPedido}
        alCambiarPagina={irAPagina}
        orden={filtro.orden}
        alOrdenar={(orden) => actualizar({ orden })}
        alSeleccionar={(pedido) => navegar(`/panel/pedidos/${pedido.IDPedido}`)}
      />
    </>
  );
}
