import { randomUUID } from 'node:crypto';
import type { PasarelaPago, ResultadoCobro, SolicitudCobro } from '../domain/checkout.js';

export const TOKEN_RECHAZADO = 'tok_rechazada';

/** Reemplazable por una pasarela real implementando el mismo puerto. Un rechazo no se recuerda: se puede reintentar. */
export class PasarelaSimulada implements PasarelaPago {
  private readonly aprobados = new Map<string, ResultadoCobro>();

  async cobrar({ llave, tokenPago }: SolicitudCobro): Promise<ResultadoCobro> {
    const previo = this.aprobados.get(llave);
    if (previo) return previo;
    if (tokenPago === TOKEN_RECHAZADO) {
      return { aprobado: false, referencia: `SIM-R-${randomUUID()}`, mensaje: 'La tarjeta fue rechazada.' };
    }
    const resultado = { aprobado: true, referencia: `SIM-${randomUUID()}`, mensaje: 'Aprobado' };
    this.aprobados.set(llave, resultado);
    return resultado;
  }
}
