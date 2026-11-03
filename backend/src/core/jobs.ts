import type { Logger } from 'pino';
import type { SqlGateway } from './db/sql-gateway.js';

const CADA_MINUTO = 60_000;
const CADA_HORA = 3_600_000;

interface EventoSalida {
  IDEventoSalida: string;
  TipoEvento: string;
}

/** Funciona igual en SQL Server Express, que no trae SQL Agent. Usa el login shopcart_jobs. */
export class Jobs {
  private readonly temporizadores: NodeJS.Timeout[] = [];

  constructor(
    private readonly db: SqlGateway,
    private readonly logger: Logger,
  ) {}

  iniciar(): void {
    this.programar('liberar reservas', CADA_MINUTO, () => this.db.ejecutar('Job.SP_Inventario_LiberarReservasVencidas'));
    this.programar('publicar eventos', CADA_MINUTO, () => this.publicarEventos());
    this.programar('limpieza', CADA_HORA, () => this.db.ejecutar('Job.SP_Mantenimiento_Limpiar'));
  }

  detener(): void {
    this.temporizadores.forEach(clearInterval);
  }

  private programar(nombre: string, cadaMs: number, tarea: () => Promise<void>): void {
    const correr = () => {
      tarea().catch((err: unknown) => this.logger.error({ err, tarea: nombre }, 'Fallo una tarea programada'));
    };
    correr();
    this.temporizadores.push(setInterval(correr, cadaMs));
  }

  private async publicarEventos(): Promise<void> {
    const eventos = await this.db.consultar<EventoSalida>('Job.SP_Eventos_Leer');
    for (const { IDEventoSalida, TipoEvento } of eventos) {
      this.logger.info({ IDEventoSalida, TipoEvento }, 'Evento publicado');
      await this.db.ejecutar('Job.SP_Eventos_MarcarProcesado', { IDEventoSalida: { tipo: 'bigint', valor: IDEventoSalida } });
    }
  }
}
