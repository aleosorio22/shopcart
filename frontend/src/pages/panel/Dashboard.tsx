import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Encabezado } from '../../components/panel/Encabezado';
import { Indicador, Tarjeta } from '../../components/panel/Tarjeta';
import { Campo, Selector } from '../../components/ui/Campo';
import { Consulta, EstadoError, EstadoVacio } from '../../components/ui/Estados';
import { reportesService, type Agrupacion, type Rango } from '../../services/reportes.service';
import { entero, fecha, hace, isoLocal, quetzales } from '../../utils/formato';

const ACCION = '#0071e3';
const compacto = new Intl.NumberFormat('es-GT', { notation: 'compact', maximumFractionDigits: 1 });
const sinDatos = (filas: unknown[]) => filas.length === 0;

function Resumen({ rango }: { rango: Rango }) {
  const consulta = useQuery({ queryKey: ['reportes', 'resumen', rango], queryFn: () => reportesService.resumen(rango) });
  if (consulta.isError) return <EstadoError error={consulta.error} reintentar={() => void consulta.refetch()} />;
  const datos = consulta.data;
  const valor = (texto: string | undefined) => (consulta.isPending ? '—' : (texto ?? '—'));
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Indicador etiqueta="Ventas netas" valor={valor(datos && quetzales(datos.MontoNeto))} detalle="Pedidos completados, menos devoluciones" />
      <Indicador etiqueta="Pedidos completados" valor={valor(datos && entero(datos.NumeroPedidos))} />
      <Indicador etiqueta="Ticket promedio" valor={valor(datos && quetzales(datos.TicketPromedio))} />
      <Indicador
        etiqueta="Carritos abandonados"
        valor={valor(datos && entero(datos.CarritosAbandonados))}
        detalle={datos ? `${datos.VariantesBajoMinimo} variante(s) bajo mínimo` : undefined}
      />
    </div>
  );
}

function GraficaVentas({ rango }: { rango: Rango }) {
  const [agrupacion, setAgrupacion] = useState<Agrupacion>('DIA');
  const consulta = useQuery({ queryKey: ['reportes', 'ventas', rango, agrupacion], queryFn: () => reportesService.ventas(rango, agrupacion) });
  return (
    <Tarjeta className="lg:col-span-2">
      <div className="mb-4 flex items-center justify-between gap-4">
        <h2 className="text-[17px] font-semibold">Ventas por período</h2>
        <select
          aria-label="Agrupar por"
          value={agrupacion}
          onChange={(evento) => setAgrupacion(evento.target.value as Agrupacion)}
          className="rounded-full bg-white px-3 py-1.5 text-[14px] outline-none"
        >
          <option value="DIA">Por día</option>
          <option value="SEMANA">Por semana</option>
          <option value="MES">Por mes</option>
        </select>
      </div>
      <Consulta consulta={consulta} esVacio={sinDatos} vacio={<EstadoVacio titulo="Sin ventas en este rango" />}>
        {(ventas) => (
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={ventas.map((venta) => ({ periodo: fecha(venta.Periodo), monto: venta.MontoNeto, pedidos: Number(venta.NumeroPedidos) }))}>
                <defs>
                  <linearGradient id="relleno" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={ACCION} stopOpacity={0.25} />
                    <stop offset="100%" stopColor={ACCION} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid vertical={false} stroke="#e5e5ea" />
                <XAxis dataKey="periodo" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(valor: number) => `Q${compacto.format(valor)}`} tickLine={false} axisLine={false} fontSize={12} width={56} />
                <Tooltip formatter={(valor) => quetzales(Number(valor))} labelStyle={{ fontWeight: 600 }} contentStyle={{ borderRadius: 12, border: 'none' }} />
                <Area type="monotone" dataKey="monto" name="Ventas" stroke={ACCION} strokeWidth={2} fill="url(#relleno)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
      </Consulta>
    </Tarjeta>
  );
}

function GraficaCategorias({ rango }: { rango: Rango }) {
  const consulta = useQuery({ queryKey: ['reportes', 'categorias', rango], queryFn: () => reportesService.categorias(rango) });
  return (
    <Tarjeta titulo="Ventas por categoría">
      <Consulta consulta={consulta} esVacio={sinDatos} vacio={<EstadoVacio titulo="Sin ventas" />}>
        {(categorias) => (
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={categorias} layout="vertical" margin={{ left: 8 }}>
                <XAxis type="number" hide />
                <YAxis type="category" dataKey="Categoria" tickLine={false} axisLine={false} fontSize={12} width={90} />
                <Tooltip formatter={(valor) => quetzales(Number(valor))} cursor={{ fill: '#e8e8ed' }} contentStyle={{ borderRadius: 12, border: 'none' }} />
                <Bar dataKey="MontoNeto" name="Ventas" fill={ACCION} radius={[0, 6, 6, 0]} barSize={18} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </Consulta>
    </Tarjeta>
  );
}

function TopProductos({ rango }: { rango: Rango }) {
  const consulta = useQuery({ queryKey: ['reportes', 'top', rango], queryFn: () => reportesService.topProductos(rango, 5) });
  return (
    <Tarjeta titulo="Más vendidos">
      <Consulta consulta={consulta} esVacio={sinDatos} vacio={<EstadoVacio titulo="Sin ventas" />}>
        {(productos) => (
          <ol className="space-y-3">
            {productos.map((producto, indice) => (
              <li key={producto.IDProducto} className="flex items-center gap-3 text-[15px]">
                <span className="w-5 text-tinta-tenue">{indice + 1}</span>
                <span className="flex-1">{producto.Nombre}</span>
                <span className="text-tinta-suave">{entero(producto.Unidades)} u.</span>
                <span className="w-28 text-right font-medium">{quetzales(producto.MontoNeto)}</span>
              </li>
            ))}
          </ol>
        )}
      </Consulta>
    </Tarjeta>
  );
}

function Margen({ rango }: { rango: Rango }) {
  const consulta = useQuery({ queryKey: ['reportes', 'margen', rango], queryFn: () => reportesService.margen(rango, { tamanoPagina: 5 }) });
  return (
    <Tarjeta titulo="Margen bruto">
      <Consulta consulta={consulta} esVacio={(pagina) => pagina.filas.length === 0} vacio={<EstadoVacio titulo="Sin ventas" />}>
        {(pagina) => (
          <ul className="space-y-3 text-[15px]">
            {pagina.filas.map((producto) => (
              <li key={producto.IDProducto} className="flex items-center justify-between gap-3">
                <span className="flex-1">{producto.Nombre}</span>
                <span className="text-tinta-suave">{producto.Venta ? `${Math.round((producto.MargenBruto / producto.Venta) * 100)} %` : '—'}</span>
                <span className="w-28 text-right font-medium">{quetzales(producto.MargenBruto)}</span>
              </li>
            ))}
          </ul>
        )}
      </Consulta>
    </Tarjeta>
  );
}

export default function Dashboard() {
  const [rango, setRango] = useState<Rango>(() => ({ desde: hace(30), hasta: isoLocal(new Date()) }));
  const [preset, setPreset] = useState('30');
  const invalido = rango.desde > rango.hasta;

  const elegirPreset = (dias: string) => {
    setPreset(dias);
    if (dias) setRango({ desde: hace(Number(dias)), hasta: isoLocal(new Date()) });
  };

  const cambiarFecha = (cambio: Partial<Rango>) => {
    setPreset('');
    setRango((actual) => ({ ...actual, ...cambio }));
  };

  return (
    <>
      <Encabezado
        titulo="Dashboard"
        descripcion="Cifras en hora de Guatemala, sobre pedidos completados."
        acciones={
          <div className="grid grid-cols-3 gap-2 [&_label]:sr-only">
            <Selector etiqueta="Período" value={preset} onChange={(evento) => elegirPreset(evento.target.value)}>
              <option value="7">7 días</option>
              <option value="30">30 días</option>
              <option value="90">90 días</option>
              <option value="365">12 meses</option>
              <option value="">Personalizado</option>
            </Selector>
            <Campo etiqueta="Desde" type="date" value={rango.desde} onChange={(evento) => cambiarFecha({ desde: evento.target.value })} />
            <Campo etiqueta="Hasta" type="date" value={rango.hasta} onChange={(evento) => cambiarFecha({ hasta: evento.target.value })} />
          </div>
        }
      />
      {invalido ? (
        <EstadoVacio titulo="Rango inválido" descripcion="La fecha inicial no puede ser posterior a la final." />
      ) : (
        <div className="space-y-4">
          <Resumen rango={rango} />
          <div className="grid gap-4 lg:grid-cols-3">
            <GraficaVentas rango={rango} />
            <GraficaCategorias rango={rango} />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            <TopProductos rango={rango} />
            <Margen rango={rango} />
          </div>
        </div>
      )}
    </>
  );
}
