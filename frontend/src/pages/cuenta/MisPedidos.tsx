import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { HiOutlineClipboardDocumentList } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { InsigniaEstado } from '../../components/pedidos/InsigniaEstado';
import { EnlaceBoton } from '../../components/ui/Boton';
import { EstadoVacio } from '../../components/ui/Estados';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { pedidosService, type PedidoResumen } from '../../services/pedidos.service';
import { fecha, quetzales } from '../../utils/formato';

const COLUMNAS: Columna<PedidoResumen>[] = [
  { titulo: 'Pedido', celda: (pedido) => <span className="whitespace-nowrap font-medium">{pedido.NumeroPedido}</span> },
  { titulo: 'Fecha', celda: (pedido) => fecha(pedido.FechaPedido), secundaria: true },
  { titulo: 'Estado', celda: (pedido) => <InsigniaEstado estado={pedido.Estado} /> },
  { titulo: 'Total', celda: (pedido) => quetzales(pedido.Total), alinear: 'derecha' },
];

export default function MisPedidos() {
  const { pagina, irAPagina } = useFiltrosUrl({});
  const navegar = useNavigate();
  const consulta = useQuery({
    queryKey: ['pedidos', 'mios', pagina],
    queryFn: () => pedidosService.mios({ pagina, tamanoPagina: 10 }),
    placeholderData: keepPreviousData,
  });

  return (
    <>
      <h1 className="mb-6 text-[32px] font-semibold">Tus pedidos.</h1>
      <TablaDatos
        columnas={COLUMNAS}
        consulta={consulta}
        claveFila={(pedido) => pedido.IDPedido}
        alCambiarPagina={irAPagina}
        alSeleccionar={(pedido) => navegar(`/cuenta/pedidos/${pedido.IDPedido}`)}
        vacio={
          <EstadoVacio
            icono={<HiOutlineClipboardDocumentList />}
            titulo="Aún no has hecho pedidos"
            descripcion="Cuando compres, podrás seguir aquí cada paso."
            accion={<EnlaceBoton to="/tienda">Ir a la tienda</EnlaceBoton>}
          />
        }
      />
    </>
  );
}
