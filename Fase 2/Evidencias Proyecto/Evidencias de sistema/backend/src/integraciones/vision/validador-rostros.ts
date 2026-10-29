export type Verosimilitud = 'UNKNOWN' | 'VERY_UNLIKELY' | 'UNLIKELY' | 'POSSIBLE' | 'LIKELY' | 'VERY_LIKELY';

export interface RostroDetectado {
  /** Confianza de la detección, de 0 a 1. */
  confianza: number;
  /** Vértices del recuadro del rostro, en píxeles de la imagen. */
  caja: { x: number; y: number }[];
  /** Giro a los lados, hacia arriba/abajo e inclinación de la cabeza, en grados. */
  giro: number;
  cabeceo: number;
  ladeo: number;
  subexpuesta: Verosimilitud;
  borrosa: Verosimilitud;
}

/** Detecta rostros en una imagen. Lanza `ErrorServicioExterno` si el servicio no responde. */
export abstract class ValidadorRostros {
  abstract analizar(imagen: Buffer): Promise<RostroDetectado[]>;
}
