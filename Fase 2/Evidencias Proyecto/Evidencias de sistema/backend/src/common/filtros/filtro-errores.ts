import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus, Logger } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { Response } from 'express';

const CODIGOS_HTTP: Record<number, string> = {
  400: 'SOLICITUD_INVALIDA',
  401: 'NO_AUTENTICADO',
  403: 'PROHIBIDO',
  404: 'NO_ENCONTRADO',
  405: 'METODO_NO_PERMITIDO',
  409: 'CONFLICTO',
  413: 'ARCHIVO_MUY_GRANDE',
  415: 'TIPO_NO_SOPORTADO',
  422: 'DATOS_INVALIDOS',
  429: 'DEMASIADAS_SOLICITUDES',
};

/**
 * Entrega todos los errores con el mismo formato: `{ statusCode, codigo, mensaje, ... }`.
 * Los errores inesperados se registran completos en el log pero al cliente solo le llega un mensaje genérico.
 */
@Catch()
export class FiltroErrores implements ExceptionFilter {
  private readonly log = new Logger('Errores');

  catch(error: unknown, host: ArgumentsHost): void {
    const res = host.switchToHttp().getResponse<Response>();
    const { estado, cuerpo } = this.traducir(error);
    if (estado >= 500) this.log.error(error instanceof Error ? (error.stack ?? error.message) : String(error));
    res.status(estado).json(cuerpo);
  }

  private traducir(error: unknown): { estado: number; cuerpo: Record<string, unknown> } {
    if (error instanceof HttpException) {
      const estado = error.getStatus();
      const r = error.getResponse();
      if (typeof r === 'object' && r !== null && 'codigo' in r) return { estado, cuerpo: { statusCode: estado, ...(r as object) } };
      // Errores de validación (class-validator) y de Nest sin código propio.
      const mensajes = typeof r === 'object' && r !== null && 'message' in r ? (r as { message: unknown }).message : error.message;
      const lista = Array.isArray(mensajes) ? (mensajes as string[]) : [String(mensajes)];
      const codigo = estado === 400 && Array.isArray(mensajes) ? 'VALIDACION' : (CODIGOS_HTTP[estado] ?? 'ERROR');
      return {
        estado,
        cuerpo: { statusCode: estado, codigo, mensaje: lista[0], ...(lista.length > 1 || Array.isArray(mensajes) ? { detalle: lista } : {}) },
      };
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === 'P2002') return this.simple(409, 'DUPLICADO', 'Ya existe un registro con esos datos.');
      if (error.code === 'P2025') return this.simple(404, 'NO_ENCONTRADO', 'El registro no existe.');
      if (error.code === 'P2003') return this.simple(409, 'REFERENCIA_INVALIDA', 'El registro está relacionado con otros datos o referencia uno que no existe.');
    }
    return this.simple(HttpStatus.INTERNAL_SERVER_ERROR, 'ERROR_INTERNO', 'Ocurrió un error inesperado. Intenta de nuevo.');
  }

  private simple(estado: number, codigo: string, mensaje: string) {
    return { estado, cuerpo: { statusCode: estado, codigo, mensaje } };
  }
}
