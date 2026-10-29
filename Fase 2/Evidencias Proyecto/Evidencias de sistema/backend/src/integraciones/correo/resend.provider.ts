import { Inject, Injectable } from '@nestjs/common';
import { ENTORNO, Entorno } from '../../config/entorno';
import { ErrorServicioExterno } from '../errores';
import { CorreoProvider, MensajeCodigo } from './correo.provider';
import { construirCorreoCodigo } from './plantilla';

const TIEMPO_MAX_MS = 8_000;

/** Envío mediante la API HTTP de Resend (https://resend.com/docs/api-reference/emails/send-email). */
@Injectable()
export class ResendProvider extends CorreoProvider {
  constructor(@Inject(ENTORNO) private readonly entorno: Entorno) {
    super();
  }

  async enviarCodigo(m: MensajeCodigo): Promise<void> {
    const { asunto, texto, html } = construirCorreoCodigo(m);
    let res: Response;
    try {
      res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${this.entorno.correo.apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from: this.entorno.correo.remitente, to: [m.para], subject: asunto, text: texto, html }),
        signal: AbortSignal.timeout(TIEMPO_MAX_MS),
      });
    } catch (e) {
      throw new ErrorServicioExterno(`No hubo respuesta del servicio de correo: ${(e as Error).message}`);
    }
    if (!res.ok) {
      const cuerpo = (await res.text().catch(() => '')).slice(0, 150);
      // 4xx distintos de 429 indican un problema de configuración (clave, remitente): repetir no sirve.
      throw new ErrorServicioExterno(`El servicio de correo respondió ${res.status}. ${cuerpo}`, res.status, res.status >= 500 || res.status === 429);
    }
  }
}
