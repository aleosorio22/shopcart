const moneda = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' });
const fechaCorta = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeZone: 'America/Guatemala' });
const fechaHora = new Intl.DateTimeFormat('es-GT', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Guatemala' });

export const quetzales = (valor: number | string | null | undefined) => moneda.format(Number(valor ?? 0));
export const fecha = (valor: string | Date) => fechaCorta.format(new Date(valor));
export const fechaYHora = (valor: string | Date) => fechaHora.format(new Date(valor));
export const entero = (valor: number | string) => Number(valor).toLocaleString('es-GT');

/** Fecha local en formato yyyy-mm-dd, la que esperan los filtros de reportes. */
export function isoLocal(fechaBase: Date): string {
  const ajustada = new Date(fechaBase.getTime() - fechaBase.getTimezoneOffset() * 60_000);
  return ajustada.toISOString().slice(0, 10);
}

export function hace(dias: number): string {
  const base = new Date();
  base.setDate(base.getDate() - dias);
  return isoLocal(base);
}

/** Convierte un nombre en slug valido para el backend: "Mouse Gamer" -> "mouse-gamer". */
export function aSlug(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 120);
}
