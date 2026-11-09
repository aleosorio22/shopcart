import { QueryClient, QueryClientProvider, type UseQueryResult } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { Pagina } from '../api/tipos';
import { Consulta } from '../components/ui/Estados';
import { TablaDatos } from '../components/ui/TablaDatos';

const valorAuth = vi.hoisted(() => ({ actual: {} as Record<string, unknown> }));
vi.mock('../context/AuthContext', () => ({ useAuth: () => valorAuth.actual }));
const { RutaProtegida } = await import('../routes/RutaProtegida');

const envolver = (ui: ReactNode, ruta = '/') =>
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter initialEntries={[ruta]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );

const consulta = <T,>(parcial: Partial<UseQueryResult<T>>) => ({ data: undefined, isPending: false, isError: false, error: null, refetch: vi.fn(), ...parcial }) as UseQueryResult<T>;

describe('Consulta', () => {
  it('muestra carga, error con reintento y vacio', async () => {
    const { rerender } = render(<Consulta consulta={consulta<number[]>({ isPending: true })}>{() => 'datos'}</Consulta>);
    expect(screen.getByText('Cargando', { selector: 'p' })).toBeInTheDocument();

    const reintentar = vi.fn();
    rerender(<Consulta consulta={consulta<number[]>({ isError: true, error: new Error('x'), refetch: reintentar })}>{() => 'datos'}</Consulta>);
    await userEvent.click(screen.getByRole('button', { name: 'Reintentar' }));
    expect(reintentar).toHaveBeenCalled();

    rerender(
      <Consulta consulta={consulta<number[]>({ data: [] })} esVacio={(lista) => lista.length === 0} vacio="Sin datos">
        {() => 'datos'}
      </Consulta>,
    );
    expect(screen.getByText('Sin datos')).toBeInTheDocument();
  });
});

describe('TablaDatos', () => {
  const pagina: Pagina<{ id: number; nombre: string }> = { filas: [{ id: 1, nombre: 'Mouse' }], meta: { total: 30, pagina: 1, tamanoPagina: 15 } };

  it('pide al servidor la siguiente pagina y el orden', async () => {
    const alCambiarPagina = vi.fn();
    const alOrdenar = vi.fn();
    render(
      <TablaDatos
        columnas={[{ titulo: 'Nombre', celda: (fila) => fila.nombre, orden: { asc: 'NOMBRE_ASC', desc: 'NOMBRE_DESC' } }]}
        consulta={consulta({ data: pagina })}
        claveFila={(fila) => fila.id}
        alCambiarPagina={alCambiarPagina}
        orden="NOMBRE_ASC"
        alOrdenar={alOrdenar}
      />,
    );
    expect(screen.getByText('Mouse')).toBeInTheDocument();
    expect(screen.getByText('1 / 2')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Página siguiente' }));
    expect(alCambiarPagina).toHaveBeenCalledWith(2);
    await userEvent.click(screen.getByRole('button', { name: /Nombre/ }));
    expect(alOrdenar).toHaveBeenCalledWith('NOMBRE_DESC');
  });
});

describe('RutaProtegida', () => {
  const rutas = (permiso?: 'REPORTES_VER') => (
    <Routes>
      <Route path="/ingresar" element={<p>Pantalla de ingreso</p>} />
      <Route
        path="/panel"
        element={
          <RutaProtegida soloPersonal permiso={permiso}>
            <p>Contenido del panel</p>
          </RutaProtegida>
        }
      />
    </Routes>
  );

  it('manda a iniciar sesion a un visitante', () => {
    valorAuth.actual = { estado: 'anonimo', tienePermiso: () => false, esPersonal: false };
    envolver(rutas(), '/panel');
    expect(screen.getByText('Pantalla de ingreso')).toBeInTheDocument();
  });

  it('bloquea a un cliente aunque tenga sesion', () => {
    valorAuth.actual = { estado: 'autenticado', tienePermiso: () => false, esPersonal: false };
    envolver(rutas(), '/panel');
    expect(screen.getByText('No tienes acceso a esta sección')).toBeInTheDocument();
  });

  it('bloquea al operador sin el permiso de la pagina', () => {
    valorAuth.actual = { estado: 'autenticado', tienePermiso: () => false, esPersonal: true };
    envolver(rutas('REPORTES_VER'), '/panel');
    expect(screen.queryByText('Contenido del panel')).not.toBeInTheDocument();
  });

  it('deja pasar a quien tiene el permiso', () => {
    valorAuth.actual = { estado: 'autenticado', tienePermiso: (permiso: string) => permiso === 'REPORTES_VER', esPersonal: true };
    envolver(rutas('REPORTES_VER'), '/panel');
    expect(screen.getByText('Contenido del panel')).toBeInTheDocument();
  });
});
