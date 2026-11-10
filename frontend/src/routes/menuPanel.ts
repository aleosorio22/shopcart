import type { IconType } from 'react-icons';
import {
  HiOutlineArchiveBox,
  HiOutlineArrowUturnLeft,
  HiOutlineChartBar,
  HiOutlineClipboardDocumentList,
  HiOutlineCube,
  HiOutlineDocumentMagnifyingGlass,
  HiOutlineSquares2X2,
  HiOutlineTicket,
  HiOutlineUsers,
} from 'react-icons/hi2';
import type { Permiso } from '../services/auth.service';

export interface OpcionMenu {
  ruta: string;
  etiqueta: string;
  icono: IconType;
  permiso: Permiso;
}

/**
 * Fuente unica del menu del panel: el mismo permiso decide si la opcion se muestra
 * y si la ruta deja entrar. El backend vuelve a validarlo en cada peticion.
 */
export const MENU_PANEL: OpcionMenu[] = [
  { ruta: '/panel/dashboard', etiqueta: 'Dashboard', icono: HiOutlineChartBar, permiso: 'REPORTES_VER' },
  { ruta: '/panel/pedidos', etiqueta: 'Pedidos', icono: HiOutlineClipboardDocumentList, permiso: 'PEDIDOS_GESTIONAR' },
  { ruta: '/panel/reembolsos', etiqueta: 'Reembolsos', icono: HiOutlineArrowUturnLeft, permiso: 'PEDIDOS_GESTIONAR' },
  { ruta: '/panel/productos', etiqueta: 'Productos', icono: HiOutlineCube, permiso: 'CATALOGO_GESTIONAR' },
  { ruta: '/panel/categorias', etiqueta: 'Categorías', icono: HiOutlineSquares2X2, permiso: 'CATALOGO_GESTIONAR' },
  { ruta: '/panel/inventario', etiqueta: 'Inventario', icono: HiOutlineArchiveBox, permiso: 'INVENTARIO_GESTIONAR' },
  { ruta: '/panel/cupones', etiqueta: 'Cupones', icono: HiOutlineTicket, permiso: 'CUPONES_GESTIONAR' },
  { ruta: '/panel/usuarios', etiqueta: 'Usuarios', icono: HiOutlineUsers, permiso: 'USUARIOS_GESTIONAR' },
  { ruta: '/panel/bitacora', etiqueta: 'Bitácora', icono: HiOutlineDocumentMagnifyingGlass, permiso: 'BITACORA_VER' },
];
