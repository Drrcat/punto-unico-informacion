import { Injectable, Logger } from '@nestjs/common';
import { ConectorEnrolamiento, DatosEnrolamiento } from './conector-enrolamiento';

/** Destino de demostración: confirma la recepción sin enviar la fotografía a ningún sistema. */
@Injectable()
export class ConectorSimulado implements ConectorEnrolamiento {
  readonly nombre = 'simulado';
  private readonly log = new Logger('ConectorSimulado');

  async enviar(d: DatosEnrolamiento): Promise<void> {
    this.log.warn(`[SIMULADO] Enrolamiento ${d.enrolamientoId} recibido; la fotografía no se envió a ningún sistema.`);
    await new Promise((r) => setTimeout(r, Number(process.env.ENROLAMIENTO_SIMULADO_MS ?? 300)));
  }
}
