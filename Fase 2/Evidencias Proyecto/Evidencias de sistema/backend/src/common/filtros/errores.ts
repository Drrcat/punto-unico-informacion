import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Error de negocio con un código estable que las aplicaciones cliente pueden interpretar
 * sin depender del texto del mensaje.
 */
export class ErrorNegocio extends HttpException {
  constructor(
    estado: HttpStatus,
    public readonly codigo: string,
    mensaje: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super({ statusCode: estado, codigo, mensaje, ...(extra ?? {}) }, estado);
  }
}

export const noEncontrado = (codigo: string, mensaje: string) => new ErrorNegocio(HttpStatus.NOT_FOUND, codigo, mensaje);
export const conflicto = (codigo: string, mensaje: string, extra?: Record<string, unknown>) =>
  new ErrorNegocio(HttpStatus.CONFLICT, codigo, mensaje, extra);
export const invalido = (codigo: string, mensaje: string, extra?: Record<string, unknown>) =>
  new ErrorNegocio(HttpStatus.UNPROCESSABLE_ENTITY, codigo, mensaje, extra);
export const noAutorizado = (codigo: string, mensaje: string) => new ErrorNegocio(HttpStatus.UNAUTHORIZED, codigo, mensaje);
export const prohibido = (codigo: string, mensaje: string) => new ErrorNegocio(HttpStatus.FORBIDDEN, codigo, mensaje);
export const noDisponible = (codigo: string, mensaje: string, extra?: Record<string, unknown>) =>
  new ErrorNegocio(HttpStatus.SERVICE_UNAVAILABLE, codigo, mensaje, extra);
