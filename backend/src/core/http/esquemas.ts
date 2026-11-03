import { z } from 'zod';

export const id = z.coerce.number().int().positive();
export const idParam = z.object({ id });
export const dinero = z.number().nonnegative().multipleOf(0.01);
export const fecha = z.iso.date();
export const fechaHora = z.iso.datetime();
export const textoCorto = (maximo: number) => z.string().trim().min(1).max(maximo);
export const slug = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Solo minusculas, numeros y guiones').max(120);
export const booleanoQuery = z.enum(['true', 'false']).transform((valor) => valor === 'true');

export const paginado = z.object({
  pagina: z.coerce.number().int().positive().default(1),
  tamanoPagina: z.coerce.number().int().min(1).max(100).default(20),
});

export const rangoFechas = z.object({ desde: fecha, hasta: fecha }).refine(({ desde, hasta }) => desde <= hasta, {
  message: 'desde no puede ser posterior a hasta',
});
