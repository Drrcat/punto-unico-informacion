import { Inject, Injectable, Logger } from '@nestjs/common';
import { ServicioExterno } from '@prisma/client';
import { ENTORNO, Entorno } from '../../config/entorno';
import { PrismaService } from '../prisma/prisma.service';

/** Quita de un mensaje lo que no debe quedar guardado: correos completos y secuencias que parecen claves. */
export function sanearMensaje(m: string): string {
  return m
    .replace(/[\w.+-]+@[\w-]+(\.[\w-]+)+/g, '[correo]')
    .replace(/(bearer|key|token|clave|password)[=:\s]+\S+/gi, '$1=[oculto]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 300);
}

/** Deja constancia de las fallas de los servicios externos (correo, Vision AI, sistema de enrolamiento). Nunca lanza. */
@Injectable()
export class ErrorExternoService {
  private readonly log = new Logger(ErrorExternoService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async registrar(d: {
    servicio: ServicioExterno;
    operacion: string;
    mensaje: string;
    codigoHttp?: number | null;
    enrolamientoId?: number | null;
  }): Promise<void> {
    const mensaje = sanearMensaje(d.mensaje || 'sin detalle');
    this.log.warn(`${d.servicio}/${d.operacion}: ${mensaje}`);
    try {
      await this.prisma.registro_error.create({
        data: {
          servicio: d.servicio,
          operacion: d.operacion.slice(0, 60),
          codigo_http: d.codigoHttp ?? null,
          mensaje,
          totem_id: this.entorno.totemId,
          enrolamiento_id: d.enrolamientoId ?? null,
        },
      });
    } catch (e) {
      this.log.error(`No se pudo guardar el error en la base: ${(e as Error).message}`);
    }
  }
}
