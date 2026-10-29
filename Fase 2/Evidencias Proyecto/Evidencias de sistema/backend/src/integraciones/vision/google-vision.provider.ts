import { Injectable } from '@nestjs/common';
import { ErrorServicioExterno } from '../errores';
import { RostroDetectado, ValidadorRostros, Verosimilitud } from './validador-rostros';

/** Códigos gRPC de Google equivalentes a un código HTTP, para dejarlos en el registro de errores. */
const GRPC_A_HTTP: Record<number, number> = { 3: 400, 4: 504, 7: 403, 8: 429, 14: 503, 16: 401 };

type FaceAnnotation = {
  detectionConfidence?: number | null;
  boundingPoly?: { vertices?: { x?: number | null; y?: number | null }[] | null } | null;
  panAngle?: number | null;
  tiltAngle?: number | null;
  rollAngle?: number | null;
  underExposedLikelihood?: string | number | null;
  blurredLikelihood?: string | number | null;
};

const NIVELES: Verosimilitud[] = ['UNKNOWN', 'VERY_UNLIKELY', 'UNLIKELY', 'POSSIBLE', 'LIKELY', 'VERY_LIKELY'];
const nivel = (v: string | number | null | undefined): Verosimilitud => (typeof v === 'number' ? (NIVELES[v] ?? 'UNKNOWN') : ((v as Verosimilitud) ?? 'UNKNOWN'));

/**
 * Detección de rostros con Google Cloud Vision (FACE_DETECTION). Las credenciales se toman de
 * GOOGLE_APPLICATION_CREDENTIALS. El cliente se carga recién en el primer uso.
 */
@Injectable()
export class GoogleVisionProvider extends ValidadorRostros {
  private cliente: { faceDetection(req: unknown, opts?: unknown): Promise<[{ faceAnnotations?: FaceAnnotation[] | null; error?: { message?: string; code?: number } | null }]> } | null = null;

  async analizar(imagen: Buffer): Promise<RostroDetectado[]> {
    try {
      if (!this.cliente) {
        const { ImageAnnotatorClient } = await import('@google-cloud/vision');
        this.cliente = new ImageAnnotatorClient() as unknown as NonNullable<typeof this.cliente>;
      }
      const [r] = await this.cliente.faceDetection({ image: { content: imagen } }, { timeout: 10_000 });
      if (r.error?.message) throw Object.assign(new Error(r.error.message), { code: r.error.code });
      return (r.faceAnnotations ?? []).map((f) => ({
        confianza: f.detectionConfidence ?? 0,
        caja: (f.boundingPoly?.vertices ?? []).map((v) => ({ x: v.x ?? 0, y: v.y ?? 0 })),
        giro: f.panAngle ?? 0,
        cabeceo: f.tiltAngle ?? 0,
        ladeo: f.rollAngle ?? 0,
        subexpuesta: nivel(f.underExposedLikelihood),
        borrosa: nivel(f.blurredLikelihood),
      }));
    } catch (e) {
      const err = e as Error & { code?: number };
      throw new ErrorServicioExterno(`Google Vision AI no pudo analizar la imagen: ${err.message}`, typeof err.code === 'number' ? GRPC_A_HTTP[err.code] : undefined);
    }
  }
}
