import { Inject, Injectable, Logger } from '@nestjs/common';
import { TipoConsulta } from '@prisma/client';
import { ENTORNO, Entorno } from '../../config/entorno';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Registra las consultas del tótem (`registro_consulta`) para medir el uso y detectar búsquedas sin resultado.
 * Es un registro de apoyo: si falla, la consulta del usuario no se ve afectada.
 */
@Injectable()
export class ConsultaService {
  private readonly log = new Logger(ConsultaService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async registrar(d: { tipo: TipoConsulta; termino?: string | null; huboResultado: boolean; espacioId?: number | null }) {
    try {
      await this.prisma.registro_consulta.create({
        data: {
          totem_id: this.entorno.totemId,
          tipo: d.tipo,
          termino: d.termino ? d.termino.slice(0, 200) : null,
          hubo_resultado: d.huboResultado,
          espacio_id: d.espacioId ?? null,
        },
      });
    } catch (e) {
      this.log.warn(`No se pudo registrar la consulta: ${(e as Error).message}`);
    }
  }
}
