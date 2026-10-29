import { existsSync } from 'fs';
import { ErrorServicioExterno } from '../../src/integraciones/errores';
import { ConectorEnrolamiento, DatosEnrolamiento } from '../../src/integraciones/conector/conector-enrolamiento';
import { CorreoProvider, MensajeCodigo } from '../../src/integraciones/correo/correo.provider';
import { RostroDetectado, ValidadorRostros } from '../../src/integraciones/vision/validador-rostros';

export class CorreoFalso extends CorreoProvider {
  enviados: MensajeCodigo[] = [];
  falla: Error | null = null;

  async enviarCodigo(m: MensajeCodigo): Promise<void> {
    if (this.falla) throw this.falla;
    this.enviados.push(m);
  }

  /** Último código enviado a ese correo. */
  codigoPara(correo: string): string {
    const m = [...this.enviados].reverse().find((x) => x.para === correo);
    if (!m) throw new Error(`No se envió ningún código a ${correo}`);
    return m.codigo;
  }
}

/** Rostro bien encuadrado para una imagen de 640x480. */
export const rostroBueno = (ancho = 640, alto = 480): RostroDetectado => {
  const w = ancho * 0.4;
  const h = alto * 0.55;
  const x = (ancho - w) / 2;
  const y = (alto - h) / 2;
  return {
    confianza: 0.97,
    caja: [{ x, y }, { x: x + w, y }, { x: x + w, y: y + h }, { x, y: y + h }],
    giro: 0,
    cabeceo: 0,
    ladeo: 0,
    subexpuesta: 'VERY_UNLIKELY',
    borrosa: 'VERY_UNLIKELY',
  };
};

export class VisionFalsa extends ValidadorRostros {
  llamadas = 0;
  /** Lo que "ve" el servicio, o el error con que falla. */
  respuesta: RostroDetectado[] | Error = [rostroBueno()];

  async analizar(): Promise<RostroDetectado[]> {
    this.llamadas++;
    if (this.respuesta instanceof Error) throw this.respuesta;
    return this.respuesta;
  }
}

export class ConectorFalso implements ConectorEnrolamiento {
  readonly nombre = 'falso';
  recibidos: (DatosEnrolamiento & { existiaArchivo: boolean })[] = [];
  falla: ErrorServicioExterno | null = null;
  /** Para simular un envío lento. */
  esperaMs = 0;

  async enviar(d: DatosEnrolamiento): Promise<void> {
    this.recibidos.push({ ...d, existiaArchivo: existsSync(d.rutaFoto) });
    if (this.esperaMs) await new Promise((r) => setTimeout(r, this.esperaMs));
    if (this.falla) throw this.falla;
  }
}
