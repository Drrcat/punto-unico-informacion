export interface DatosEnrolamiento {
  enrolamientoId: number;
  usuario: { correo: string; nombres: string; apellidos: string };
  /** Ruta absoluta del archivo con la fotografía ya validada. */
  rutaFoto: string;
}

/**
 * Puerto hacia el sistema de enrolamiento de la institución. Cada institución escribe su propio conector
 * (API, automatización web, etc.) sin tocar el resto del sistema. Debe limitarse a cargar una fotografía.
 *
 * Lanza `ErrorServicioExterno`: con `reintentable = true` si falló por una causa técnica (la copia de la
 * foto se conserva para reintentar) y con `reintentable = false` si el sistema la rechazó definitivamente.
 */
export interface ConectorEnrolamiento {
  readonly nombre: string;
  enviar(datos: DatosEnrolamiento): Promise<void>;
}
