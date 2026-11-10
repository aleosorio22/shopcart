import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState, type DragEvent } from 'react';
import toast from 'react-hot-toast';
import { HiOutlinePhoto, HiOutlineTrash } from 'react-icons/hi2';
import { mensajeDe } from '../../api/error';
import { catalogoService, type DetalleProducto } from '../../services/catalogo.service';
import { Boton } from '../ui/Boton';
import { Campo, Selector } from '../ui/Campo';

const TIPOS = ['image/jpeg', 'image/png', 'image/webp'];
const MAXIMO = 5 * 1024 * 1024;

/** Valida en el navegador para avisar rapido; el servidor vuelve a validar por la firma del archivo. */
function revisar(archivo: File): string | undefined {
  if (!TIPOS.includes(archivo.type)) return 'Usa una imagen JPG, PNG o WEBP.';
  if (archivo.size > MAXIMO) return 'La imagen no puede pesar más de 5 MB.';
  return undefined;
}

interface Props {
  idProducto: number;
  nombreProducto: string;
  imagenes: DetalleProducto['imagenes'];
  variantes: DetalleProducto['variantes'];
}

export function GestorImagenes({ idProducto, nombreProducto, imagenes, variantes }: Props) {
  const queryClient = useQueryClient();
  const idEntrada = useId();
  const entrada = useRef<HTMLInputElement>(null);
  const [archivo, setArchivo] = useState<File>();
  const [vista, setVista] = useState<string>();
  const [error, setError] = useState<string>();
  const [textoAlt, setTextoAlt] = useState('');
  const [idVariante, setIdVariante] = useState('');
  const [arrastrando, setArrastrando] = useState(false);

  const elegir = (nuevo?: File) => {
    if (!nuevo) return;
    const problema = revisar(nuevo);
    setError(problema);
    if (vista) URL.revokeObjectURL(vista);
    setArchivo(problema ? undefined : nuevo);
    setVista(problema ? undefined : URL.createObjectURL(nuevo));
  };

  const limpiar = () => {
    if (vista) URL.revokeObjectURL(vista);
    setArchivo(undefined);
    setVista(undefined);
    setTextoAlt('');
    setIdVariante('');
    if (entrada.current) entrada.current.value = '';
  };

  const refrescar = async () => {
    await queryClient.invalidateQueries({ queryKey: ['producto'] });
    await queryClient.invalidateQueries({ queryKey: ['productos'] });
  };

  // Dos pasos: el archivo se guarda en el servidor y su URL se asocia al producto.
  const subir = useMutation({
    mutationFn: async () => {
      const { url } = await catalogoService.subirArchivo(archivo!);
      const orden = imagenes.reduce((mayor, imagen) => Math.max(mayor, imagen.Orden + 1), 0);
      await catalogoService.agregarImagen(idProducto, { url, textoAlt: textoAlt.trim() || nombreProducto, idVariante: idVariante ? Number(idVariante) : undefined, orden });
    },
    onSuccess: async () => {
      toast.success('Imagen agregada');
      limpiar();
      await refrescar();
    },
    onError: (fallo) => setError(mensajeDe(fallo)),
  });

  const quitar = useMutation({
    mutationFn: catalogoService.eliminarImagen,
    onSuccess: async () => {
      toast.success('Imagen quitada');
      await refrescar();
    },
    onError: (fallo) => toast.error(mensajeDe(fallo)),
  });

  const soltar = (evento: DragEvent) => {
    evento.preventDefault();
    setArrastrando(false);
    elegir(evento.dataTransfer.files[0]);
  };

  const varianteDe = (id: number | null) => variantes.find((variante) => variante.IDVariante === id)?.SKU;

  return (
    <div className="space-y-6">
      {imagenes.length > 0 ? (
        <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {imagenes.map((imagen, indice) => (
            <li key={imagen.IDImagenProducto} className="group relative overflow-hidden rounded-2xl bg-white">
              <img src={imagen.Url} alt={imagen.TextoAlt ?? ''} className="aspect-square w-full object-cover" />
              <div className="flex items-center justify-between gap-2 p-2.5 text-[12px] text-tinta-suave">
                <span className="truncate">{indice === 0 ? 'Principal' : (varianteDe(imagen.IDVariante) ?? 'General')}</span>
                <button
                  onClick={() => quitar.mutate(imagen.IDImagenProducto)}
                  disabled={quitar.isPending}
                  aria-label={`Quitar imagen ${imagen.TextoAlt ?? indice + 1}`}
                  className="rounded-full p-1.5 text-peligro hover:bg-peligro/10"
                >
                  <HiOutlineTrash />
                </button>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-[14px] text-tinta-suave">Este producto aún no tiene fotos; la tienda muestra un ícono de su categoría.</p>
      )}

      <div className="grid gap-4 rounded-2xl bg-white p-5 md:grid-cols-[220px_1fr]">
        {/* Arrastrar es un atajo; el input de archivo dentro de la etiqueta es el camino accesible con teclado. */}
        {/* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */}
        <label
          htmlFor={idEntrada}
          onDragOver={(evento) => {
            evento.preventDefault();
            setArrastrando(true);
          }}
          onDragLeave={() => setArrastrando(false)}
          onDrop={soltar}
          className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-2 overflow-hidden rounded-2xl border-2 border-dashed text-center text-[13px] text-tinta-suave transition-colors ${arrastrando ? 'border-accion bg-accion/5' : 'border-linea hover:border-tinta-tenue'}`}
        >
          {vista ? (
            <img src={vista} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <>
              <HiOutlinePhoto className="text-3xl" aria-hidden />
              <span>
                Arrastra una foto o <span className="text-enlace">elígela</span>
              </span>
              <span className="text-tinta-tenue">JPG, PNG o WEBP, hasta 5 MB</span>
            </>
          )}
          <input id={idEntrada} ref={entrada} type="file" accept={TIPOS.join(',')} className="sr-only" onChange={(evento) => elegir(evento.target.files?.[0])} />
        </label>
        <div className="flex flex-col gap-4">
          <Campo etiqueta="Descripción de la foto" placeholder={nombreProducto} value={textoAlt} maxLength={200} onChange={(evento) => setTextoAlt(evento.target.value)} ayuda="La leen los lectores de pantalla y los buscadores." />
          <Selector etiqueta="Mostrar con" value={idVariante} onChange={(evento) => setIdVariante(evento.target.value)}>
            <option value="">Todas las variantes</option>
            {variantes.map((variante) => (
              <option key={variante.IDVariante} value={variante.IDVariante}>
                Solo {variante.SKU}
              </option>
            ))}
          </Selector>
          {error && (
            <p role="alert" className="text-[13px] text-peligro">
              {error}
            </p>
          )}
          <div className="mt-auto flex gap-2">
            <Boton disabled={!archivo} cargando={subir.isPending} onClick={() => subir.mutate()}>
              Subir imagen
            </Boton>
            {archivo && (
              <Boton variante="secundario" onClick={limpiar} disabled={subir.isPending}>
                Descartar
              </Boton>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
