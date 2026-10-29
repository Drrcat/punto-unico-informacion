import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { conflicto, invalido, noEncontrado } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/registro/auditoria.service';
import { buscar, Indexado, indexar } from '../../common/util/buscador';
import { IndiceCache, Invalidador } from '../../common/util/indice-cache';
import { compararNatural, incluirUbicacion, vistaUbicacion, VistaUbicacion } from '../../common/util/vistas';
import { ActualizarAreaDto, CrearAreaDto } from './areas.dto';

const incluirArea = {
  espacio: { include: incluirUbicacion },
  tramite_rel: { where: { activo: true }, orderBy: { nombre: 'asc' } },
  carrera_rel: { where: { activa: true }, orderBy: { nombre: 'asc' } },
} satisfies Prisma.area_institucionalInclude;

type AreaCompleta = Prisma.area_institucionalGetPayload<{ include: typeof incluirArea }>;

export interface VistaArea {
  id: number;
  nombre: string;
  descripcion: string | null;
  horarioAtencion: string | null;
  contacto: { correo: string | null; anexo: string | null };
  ubicacion: VistaUbicacion | null;
}

@Injectable()
export class AreasService {
  private readonly indice: IndiceCache<VistaArea>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly invalidador: Invalidador,
  ) {
    this.indice = new IndiceCache(() => this.cargarIndice());
    invalidador.suscribir(() => this.indice.invalidar());
  }

  private vista(a: AreaCompleta): VistaArea {
    return {
      id: a.id,
      nombre: a.nombre,
      descripcion: a.descripcion,
      horarioAtencion: a.horario_atencion,
      contacto: { correo: a.correo_contacto, anexo: a.anexo },
      ubicacion: a.espacio ? vistaUbicacion(a.espacio) : null,
    };
  }

  private async cargarIndice(): Promise<Indexado<VistaArea>[]> {
    const areas = await this.prisma.area_institucional.findMany({ include: incluirArea });
    return areas.map((a) =>
      indexar(this.vista(a), [
        { texto: a.nombre, peso: 1 },
        { texto: a.descripcion, peso: 0.5 },
        ...a.tramite_rel.map((t) => ({ texto: t.nombre, peso: 0.6 })),
        ...a.carrera_rel.map((c) => ({ texto: c.nombre, peso: 0.6 })),
        { texto: a.espacio ? `${a.espacio.codigo} ${a.espacio.nombre ?? ''}` : null, peso: 0.4 },
      ]),
    );
  }

  async listar(q?: string): Promise<VistaArea[]> {
    const todo = await this.indice.obtener();
    const orden = (a: VistaArea, b: VistaArea) => compararNatural(a.nombre, b.nombre);
    return q ? buscar(q, todo, orden) : todo.map((d) => d.item).sort(orden);
  }

  async obtener(id: number) {
    const a = await this.prisma.area_institucional.findUnique({ where: { id }, include: incluirArea });
    if (!a) throw noEncontrado('AREA_NO_ENCONTRADA', 'No existe el área indicada.');
    return {
      ...this.vista(a),
      atiende: {
        tramites: a.tramite_rel.map((t) => ({ id: t.id, nombre: t.nombre })),
        carreras: a.carrera_rel.map((c) => ({ id: c.id, codigo: c.codigo, nombre: c.nombre })),
      },
    };
  }

  // ------------------------------------------------------------------ administración

  async crear(dto: CrearAreaDto, admin: AdminActual) {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.validar(tx, dto.nombre, dto.espacioId);
      const a = await tx.area_institucional.create({ data: this.datos(dto) as Prisma.area_institucionalUncheckedCreateInput });
      await this.auditoria.registrar(tx, { usuarioId: admin.usuarioId, accion: 'crear', entidad: 'area_institucional', entidadId: a.id, detalle: { nombre: a.nombre } });
      return a.id;
    });
    this.invalidador.invalidar();
    return this.obtener(id);
  }

  async actualizar(id: number, dto: ActualizarAreaDto, admin: AdminActual) {
    await this.prisma.$transaction(async (tx) => {
      if (!(await tx.area_institucional.findUnique({ where: { id }, select: { id: true } }))) {
        throw noEncontrado('AREA_NO_ENCONTRADA', 'No existe el área indicada.');
      }
      await this.validar(tx, dto.nombre, dto.espacioId, id);
      await tx.area_institucional.update({ where: { id }, data: this.datos(dto) });
      await this.auditoria.registrar(tx, { usuarioId: admin.usuarioId, accion: 'editar', entidad: 'area_institucional', entidadId: id, detalle: { campos: Object.keys(dto) } });
    });
    this.invalidador.invalidar();
    return this.obtener(id);
  }

  async eliminar(id: number, admin: AdminActual): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const a = await tx.area_institucional.findUnique({
        where: { id },
        include: { _count: { select: { tramite_rel: true, carrera_rel: true, pregunta_rel: true } } },
      });
      if (!a) throw noEncontrado('AREA_NO_ENCONTRADA', 'No existe el área indicada.');
      if (a._count.tramite_rel) {
        throw conflicto('AREA_EN_USO', 'El área resuelve trámites. Reasigna esos trámites antes de eliminarla.', { tramites: a._count.tramite_rel });
      }
      // Las carreras y las preguntas frecuentes asociadas quedan sin área (la base de datos las desvincula).
      await tx.area_institucional.delete({ where: { id } });
      await this.auditoria.registrar(tx, {
        usuarioId: admin.usuarioId,
        accion: 'eliminar',
        entidad: 'area_institucional',
        entidadId: id,
        detalle: { nombre: a.nombre, carrerasDesvinculadas: a._count.carrera_rel, preguntasDesvinculadas: a._count.pregunta_rel },
      });
    });
    this.invalidador.invalidar();
  }

  private datos(dto: ActualizarAreaDto): Prisma.area_institucionalUncheckedUpdateInput {
    const d: Prisma.area_institucionalUncheckedUpdateInput = {};
    if (dto.nombre !== undefined) d.nombre = dto.nombre;
    if (dto.descripcion !== undefined) d.descripcion = dto.descripcion;
    if (dto.espacioId !== undefined) d.espacio_id = dto.espacioId;
    if (dto.horarioAtencion !== undefined) d.horario_atencion = dto.horarioAtencion;
    if (dto.correoContacto !== undefined) d.correo_contacto = dto.correoContacto;
    if (dto.anexo !== undefined) d.anexo = dto.anexo;
    return d;
  }

  private async validar(tx: Prisma.TransactionClient, nombre?: string, espacioId?: number | null, excluirId?: number) {
    if (nombre !== undefined) {
      const existe = await tx.area_institucional.findFirst({
        where: { nombre: { equals: nombre, mode: 'insensitive' }, ...(excluirId ? { id: { not: excluirId } } : {}) },
        select: { id: true },
      });
      if (existe) throw conflicto('NOMBRE_DUPLICADO', `Ya existe un área llamada "${nombre}".`);
    }
    if (espacioId && !(await tx.espacio.findUnique({ where: { id: espacioId }, select: { id: true } }))) {
      throw invalido('SALA_INEXISTENTE', 'La sala indicada para el área no existe.');
    }
  }
}
