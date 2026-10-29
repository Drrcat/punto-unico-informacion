import { Inject, Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { ConfiguracionService } from '../../common/configuracion/configuracion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENTORNO, Entorno } from '../../config/entorno';
import { RetencionService } from './retencion.service';

/** Tareas periódicas del módulo de enrolamiento. Cada una puede fallar sin afectar a las demás. */
@Injectable()
export class LimpiezaService implements OnApplicationBootstrap {
  private readonly log = new Logger('Limpieza');

  constructor(
    private readonly prisma: PrismaService,
    private readonly retencion: RetencionService,
    private readonly config: ConfiguracionService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  /** Al iniciar, para que un reinicio del equipo no deje fotografías ni solicitudes a medias. */
  async onApplicationBootstrap(): Promise<void> {
    if (!this.entorno.tareasActivas) return;
    await this.ejecutar();
  }

  @Cron('*/10 * * * *')
  async ejecutar(): Promise<void> {
    await this.correr('expirar códigos', () => this.expirarCodigos());
    await this.correr('cancelar solicitudes abandonadas', () => this.cancelarAbandonadas());
    await this.correr('eliminar fotografías vencidas', () => this.retencion.purgarVencidas());
    await this.correr('eliminar archivos huérfanos', () => this.retencion.purgarHuerfanas());
  }

  private async correr(nombre: string, tarea: () => Promise<number>): Promise<void> {
    try {
      const n = await tarea();
      if (n > 0) this.log.log(`${nombre}: ${n}`);
    } catch (e) {
      this.log.error(`Falló la tarea "${nombre}": ${(e as Error).message}`);
    }
  }

  /** Códigos pendientes cuyo plazo terminó pasan a EXPIRADA. */
  async expirarCodigos(): Promise<number> {
    const r = await this.prisma.intento_autenticacion.updateMany({
      where: { estado: 'PENDIENTE', expira_en: { lte: new Date() } },
      data: { estado: 'EXPIRADA', resuelto_en: new Date() },
    });
    return r.count;
  }

  /** Solicitudes que nadie terminó (la persona se fue del tótem) pasan a CANCELADO y se borra su fotografía. */
  async cancelarAbandonadas(): Promise<number> {
    const vigencia = await this.config.entero('enrolamiento_vigencia_min');
    const limite = new Date(Date.now() - (vigencia + 5) * 60_000);
    const abandonadas = await this.prisma.enrolamiento.findMany({
      where: { estado: { in: ['INICIADO', 'FOTO_PENDIENTE', 'FALLIDO'] }, iniciado_en: { lt: limite } },
      select: { id: true, estado: true },
    });
    // Las FALLIDO conservan su copia hasta el plazo de retención, que la purga ya controla.
    const ids = abandonadas.filter((e) => e.estado !== 'FALLIDO').map((e) => e.id);
    if (!ids.length) return 0;
    const r = await this.prisma.enrolamiento.updateMany({ where: { id: { in: ids }, estado: { in: ['INICIADO', 'FOTO_PENDIENTE'] } }, data: { estado: 'CANCELADO' } });
    await this.retencion.eliminarCopiasDe(ids);
    return r.count;
  }
}
