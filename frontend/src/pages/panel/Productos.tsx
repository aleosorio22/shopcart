import { keepPreviousData, useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { HiPlus } from 'react-icons/hi2';
import { useNavigate } from 'react-router-dom';
import { BarraFiltros, Encabezado } from '../../components/panel/Encabezado';
import { FormularioProducto } from '../../components/panel/FormularioProducto';
import { Boton } from '../../components/ui/Boton';
import { Campo, Selector } from '../../components/ui/Campo';
import { Insignia } from '../../components/ui/Insignia';
import { Modal } from '../../components/ui/Modal';
import { TablaDatos, type Columna } from '../../components/ui/TablaDatos';
import { useCategorias } from '../../hooks/useCatalogo';
import { useDebounce } from '../../hooks/useDebounce';
import { useFiltrosUrl } from '../../hooks/useFiltrosUrl';
import { catalogoService, type ProductoAdmin } from '../../services/catalogo.service';
import { fecha } from '../../utils/formato';

const COLUMNAS: Columna<ProductoAdmin>[] = [
  {
    titulo: 'Producto',
    celda: (producto) => (
      <div>
        <p className="font-medium">{producto.Nombre}</p>
        <p className="text-[12px] text-tinta-tenue">/{producto.Slug}</p>
      </div>
    ),
  },
  { titulo: 'Categoría', celda: (producto) => producto.Categoria, secundaria: true },
  { titulo: 'Marca', celda: (producto) => producto.Marca ?? '—', secundaria: true },
  { titulo: 'Variantes', celda: (producto) => producto.Variantes, alinear: 'derecha', secundaria: true },
  { titulo: 'Estado', celda: (producto) => (producto.Activo ? <Insignia tono="exito">Activo</Insignia> : <Insignia>Inactivo</Insignia>) },
  { titulo: 'Actualizado', celda: (producto) => fecha(producto.ActualizadoEn), secundaria: true },
];

export default function Productos() {
  const { valores, pagina, actualizar, irAPagina } = useFiltrosUrl({ texto: undefined as string | undefined, categoria: undefined as string | undefined, activo: undefined as string | undefined });
  const { data: categorias = [] } = useCategorias();
  const navegar = useNavigate();
  const [creando, setCreando] = useState(false);
  const [texto, setTexto] = useState(valores.texto ?? '');
  const textoListo = useDebounce(texto);
  useEffect(() => {
    if (textoListo !== (valores.texto ?? '')) actualizar({ texto: textoListo });
    // eslint-disable-next-line react/exhaustive-deps
  }, [textoListo]);

  const filtro = {
    pagina,
    tamanoPagina: 15,
    texto: valores.texto,
    idCategoria: valores.categoria ? Number(valores.categoria) : undefined,
    activo: valores.activo ? valores.activo === 'true' : undefined,
  };
  const consulta = useQuery({ queryKey: ['productos', 'admin', filtro], queryFn: () => catalogoService.listarAdmin(filtro), placeholderData: keepPreviousData });

  return (
    <>
      <Encabezado
        titulo="Productos"
        descripcion="Catálogo, variantes y precios."
        acciones={
          <Boton icono={<HiPlus />} onClick={() => setCreando(true)}>
            Nuevo producto
          </Boton>
        }
      />
      <BarraFiltros>
        <Campo etiqueta="Buscar" placeholder="Nombre o slug" value={texto} onChange={(evento) => setTexto(evento.target.value)} />
        <Selector etiqueta="Categoría" value={valores.categoria ?? ''} onChange={(evento) => actualizar({ categoria: evento.target.value })}>
          <option value="">Todas las categorías</option>
          {categorias.map((categoria) => (
            <option key={categoria.IDCategoria} value={categoria.IDCategoria}>
              {categoria.Nombre}
            </option>
          ))}
        </Selector>
        <Selector etiqueta="Estado" value={valores.activo ?? ''} onChange={(evento) => actualizar({ activo: evento.target.value })}>
          <option value="">Activos e inactivos</option>
          <option value="true">Activos</option>
          <option value="false">Inactivos</option>
        </Selector>
      </BarraFiltros>
      <TablaDatos
        columnas={COLUMNAS}
        consulta={consulta}
        claveFila={(producto) => producto.IDProducto}
        alCambiarPagina={irAPagina}
        alSeleccionar={(producto) => navegar(`/panel/productos/${producto.IDProducto}`, { state: producto })}
      />
      <Modal abierto={creando} alCerrar={() => setCreando(false)} titulo="Nuevo producto" ancho="lg">
        <FormularioProducto alGuardar={(id) => navegar(`/panel/productos/${id}`)} />
      </Modal>
    </>
  );
}
