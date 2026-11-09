import type { EstadoPedido } from '../../services/pedidos.service';
import { ETIQUETA_ESTADO, TONO_ESTADO } from '../../utils/pedidos';
import { Insignia } from '../ui/Insignia';

export const InsigniaEstado = ({ estado }: { estado: EstadoPedido }) => <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Insignia>;
