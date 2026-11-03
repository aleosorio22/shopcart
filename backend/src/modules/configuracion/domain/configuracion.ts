import { z } from 'zod';
import type { Fila } from '../../../core/db/sql-gateway.js';
import { dinero, id, textoCorto } from '../../../core/http/esquemas.js';

export const parametroSchema = z.object({ valor: textoCorto(200) });
export const claveSchema = z.object({ clave: z.string().regex(/^[A-Z0-9_]{1,60}$/) });
export const tarifaSchema = z.object({ idMetodoEnvio: id, idDepartamento: id, costo: dinero, montoEnvioGratis: dinero.positive().nullish(), diasEstimados: z.number().int().min(0).max(60), activo: z.boolean().default(true) });

export type Tarifa = z.infer<typeof tarifaSchema>;

export interface ConfiguracionRepository {
  listarParametros(actor: number): Promise<Fila[]>;
  guardarParametro(actor: number, clave: string, valor: string): Promise<void>;
  guardarTarifa(actor: number, tarifa: Tarifa): Promise<void>;
}
