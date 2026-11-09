import type { IconType } from 'react-icons';
import { HiOutlineComputerDesktop, HiOutlineDevicePhoneMobile, HiOutlineShoppingBag } from 'react-icons/hi2';
import { PiHeadphonesLight, PiMouseSimpleLight, PiTShirtLight } from 'react-icons/pi';

const ICONOS: [RegExp, IconType][] = [
  [/notebook|computa|laptop/i, HiOutlineComputerDesktop],
  [/celular|telefono|phone/i, HiOutlineDevicePhoneMobile],
  [/audio|audifono/i, PiHeadphonesLight],
  [/accesorio|mouse/i, PiMouseSimpleLight],
  [/ropa|playera/i, PiTShirtLight],
];

interface Props {
  url?: string | null;
  nombre: string;
  categoria?: string | null;
  className?: string;
}

/** Usa la foto del producto; si no tiene, dibuja un icono sobrio segun su categoria. */
export function ImagenProducto({ url, nombre, categoria, className = '' }: Props) {
  if (url) return <img src={url} alt={nombre} loading="lazy" className={`h-full w-full object-contain ${className}`} />;
  const Icono = ICONOS.find(([patron]) => patron.test(`${categoria ?? ''} ${nombre}`))?.[1] ?? HiOutlineShoppingBag;
  return (
    <div className={`flex h-full w-full items-center justify-center bg-gradient-to-b from-[#fbfbfd] to-nube ${className}`}>
      <Icono className="h-2/5 w-2/5 text-tinta/70" strokeWidth={1} aria-hidden />
      <span className="sr-only">{nombre}</span>
    </div>
  );
}
