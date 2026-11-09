import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineCheckBadge, HiOutlineExclamationTriangle } from 'react-icons/hi2';
import { mensajeDe } from '../../api/error';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { Boton } from '../../components/ui/Boton';
import { Campo, Casilla, Selector } from '../../components/ui/Campo';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useDebounce } from '../../hooks/useDebounce';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { inventarioService, type Existencia, type MovimientoKardex } from '../../services/inventario.service';
import { entero, fechaYHora, quetzales } from '../../utils/formato';

type TipoMovimiento = 'entrada' | 'ajuste' | 'traslado';
const ETIQUETA_MOVIMIENTO: Record<TipoMovimiento, string> = { entrada: 'Entrada por compra', ajuste: 'Ajuste', traslado: 'Traslado' };

const useBodegas = () => useQuery({ queryKey: ['bodegas'], queryFn: inventarioService.bodegas, staleTime: 10 * 60_000 });

/** Entrada, ajuste o traslado: cada uno genera su movimiento en el kardex dentro de una transaccion. */
function Movimiento({ existencia, alTerminar }: { existencia: Existencia; alTerminar: () => void }) {
  const queryClient = useQueryClient();
  const { data: bodegas = [] } = useBodegas();
  const [tipo, setTipo] = useState<TipoMovimiento>('entrada');
  const [cantidad, setCantidad] = useState('');
  const [costo, setCosto] = useState(String(existencia.CostoPromedio || ''));
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [documento, setDocumento] = useState('');

  const numero = Number(cantidad);
  const cantidadValida = Number.isInteger(numero) && (tipo === 'ajuste' ? numero !== 0 : numero > 0);
  const valido =
    cantidadValida &&
    (tipo !== 'entrada' || (costo !== '' && Number(costo) >= 0)) &&
    (tipo === 'entrada' || motivo.trim().length > 0) &&
    (tipo !== 'traslado' || Boolean(destino));

  const registrar = useMutation({
    mutationFn: () => {
      const base = { idVariante: existencia.IDVariante, cantidad: numero };
      if (tipo === 'entrada')
        return inventarioService.entrada({ ...base, idBodega: existencia.IDBodega, costoUnitario: Number(costo), motivo: motivo.trim() || undefined, referenciaDocumento: documento.trim() || undefined });
      if (tipo === 'ajuste') return inventarioService.ajuste({ ...base, idBodega: existencia.IDBodega, motivo: motivo.trim() });
      return inventarioService.traslado({ ...base, idBodegaOrigen: existencia.IDBodega, idBodegaDestino: Number(destino), motivo: motivo.trim() });
    },
    onSuccess: async () => {
      toast.success('Movimiento registrado en el kardex');
      await queryClient.invalidateQueries({ queryKey: ['inventario'] });
      alTerminar();
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <div className="space-y-5">
      <p className="text-[15px] text-tinta-suave">
        {existencia.NombreProducto} · {existencia.SKU} en {existencia.NombreBodega}. Disponible: {existencia.Disponible} (reservado {existencia.Reservada}).
      </p>
      <div className="flex gap-1 rounded-full bg-nube p-1" role="tablist" aria-label="Tipo de movimiento">
        {(Object.keys(ETIQUETA_MOVIMIENTO) as TipoMovimiento[]).map((opcion) => (
          <button
            key={opcion}
            role="tab"
            aria-selected={tipo === opcion}
            onClick={() => setTipo(opcion)}
            className={`flex-1 rounded-full px-3 py-1.5 text-[14px] ${tipo === opcion ? 'bg-white font-medium shadow-sm' : 'text-tinta-suave'}`}
          >
            {ETIQUETA_MOVIMIENTO[opcion]}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo
          etiqueta={tipo === 'ajuste' ? 'Cantidad (+ suma, − resta)' : 'Cantidad'}
          type="number"
          step={1}
          value={cantidad}
          onChange={(evento) => setCantidad(evento.target.value)}
          error={cantidad && !cantidadValida ? (tipo === 'ajuste' ? 'Entero distinto de cero' : 'Entero mayor que cero') : undefined}
        />
        {tipo === 'entrada' && <Campo etiqueta="Costo unitario (Q)" type="number" min={0} step="0.01" value={costo} onChange={(evento) => setCosto(evento.target.value)} />}
        {tipo === 'traslado' && (
          <Selector etiqueta="Bodega destino" value={destino} onChange={(evento) => setDestino(evento.target.value)}>
            <option value="">Elige una</option>
            {bodegas
              .filter((bodega) => bodega.IDBodega !== existencia.IDBodega && bodega.Activo)
              .map((bodega) => (
                <option key={bodega.IDBodega} value={bodega.IDBodega}>
                  {bodega.Nombre}
                </option>
              ))}
          </Selector>
        )}
        {tipo === 'entrada' && <Campo etiqueta="Documento (opcional)" placeholder="Factura del proveedor" value={documento} maxLength={60} onChange={(evento) => setDocumento(evento.target.value)} />}
        <div className={tipo === 'entrada' ? '' : 'sm:col-span-2'}>
          <Campo etiqueta={tipo === 'entrada' ? 'Motivo (opcional)' : 'Motivo (obligatorio)'} value={motivo} maxLength={300} onChange={(evento) => setMotivo(evento.target.value)} />
        </div>
      </div>
      <Boton className="w-full" disabled={!valido} cargando={registrar.isPending} onClick={() => registrar.mutate()}>
        Registrar {ETIQUETA_MOVIMIENTO[tipo].toLowerCase()}
      </Boton>
    </div>
  );
}

function Existencias() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ vista: undefined as string | undefined, texto: undefined as string | undefined, bodega: undefined as string | undefined, bajo: undefined as string | undefined });
  const { data: bodegas = [] } = useBodegas();
  const [moviendo, setMoviendo] = useState<Existencia | null>(null);
  const [texto, setTexto] = useState(valores.texto ?? '');
  const textoListo = useDebounce(texto);
  useEffect(() => {
    if (textoListo !== (valores.texto ?? '')) actualizar({ texto: textoListo });
    // eslint-disable-next-line react/exhaustive-deps
  }, [textoListo]);

  const filtro = { pagina, tamanoPagina: 15, texto: valores.texto, idBodega: valores.bodega ? Number(valores.bodega) : undefined, soloBajoMinimo: valores.bajo === 'true' || undefined };
  const consulta = useQuery({ queryKey: ['inventario', 'existencias', filtro], queryFn: () => inventarioService.existencias(filtro), placeholderData: keepPreviousData });

  const columnas: Columna<Existencia>[] = [
    {
      titulo: 'Producto',
      celda: (fila) => (
        <div>
          <p className="font-medium">{fila.NombreProducto}</p>
          <p className="text-[12px] text-tinta-tenue">{fila.SKU}</p>
        </div>
      ),
    },
    { titulo: 'Bodega', celda: (fila) => fila.NombreBodega, secundaria: true },
    { titulo: 'Física', celda: (fila) => entero(fila.Fisica), alinear: 'derecha', secundaria: true },
    { titulo: 'Reservada', celda: (fila) => entero(fila.Reservada), alinear: 'derecha', secundaria: true },
    {
      titulo: 'Disponible',
      alinear: 'derecha',
      celda: (fila) => (fila.Disponible <= fila.StockMinimo ? <Insignia tono="alerta">{entero(fila.Disponible)}</Insignia> : entero(fila.Disponible)),
    },
    { titulo: 'Costo prom.', celda: (fila) => quetzales(fila.CostoPromedio), alinear: 'derecha', secundaria: true },
    {
      titulo: 'Acción',
      alinear: 'derecha',
      celda: (fila) => (
        <Boton tamano="sm" variante="secundario" onClick={() => setMoviendo(fila)}>
          Movimiento
        </Boton>
      ),
    },
  ];

  return (
    <>
      <BarraFiltros>
        <Campo etiqueta="Buscar" placeholder="Producto o SKU" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
        <Selector etiqueta="Bodega" value={valores.bodega ?? ''} onChange={(evento) => actualizar({ bodega: evento.target.value })}>
          <option value="">Todas las bodegas</option>
          {bodegas.map((bodega) => (
            <option key={bodega.IDBodega} value={bodega.IDBodega}>
              {bodega.Nombre}
            </option>
          ))}
        </Selector>
        <div className="flex items-center">
          <Casilla etiqueta="Solo bajo mínimo" checked={valores.bajo === 'true'} onChange={(evento) => actualizar({ bajo: evento.target.checked ? 'true' : undefined })} />
        </div>
      </BarraFiltros>
      <TablaDatos columnas={columnas} consulta={consulta} claveFila={(fila) => `${fila.IDVariante}-${fila.IDBodega}`} alCambiarPagina={irAPagina} />
      <Modal abierto={moviendo !== null} alCerrar={() => setMoviendo(null)} titulo="Registrar movimiento" ancho="lg">
        {moviendo && <Movimiento existencia={moviendo} alTerminar={() => setMoviendo(null)} />}
      </Modal>
    </>
  );
}

const COLUMNAS_KARDEX: Columna<MovimientoKardex>[] = [
  { titulo: 'Fecha', celda: (fila) => fechaYHora(fila.Fecha) },
  { titulo: 'SKU', celda: (fila) => fila.SKU },
  { titulo: 'Bodega', celda: (fila) => fila.Bodega, secundaria: true },
  { titulo: 'Movimiento', celda: (fila) => <span className="text-[13px]">{fila.TipoMovimiento.replaceAll('_', ' ').toLowerCase()}</span> },
  {
    titulo: 'Cantidad',
    alinear: 'derecha',
    celda: (fila) => <span className={fila.Cantidad < 0 ? 'text-peligro' : 'text-exito'}>{fila.Cantidad > 0 ? `+${fila.Cantidad}` : fila.Cantidad}</span>,
  },
  { titulo: 'Saldo', celda: (fila) => `${fila.SaldoAnterior} → ${fila.SaldoNuevo}`, alinear: 'derecha', secundaria: true },
  {
    titulo: 'Detalle',
    secundaria: true,
    celda: (fila) => (
      <div className="text-[13px]">
        <p>{fila.Motivo ?? '—'}</p>
        <p className="text-tinta-tenue">{fila.CorreoUsuario}</p>
      </div>
    ),
  },
];

function Kardex() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ vista: undefined as string | undefined, bodega: undefined as string | undefined, desde: undefined as string | undefined, hasta: undefined as string | undefined });
  const { data: bodegas = [] } = useBodegas();
  const conciliacion = useQuery({ queryKey: ['inventario', 'conciliacion'], queryFn: inventarioService.conciliacion });
  // Los filtros de fecha del kardex son instantes: el dia completo en hora local.
  const filtro = {
    pagina,
    tamanoPagina: 20,
    idBodega: valores.bodega ? Number(valores.bodega) : undefined,
    desde: valores.desde ? new Date(`${valores.desde}T00:00:00`).toISOString() : undefined,
    hasta: valores.hasta ? new Date(`${valores.hasta}T23:59:59.999`).toISOString() : undefined,
  };
  const consulta = useQuery({ queryKey: ['inventario', 'kardex', filtro], queryFn: () => inventarioService.kardex(filtro), placeholderData: keepPreviousData });

  return (
    <>
      {conciliacion.data && (
        <p className={`mb-4 flex items-center gap-2 text-[14px] ${conciliacion.data.cuadrado ? 'text-exito' : 'text-peligro'}`}>
          {conciliacion.data.cuadrado ? <HiOutlineCheckBadge aria-hidden /> : <HiOutlineExclamationTriangle aria-hidden />}
          {conciliacion.data.cuadrado ? 'La existencia cuadra con el kardex.' : `Hay ${conciliacion.data.diferencias.length} diferencia(s) entre existencia y kardex.`}
        </p>
      )}
      <BarraFiltros>
        <Selector etiqueta="Bodega" value={valores.bodega ?? ''} onChange={(evento) => actualizar({ bodega: evento.target.value })}>
          <option value="">Todas las bodegas</option>
          {bodegas.map((bodega) => (
            <option key={bodega.IDBodega} value={bodega.IDBodega}>
              {bodega.Nombre}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Desde" type="date" value={valores.desde ?? ''} onChange={(evento) => actualizar({ desde: evento.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={valores.hasta ?? ''} onChange={(evento) => actualizar({ hasta: evento.target.value })} />
      </BarraFiltros>
      <TablaDatos columnas={COLUMNAS_KARDEX} consulta={consulta} claveFila={(fila) => fila.IDKardex} alCambiarPagina={irAPagina} />
    </>
  );
}

export default function Inventario() {
  const { valores, actualizar } = useFiltrosUrl({ vista: 'existencias' as string | undefined });
  const vista = valores.vista === 'kardex' ? 'kardex' : 'existencias';
  return (
    <>
      <Encabezado titulo="Inventario" descripcion="Existencia por bodega y kardex inmutable de cada movimiento." />
      <div className="mb-6 inline-flex gap-1 rounded-full bg-nube p-1" role="tablist" aria-label="Vista">
        {(['existencias', 'kardex'] as const).map((opcion) => (
          <button
            key={opcion}
            role="tab"
            aria-selected={vista === opcion}
            onClick={() => actualizar({ vista: opcion === 'existencias' ? undefined : opcion })}
            className={`rounded-full px-5 py-1.5 text-[14px] capitalize ${vista === opcion ? 'bg-white font-medium shadow-sm' : 'text-tinta-suave'}`}
          >
            {opcion}
          </button>
        ))}
      </div>
      {vista === 'existencias' ? <Existencias /> : <Kardex />}
    </>
  );
}
