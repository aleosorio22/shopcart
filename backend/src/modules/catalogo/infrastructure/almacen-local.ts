import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AlmacenImagenes, FormatoImagen } from '../domain/catalogo.js';

/**
 * Guarda las imagenes en una carpeta del servidor, servida como estatica.
 * Suficiente para la demo; en produccion se reemplaza por un almacen de objetos con el mismo puerto.
 */
export class AlmacenLocalImagenes implements AlmacenImagenes {
  constructor(
    private readonly carpeta: string,
    private readonly rutaPublica: string,
  ) {}

  async guardar(contenido: Buffer, formato: FormatoImagen): Promise<string> {
    await mkdir(this.carpeta, { recursive: true });
    // El nombre lo genera el servidor: el del cliente nunca llega al disco (evita rutas como ../../).
    const nombre = `${randomUUID()}.${formato}`;
    await writeFile(path.join(this.carpeta, nombre), contenido, { flag: 'wx' });
    return `${this.rutaPublica}/${nombre}`;
  }
}
