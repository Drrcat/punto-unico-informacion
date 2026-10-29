import { Injectable, Logger } from '@nestjs/common';
import { ConfiguracionService } from '../../common/configuracion/configuracion.service';
import { PrismaService } from '../../common/prisma/prisma.service';
import { FotosStore } from './fotos.store';

/**
 * Política de retención de fotografías: se eliminan de inmediato cuando se rechazan o se completa el
 * enrolamiento, y como máximo a las `foto_retencion_horas` si quedaron guardadas por una falla técnica.
 */
@Injectable()
export class RetencionService {
  private readonly log = new Logger('RetencionFotos');

  constructor(
    private readonly prisma: PrismaService,
    private readonly store: FotosStore,
    private readonly config: ConfiguracionService,
  ) {}

  /**
   * Borra el archivo y deja constancia en la captura. Si el archivo no se puede borrar, conserva la referencia
   * para que la limpieza periódica lo intente de nuevo, y devuelve `false`.
   */
  async eliminarCopia(captura: { id: number; ruta_imagen: string | null }): Promise<boolean> {
    if (!captura.ruta_imagen) return true;
    try {
      await this.store.eliminar(captura.ruta_imagen);
    } catch (e) {
      this.log.error(`No se pudo borrar la fotografía de la captura ${captura.id}: ${(e as Error).message}`);
      return false;
    }
    await this.prisma.captura_facial.update({ where: { id: captura.id }, data: { ruta_imagen: null, eliminada_en: new Date() } });
    return true;
  }

  async eliminarCopiasDe(enrolamientoIds: number[]): Promise<void> {
    if (!enrolamientoIds.length) return;
    const capturas = await this.prisma.captura_facial.findMany({
      where: { enrolamiento_id: { in: enrolamientoIds }, ruta_imagen: { not: null } },
      select: { id: true, ruta_imagen: true },
    });
    for (const c of capturas) await this.eliminarCopia(c);
  }

  /** Elimina las copias que superaron el plazo de retención. Devuelve cuántas eliminó. */
  async purgarVencidas(): Promise<number> {
    const horas = await this.config.entero('foto_retencion_horas');
    const limite = new Date(Date.now() - horas * 3_600_000);
    const vencidas = await this.prisma.captura_facial.findMany({
      where: { ruta_imagen: { not: null }, capturada_en: { lt: limite } },
      select: { id: true, ruta_imagen: true },
    });
    let n = 0;
    for (const c of vencidas) if (await this.eliminarCopia(c)) n++;
    return n;
  }

  /** Elimina archivos de la carpeta de fotos que ya no tienen registro y superaron el plazo de retención. */
  async purgarHuerfanas(): Promise<number> {
    const horas = await this.config.entero('foto_retencion_horas');
    const antiguos = await this.store.listarAntiguos(new Date(Date.now() - horas * 3_600_000));
    if (!antiguos.length) return 0;
    const enUso = new Set(
      (await this.prisma.captura_facial.findMany({ where: { ruta_imagen: { in: antiguos } }, select: { ruta_imagen: true } })).map((c) => c.ruta_imagen),
    );
    let n = 0;
    for (const nombre of antiguos) {
      if (enUso.has(nombre)) continue;
      await this.store.eliminar(nombre).then(() => n++).catch((e) => this.log.error(`No se pudo borrar ${nombre}: ${(e as Error).message}`));
    }
    return n;
  }
}
