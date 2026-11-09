import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { Campo, Selector } from '../../components/ui/Campo';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { Insignia } from '../../components/ui/Insignia';
import { Paginacion } from '../../components/ui/Paginacion';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { reportesService, type RegistroBitacora } from '../../services/reportes.service';
import { fechaYHora } from '../../utils/formato';

const MODULOS = ['CATALOGO', 'INVENTARIO', 'PEDIDOS', 'CUPONES', 'USUARIOS', 'SEGURIDAD', 'MARKETING', 'CONFIGURACION'];

function json(valor: string | null): Record<string, unknown> {
  if (!valor) return {};
  try {
    return JSON.parse(valor) as Record<string, unknown>;
  } catch {
    return { valor };
  }
}

/** Muestra solo los campos que cambiaron entre el valor anterior y el nuevo. */
function Cambios({ registro }: { registro: RegistroBitacora }) {
  const antes = json(registro.ValorAnterior);
  const despues = json(registro.ValorNuevo);
  const campos = [...new Set([...Object.keys(antes), ...Object.keys(despues)])].filter((campo) => JSON.stringify(antes[campo]) !== JSON.stringify(despues[campo]));
  if (campos.length === 0) return <p className="text-tinta-tenue">Sin cambios de valores.</p>;
  return (
    <dl className="grid grid-cols-[auto_1fr_1fr] gap-x-4 gap-y-1 text-[13px]">
      <dt className="font-medium text-tinta-suave">Campo</dt>
      <dd className="font-medium text-tinta-suave">Antes</dd>
      <dd className="font-medium text-tinta-suave">Después</dd>
      {campos.map((campo) => (
        <Fragment key={campo}>
          <dt>{campo}</dt>
          <dd className="break-all text-peligro">{antes[campo] === undefined ? '—' : String(antes[campo])}</dd>
          <dd className="break-all text-exito">{despues[campo] === undefined ? '—' : String(despues[campo])}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

export default function Bitacora() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ modulo: undefined as string | undefined, desde: undefined as string | undefined, hasta: undefined as string | undefined });
  const [abierto, setAbierto] = useState<string | null>(null);
  const filtro = {
    pagina,
    tamanoPagina: 20,
    modulo: valores.modulo,
    desde: valores.desde ? new Date(`${valores.desde}T00:00:00`).toISOString() : undefined,
    hasta: valores.hasta ? new Date(`${valores.hasta}T23:59:59.999`).toISOString() : undefined,
  };
  const consulta = useQuery({ queryKey: ['bitacora', filtro], queryFn: () => reportesService.bitacora(filtro), placeholderData: keepPreviousData });

  return (
    <>
      <Encabezado titulo="Bitácora" descripcion="Registro inmutable de cada cambio: quién, cuándo, qué había antes y qué quedó." />
      <BarraFiltros>
        <Selector etiqueta="Módulo" value={valores.modulo ?? ''} onChange={(evento) => actualizar({ modulo: evento.target.value })}>
          <option value="">Todos los módulos</option>
          {MODULOS.map((modulo) => (
            <option key={modulo} value={modulo}>
              {modulo.charAt(0) + modulo.slice(1).toLowerCase()}
            </option>
          ))}
        </Selector>
        <Campo etiqueta="Desde" type="date" value={valores.desde ?? ''} onChange={(evento) => actualizar({ desde: evento.target.value })} />
        <Campo etiqueta="Hasta" type="date" value={valores.hasta ?? ''} onChange={(evento) => actualizar({ hasta: evento.target.value })} />
      </BarraFiltros>
      <Consulta consulta={consulta} esVacio={(resultado) => resultado.filas.length === 0} vacio={<EstadoVacio titulo="Sin registros" descripcion="Prueba con otro módulo o rango." />}>
        {(resultado) => (
          <div className={consulta.isPlaceholderData ? 'opacity-60' : ''}>
            <ul className="divide-y divide-linea/70 rounded-2xl border border-linea/70">
              {resultado.filas.map((registro) => (
                <li key={registro.IDBitacora}>
                  <button
                    className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-left text-[14px] hover:bg-nube/60"
                    aria-expanded={abierto === registro.IDBitacora}
                    onClick={() => setAbierto(abierto === registro.IDBitacora ? null : registro.IDBitacora)}
                  >
                    <span className="w-40 shrink-0 text-tinta-suave">{fechaYHora(registro.Fecha)}</span>
                    <Insignia tono={registro.Accion === 'ELIMINAR' ? 'peligro' : registro.Accion === 'CREAR' ? 'exito' : 'info'}>{registro.Accion}</Insignia>
                    <span className="flex-1 font-medium">
                      {registro.Entidad} #{registro.IDEntidad}
                    </span>
                    <span className="text-tinta-suave">{registro.CorreoUsuario ?? 'Sistema'}</span>
                  </button>
                  {abierto === registro.IDBitacora && (
                    <div className="bg-nube/50 px-4 py-4">
                      <Cambios registro={registro} />
                    </div>
                  )}
                </li>
              ))}
            </ul>
            <Paginacion meta={resultado.meta} alCambiar={irAPagina} />
          </div>
        )}
      </Consulta>
    </>
  );
}
