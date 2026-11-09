import { ImagenProducto } from '../tienda/ImagenProducto';
import type { DetallePedido } from '../../services/pedidos.service';
import { quetzales } from '../../utils/formato';

/** Lineas, totales con desglose de IVA y datos de entrega: lo que quedo congelado al comprar. */
export function ResumenPedido({ detalle }: { detalle: DetallePedido }) {
  const { pedido, lineas } = detalle;
  const entrega = pedido.SucursalRecoger
    ? `Recoger en ${pedido.SucursalRecoger}`
    : [pedido.Destinatario, pedido.Linea1, pedido.Linea2, pedido.Municipio, pedido.Departamento].filter(Boolean).join(', ');

  return (
    <div className="space-y-8">
      <ul className="divide-y divide-linea/70 border-y border-linea/70">
        {lineas.map((linea) => (
          <li key={linea.IDPedidoDetalle} className="flex items-center gap-4 py-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-nube">
              <ImagenProducto nombre={linea.NombreProducto} />
            </div>
            <div className="flex-1">
              <p className="font-medium">{linea.NombreProducto}</p>
              <p className="text-[13px] text-tinta-tenue">
                SKU {linea.SKU} · {linea.Cantidad} × {quetzales(linea.PrecioUnitario)}
                {linea.CantidadDevuelta > 0 && <span className="text-alerta"> · {linea.CantidadDevuelta} devuelto(s)</span>}
              </p>
            </div>
            <span className="font-medium">{quetzales(linea.TotalLinea)}</span>
          </li>
        ))}
      </ul>

      <div className="grid gap-8 sm:grid-cols-2">
        <div className="space-y-1 text-[15px]">
          <h3 className="mb-2 font-semibold">Entrega</h3>
          <p className="text-tinta-suave">{pedido.MetodoEnvio}</p>
          <p className="text-tinta-suave">{entrega}</p>
          {pedido.Telefono && <p className="text-tinta-suave">Tel. {pedido.Telefono}</p>}
          <h3 className="mb-2 mt-5 font-semibold">Facturación</h3>
          <p className="text-tinta-suave">
            NIT {pedido.NITFactura}
            {pedido.NombreFactura ? ` · ${pedido.NombreFactura}` : ''}
          </p>
        </div>
        <dl className="space-y-2 text-[15px]">
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Subtotal</dt>
            <dd>{quetzales(pedido.Subtotal)}</dd>
          </div>
          {pedido.DescuentoCupon > 0 && (
            <div className="flex justify-between text-exito">
              <dt>Cupón {pedido.CodigoCupon}</dt>
              <dd>−{quetzales(pedido.DescuentoCupon)}</dd>
            </div>
          )}
          <div className="flex justify-between">
            <dt className="text-tinta-suave">Envío</dt>
            <dd>{pedido.CostoEnvio > 0 ? quetzales(pedido.CostoEnvio) : 'Gratis'}</dd>
          </div>
          <div className="flex justify-between border-t border-linea pt-2 text-[19px] font-semibold">
            <dt>Total</dt>
            <dd>{quetzales(pedido.Total)}</dd>
          </div>
          <div className="flex justify-between text-[13px] text-tinta-tenue">
            <dt>Base imponible</dt>
            <dd>{quetzales(pedido.BaseImponible)}</dd>
          </div>
          <div className="flex justify-between text-[13px] text-tinta-tenue">
            <dt>IVA 12 %</dt>
            <dd>{quetzales(pedido.IVA)}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
