import { RostroDetectado, Verosimilitud } from '../../integraciones/vision/validador-rostros';

export type MotivoRechazo =
  | 'RESOLUCION_BAJA'
  | 'SIN_ROSTRO'
  | 'VARIOS_ROSTROS'
  | 'BAJA_CONFIANZA'
  | 'ROSTRO_DE_LADO'
  | 'POCA_LUZ'
  | 'IMAGEN_BORROSA'
  | 'ROSTRO_CORTADO'
  | 'ROSTRO_LEJANO'
  | 'ROSTRO_CERCANO'
  | 'ROSTRO_DESCENTRADO';

/** Indicaciones que ve la persona en el tótem para corregir la fotografía. */
export const MENSAJES_RECHAZO: Record<MotivoRechazo, string> = {
  RESOLUCION_BAJA: 'La imagen tiene muy poca resolución. Revisa que la cámara esté bien conectada.',
  SIN_ROSTRO: 'No se detectó ningún rostro. Mira de frente a la cámara.',
  VARIOS_ROSTROS: 'Se detectó más de una persona. En la foto debe aparecer solo tu rostro.',
  BAJA_CONFIANZA: 'No se pudo reconocer bien tu rostro. Mira de frente y sin nada que lo cubra.',
  ROSTRO_DE_LADO: 'Mira de frente a la cámara, con la cabeza derecha.',
  POCA_LUZ: 'Hay poca luz. Ponte en un lugar más iluminado.',
  IMAGEN_BORROSA: 'La foto salió borrosa. Quédate quieto un momento y vuelve a intentarlo.',
  ROSTRO_CORTADO: 'Tu rostro no se ve completo. Centra tu cara en la imagen.',
  ROSTRO_LEJANO: 'Acércate un poco a la cámara.',
  ROSTRO_CERCANO: 'Aléjate un poco de la cámara.',
  ROSTRO_DESCENTRADO: 'Centra tu rostro en la imagen.',
};

/** Umbrales de calidad. Se pueden ajustar tras probar con la cámara real del tótem. */
export const UMBRALES = {
  ladoMinimoPx: 300,
  confianzaMinima: 0.8,
  /** Rostros por debajo de esta confianza se consideran ruido de fondo y no cuentan como "otra persona". */
  confianzaRostroAjeno: 0.6,
  areaMinima: 0.08,
  areaMaxima: 0.75,
  descentradoX: 0.25,
  descentradoY: 0.3,
  anguloMaximo: 25,
  margenPx: 3,
};

export interface EvaluacionRostro {
  valido: boolean;
  confianza: number | null;
  motivo: MotivoRechazo | null;
  mensaje: string | null;
}

const ORDEN_VEROSIMILITUD: Verosimilitud[] = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
/** ¿Es `v` al menos tan probable como `minimo`? ("UNKNOWN" no cuenta: Google lo usa cuando no pudo estimarlo.) */
const alMenosTan = (v: Verosimilitud, minimo: Verosimilitud) => v !== 'UNKNOWN' && ORDEN_VEROSIMILITUD.indexOf(v) >= ORDEN_VEROSIMILITUD.indexOf(minimo);

/**
 * Decide si la fotografía sirve para enrolar: un único rostro, de frente, bien iluminado, nítido y encuadrado.
 * Devuelve un solo motivo (el primero que falle) para que la indicación a la persona sea clara.
 */
export function evaluarRostro(rostros: RostroDetectado[], dim: { ancho: number; alto: number }): EvaluacionRostro {
  const rechazo = (motivo: MotivoRechazo, confianza: number | null = null): EvaluacionRostro => ({ valido: false, confianza, motivo, mensaje: MENSAJES_RECHAZO[motivo] });

  if (Math.min(dim.ancho, dim.alto) < UMBRALES.ladoMinimoPx) return rechazo('RESOLUCION_BAJA');

  const relevantes = rostros.filter((r) => r.confianza >= UMBRALES.confianzaRostroAjeno);
  if (relevantes.length === 0) return rechazo('SIN_ROSTRO');
  if (relevantes.length > 1) return rechazo('VARIOS_ROSTROS');

  const r = relevantes[0];
  if (r.confianza < UMBRALES.confianzaMinima) return rechazo('BAJA_CONFIANZA', r.confianza);

  if ([r.giro, r.cabeceo, r.ladeo].some((a) => Math.abs(a) > UMBRALES.anguloMaximo)) return rechazo('ROSTRO_DE_LADO', r.confianza);
  if (alMenosTan(r.subexpuesta, 'LIKELY')) return rechazo('POCA_LUZ', r.confianza);
  if (alMenosTan(r.borrosa, 'LIKELY')) return rechazo('IMAGEN_BORROSA', r.confianza);

  if (r.caja.length < 3) return rechazo('SIN_ROSTRO');
  const xs = r.caja.map((p) => p.x);
  const ys = r.caja.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const m = UMBRALES.margenPx;
  if (x0 < -m || y0 < -m || x1 > dim.ancho + m || y1 > dim.alto + m) return rechazo('ROSTRO_CORTADO', r.confianza);

  const area = ((x1 - x0) * (y1 - y0)) / (dim.ancho * dim.alto);
  if (area < UMBRALES.areaMinima) return rechazo('ROSTRO_LEJANO', r.confianza);
  if (area > UMBRALES.areaMaxima) return rechazo('ROSTRO_CERCANO', r.confianza);

  const cx = (x0 + x1) / 2 / dim.ancho;
  const cy = (y0 + y1) / 2 / dim.alto;
  if (Math.abs(cx - 0.5) > UMBRALES.descentradoX || Math.abs(cy - 0.5) > UMBRALES.descentradoY) return rechazo('ROSTRO_DESCENTRADO', r.confianza);

  return { valido: true, confianza: Number(r.confianza.toFixed(3)), motivo: null, mensaje: null };
}
