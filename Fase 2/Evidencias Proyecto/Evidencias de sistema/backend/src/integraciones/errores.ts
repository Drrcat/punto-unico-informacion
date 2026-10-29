/** Falla de un servicio externo (correo, Google Vision AI, sistema de enrolamiento). */
export class ErrorServicioExterno extends Error {
  constructor(
    mensaje: string,
    /** Código HTTP devuelto por el servicio, si lo hubo. */
    public readonly codigoHttp?: number,
    /** Si tiene sentido volver a intentar más tarde (falla técnica) o no (rechazo definitivo). */
    public readonly reintentable = true,
    /** Mensaje apto para mostrar a la persona, si el servicio lo entrega. */
    public readonly mensajeUsuario?: string,
  ) {
    super(mensaje);
    this.name = 'ErrorServicioExterno';
  }
}
