import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { noEncontrado } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { buscar, Indexado, indexar } from '../../common/util/buscador';
import { IndiceCache, Invalidador } from '../../common/util/indice-cache';
import { compararNatural, incluirUbicacion, vistaUbicacion } from '../../common/util/vistas';

const incluirResumen = { area: true } satisfies Prisma.tramiteInclude;

export interface VistaTramiteResumen {
  id: number;
  nombre: string;
  descripcion: string | null;
  plazoDias: number | null;
  area: { id: number; nombre: string };
  /** Id del área, para filtrar sin volver a consultar. */
  areaId: number;
}

@Injectable()
export class TramitesService {
  private readonly indice: IndiceCache<VistaTramiteResumen>;

  constructor(
    private readonly prisma: PrismaService,
    invalidador: Invalidador,
  ) {
    this.indice = new IndiceCache(() => this.cargarIndice());
    invalidador.suscribir(() => this.indice.invalidar());
  }

  private async cargarIndice(): Promise<Indexado<VistaTramiteResumen>[]> {
    const tramites = await this.prisma.tramite.findMany({ where: { activo: true }, include: incluirResumen });
    return tramites.map((t) =>
      indexar<VistaTramiteResumen>(
        { id: t.id, nombre: t.nombre, descripcion: t.descripcion, plazoDias: t.plazo_dias, area: { id: t.area.id, nombre: t.area.nombre }, areaId: t.area_id },
        [
          { texto: t.nombre, peso: 1 },
          { texto: t.descripcion, peso: 0.4 },
          { texto: t.area.nombre, peso: 0.6 },
        ],
      ),
    );
  }

  async listar(q?: string, areaId?: number): Promise<Omit<VistaTramiteResumen, 'areaId'>[]> {
    const todo = await this.indice.obtener();
    const base = areaId ? todo.filter((d) => d.item.areaId === areaId) : todo;
    const orden = (a: VistaTramiteResumen, b: VistaTramiteResumen) => compararNatural(a.nombre, b.nombre);
    const items = q ? buscar(q, base, orden) : base.map((d) => d.item).sort(orden);
    return items.map(({ areaId: _omitido, ...t }) => t);
  }

  /** Trámite completo: pasos en orden, requisitos y el área que lo resuelve con su ubicación. */
  async obtener(id: number) {
    const t = await this.prisma.tramite.findUnique({
      where: { id },
      include: {
        area: { include: { espacio: { include: incluirUbicacion } } },
        paso_rel: { orderBy: { orden: 'asc' } },
        requisito_rel: { orderBy: [{ obligatorio: 'desc' }, { id: 'asc' }] },
      },
    });
    if (!t || !t.activo) throw noEncontrado('TRAMITE_NO_ENCONTRADO', 'No existe el trámite indicado.');
    return {
      id: t.id,
      nombre: t.nombre,
      descripcion: t.descripcion,
      plazoDias: t.plazo_dias,
      pasos: t.paso_rel.map((p) => ({ orden: p.orden, titulo: p.titulo, descripcion: p.descripcion })),
      requisitos: t.requisito_rel.map((r) => ({ id: r.id, nombre: r.nombre, obligatorio: r.obligatorio })),
      area: {
        id: t.area.id,
        nombre: t.area.nombre,
        descripcion: t.area.descripcion,
        horarioAtencion: t.area.horario_atencion,
        contacto: { correo: t.area.correo_contacto, anexo: t.area.anexo },
        ubicacion: t.area.espacio ? vistaUbicacion(t.area.espacio) : null,
      },
    };
  }
}
