import type { UseQueryResult } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { HiChevronDown, HiChevronUp, HiChevronUpDown } from 'react-icons/hi2';
import type { Pagina } from '../../api/tipos';
import { Consulta, EstadoVacio } from './Estados';
import { Paginacion } from './Paginacion';

export interface Columna<T> {
  titulo: string;
  celda: (fila: T) => ReactNode;
  /** Valores de `orden` que entiende el backend para esta columna. */
  orden?: { asc: string; desc: string };
  alinear?: 'izquierda' | 'derecha';
  /** En pantallas chicas se ocultan las columnas secundarias. */
  secundaria?: boolean;
}

interface PropsTabla<T> {
  columnas: Columna<T>[];
  consulta: UseQueryResult<Pagina<T>>;
  claveFila: (fila: T) => string | number;
  alCambiarPagina: (pagina: number) => void;
  orden?: string;
  alOrdenar?: (orden: string) => void;
  alSeleccionar?: (fila: T) => void;
  vacio?: ReactNode;
}

/**
 * Tabla generica: la paginacion, el orden y los filtros los resuelve el servidor.
 * Solo dibuja la pagina recibida y avisa al padre cuando el usuario pide otra.
 */
export function TablaDatos<T>({ columnas, consulta, claveFila, alCambiarPagina, orden, alOrdenar, alSeleccionar, vacio }: PropsTabla<T>) {
  const alinear = (columna: Columna<T>) => (columna.alinear === 'derecha' ? 'text-right' : 'text-left');
  const ocultar = (columna: Columna<T>) => (columna.secundaria ? 'hidden md:table-cell' : '');

  const encabezado = (columna: Columna<T>) => {
    if (!columna.orden || !alOrdenar) return columna.titulo;
    const { asc, desc } = columna.orden;
    const activo = orden === asc ? 'asc' : orden === desc ? 'desc' : null;
    const Icono = activo === 'asc' ? HiChevronUp : activo === 'desc' ? HiChevronDown : HiChevronUpDown;
    return (
      <button className="inline-flex items-center gap-1 hover:text-tinta" onClick={() => alOrdenar(activo === 'desc' ? asc : desc)}>
        {columna.titulo}
        <Icono aria-hidden className={activo ? 'text-tinta' : 'opacity-40'} />
      </button>
    );
  };

  return (
    <Consulta consulta={consulta} esVacio={(pagina) => pagina.filas.length === 0} vacio={vacio ?? <EstadoVacio titulo="Sin resultados" descripcion="Prueba con otros filtros." />}>
      {(pagina) => (
        <div className={consulta.isPlaceholderData ? 'opacity-60 transition-opacity' : 'transition-opacity'}>
          <div className="overflow-x-auto rounded-2xl border border-linea/70">
            <table className="w-full text-[14px]">
              <thead className="bg-nube/70 text-[12px] font-medium uppercase tracking-wide text-tinta-suave">
                <tr>
                  {columnas.map((columna) => (
                    <th
                      key={columna.titulo}
                      scope="col"
                      aria-sort={columna.orden && orden ? (orden === columna.orden.asc ? 'ascending' : orden === columna.orden.desc ? 'descending' : 'none') : undefined}
                      className={`px-4 py-3 font-medium ${alinear(columna)} ${ocultar(columna)}`}
                    >
                      {encabezado(columna)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-linea/60">
                {pagina.filas.map((fila) => (
                  <tr
                    key={claveFila(fila)}
                    onClick={alSeleccionar ? () => alSeleccionar(fila) : undefined}
                    className={alSeleccionar ? 'cursor-pointer hover:bg-nube/60' : ''}
                  >
                    {columnas.map((columna) => (
                      <td key={columna.titulo} className={`px-4 py-3 align-middle ${alinear(columna)} ${ocultar(columna)}`}>
                        {columna.celda(fila)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Paginacion meta={pagina.meta} alCambiar={alCambiarPagina} />
        </div>
      )}
    </Consulta>
  );
}
