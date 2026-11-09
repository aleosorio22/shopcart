import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { HiOutlineMapPin, HiPlus } from 'react-icons/hi2';
import { mensajeDe } from '../../api/error';
import { FormularioDireccion } from '../../components/tienda/FormularioDireccion';
import { Boton } from '../../components/ui/Boton';
import { Consulta, EstadoVacio } from '../../components/ui/Estados';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { CLAVE_DIRECCIONES, useDirecciones } from '../../hooks/useDirecciones';
import { clientesService, type Direccion } from '../../services/clientes.service';

export default function Direcciones() {
  const consulta = useDirecciones();
  const queryClient = useQueryClient();
  const [editando, setEditando] = useState<Direccion | 'nueva' | null>(null);

  const eliminar = useMutation({
    mutationFn: clientesService.eliminarDireccion,
    onSuccess: async () => {
      toast.success('Dirección eliminada');
      await queryClient.invalidateQueries({ queryKey: CLAVE_DIRECCIONES });
    },
    onError: (error) => toast.error(mensajeDe(error)),
  });

  return (
    <>
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-[32px] font-semibold">Direcciones.</h1>
        <Boton icono={<HiPlus />} onClick={() => setEditando('nueva')}>
          Agregar
        </Boton>
      </div>
      <Consulta
        consulta={consulta}
        esVacio={(lista) => lista.length === 0}
        vacio={<EstadoVacio icono={<HiOutlineMapPin />} titulo="No tienes direcciones guardadas" descripcion="Agrega una para pagar más rápido." />}
      >
        {(lista) => (
          <ul className="grid gap-4 sm:grid-cols-2">
            {lista.map((direccion) => (
              <li key={direccion.IDDireccion} className="flex flex-col gap-1 rounded-3xl bg-nube p-6">
                <div className="flex items-center gap-2">
                  <p className="text-[17px] font-semibold">{direccion.Alias}</p>
                  {direccion.EsPredeterminada && <Insignia tono="info">Predeterminada</Insignia>}
                </div>
                <p className="text-[15px] text-tinta-suave">{direccion.Destinatario}</p>
                <p className="text-[15px] text-tinta-suave">
                  {direccion.Linea1}
                  {direccion.Linea2 ? `, ${direccion.Linea2}` : ''}
                </p>
                <p className="text-[15px] text-tinta-suave">
                  {direccion.Municipio}, {direccion.Departamento} · {direccion.Telefono}
                </p>
                <div className="mt-3 flex gap-4 text-[14px]">
                  <button className="enlace" onClick={() => setEditando(direccion)}>
                    Editar
                  </button>
                  <button className="text-peligro hover:underline" disabled={eliminar.isPending} onClick={() => eliminar.mutate(direccion.IDDireccion)}>
                    Eliminar
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Consulta>
      <Modal abierto={editando !== null} alCerrar={() => setEditando(null)} titulo={editando === 'nueva' ? 'Nueva dirección' : 'Editar dirección'} ancho="lg">
        {editando !== null && <FormularioDireccion direccion={editando === 'nueva' ? undefined : editando} alGuardar={() => setEditando(null)} />}
      </Modal>
    </>
  );
}
