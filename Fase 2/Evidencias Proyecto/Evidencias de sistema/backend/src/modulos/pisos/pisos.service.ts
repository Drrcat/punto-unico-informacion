import { Inject, Injectable } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { ENTORNO, Entorno } from '../../config/entorno';
import { noEncontrado } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { urlPlano } from '../../common/util/vistas';

@Injectable()
export class PisosService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async listar(edificioId?: number) {
    const pisos = await this.prisma.piso.findMany({
      where: edificioId ? { edificio_id: edificioId } : undefined,
      include: { edificio: { include: { sede: true } } },
      orderBy: [{ edificio_id: 'asc' }, { numero: 'asc' }],
    });
    return pisos.map((p) => ({
      id: p.id,
      numero: p.numero,
      nombre: p.nombre,
      edificio: { id: p.edificio.id, nombre: p.edificio.nombre },
      sede: { id: p.edificio.sede.id, nombre: p.edificio.sede.nombre },
      planoUrl: urlPlano(p.id, p.plano_svg_ruta),
    }));
  }

  /** Detalle del piso con los espacios activos que se pueden resaltar en su plano. */
  async obtener(id: number) {
    const p = await this.prisma.piso.findUnique({
      where: { id },
      include: {
        edificio: { include: { sede: true } },
        espacio_rel: { where: { activo: true }, include: { tipo_espacio: true }, orderBy: { codigo: 'asc' } },
      },
    });
    if (!p) throw noEncontrado('PISO_NO_ENCONTRADO', 'No existe el piso indicado.');
    return {
      id: p.id,
      numero: p.numero,
      nombre: p.nombre,
      edificio: { id: p.edificio.id, nombre: p.edificio.nombre },
      sede: { id: p.edificio.sede.id, nombre: p.edificio.sede.nombre },
      planoUrl: urlPlano(p.id, p.plano_svg_ruta),
      espacios: p.espacio_rel
        .sort((a, b) => a.codigo.localeCompare(b.codigo, 'es', { numeric: true }))
        .map((e) => ({ id: e.id, codigo: e.codigo, nombre: e.nombre, tipo: e.tipo_espacio.nombre, svgElementId: e.svg_element_id })),
    };
  }

  /** Contenido del plano SVG del piso. La ruta se resuelve dentro de PLANOS_DIR y nunca fuera de ella. */
  async plano(id: number): Promise<string> {
    const p = await this.prisma.piso.findUnique({ where: { id }, select: { plano_svg_ruta: true } });
    if (!p) throw noEncontrado('PISO_NO_ENCONTRADO', 'No existe el piso indicado.');
    if (!p.plano_svg_ruta) throw noEncontrado('PLANO_NO_DISPONIBLE', 'Este piso todavía no tiene plano.');
    const base = path.resolve(this.entorno.planosDir);
    const archivo = path.resolve(base, p.plano_svg_ruta);
    if (!archivo.startsWith(base + path.sep) || !archivo.toLowerCase().endsWith('.svg')) {
      throw noEncontrado('PLANO_NO_DISPONIBLE', 'El plano de este piso no está disponible.');
    }
    try {
      return await fs.readFile(archivo, 'utf8');
    } catch {
      throw noEncontrado('PLANO_NO_DISPONIBLE', 'El plano de este piso no está disponible.');
    }
  }
}
