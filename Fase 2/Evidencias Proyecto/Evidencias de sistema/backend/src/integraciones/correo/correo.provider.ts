export interface MensajeCodigo {
  para: string;
  codigo: string;
  vigenciaMin: number;
  /** Nombre de la institución, tal como está en la configuración. */
  institucion: string;
}

/**
 * Interfaz propia para enviar el código de verificación. Cambiar de proveedor de correo
 * consiste en escribir otra clase que la implemente y elegirla en `integraciones.module.ts`.
 */
export abstract class CorreoProvider {
  /** Lanza `ErrorServicioExterno` si el correo no pudo enviarse. */
  abstract enviarCodigo(m: MensajeCodigo): Promise<void>;
}
