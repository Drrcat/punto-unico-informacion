import { HttpStatus, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { conflicto, ErrorNegocio, invalido, noEncontrado } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { AuditoriaService } from '../../common/registro/auditoria.service';
import { buscar, Indexado, indexar } from '../../common/util/buscador';
import { IndiceCache, Invalidador } from '../../common/util/indice-cache';
import { compararNatural, incluirUbicacion, urlPlano } from '../../common/util/vistas';
import { ActualizarSalaDto, CrearSalaDto } from './salas.dto';

export interface VistaSala {
  id: number;
  codigo: string;
  nombre: string | null;
  tipo: { id: number; nombre: string };
  capacidad: number | null;
  activo: boolean;
  svgElementId: string | null;
  piso: { id: number; numero: number; nombre: string; planoUrl: string | null };
  edificio: { id: number; nombre: string };
  alias: string[];
  areas: { id: number; nombre: string }[];
}

interface FiltrosSalas {
  q?: string;
  pisoId?: number;
  tipoEspacioId?: number;
  limite: number;
  desplazamiento: number;
  admin: boolean;
}

const incluirDetalle = {
  ...incluirUbicacion,
  alias_rel: { orderBy: { alias: 'asc' } },
  equipamiento_rel: { orderBy: { nombre: 'asc' } },
  area_rel: true,
} satisfies Prisma.espacioInclude;

type EspacioDetalle = Prisma.espacioGetPayload<{ include: typeof incluirDetalle }>;

type ItemIndice = VistaSala & { esBuscable: boolean };

@Injectable()
export class SalasService {
  private readonly indice: IndiceCache<ItemIndice>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditoria: AuditoriaService,
    private readonly invalidador: Invalidador,
  ) {
    this.indice = new IndiceCache(() => this.cargarIndice());
    invalidador.suscribir(() => this.indice.invalidar());
  }

  private vista(e: EspacioDetalle): ItemIndice {
    return {
      id: e.id,
      codigo: e.codigo,
      nombre: e.nombre,
      tipo: { id: e.tipo_espacio.id, nombre: e.tipo_espacio.nombre },
      capacidad: e.capacidad,
      activo: e.activo,
      svgElementId: e.svg_element_id,
      piso: { id: e.piso.id, numero: e.piso.numero, nombre: e.piso.nombre, planoUrl: urlPlano(e.piso.id, e.piso.plano_svg_ruta) },
      edificio: { id: e.piso.edificio.id, nombre: e.piso.edificio.nombre },
      alias: e.alias_rel.map((a) => a.alias),
      areas: e.area_rel.map((a) => ({ id: a.id, nombre: a.nombre })),
      esBuscable: e.tipo_espacio.es_buscable,
    };
  }

  private async cargarIndice(): Promise<Indexado<ItemIndice>[]> {
    const espacios = await this.prisma.espacio.findMany({ include: incluirDetalle });
    return espacios.map((e) => {
      const v = this.vista(e);
      return indexar(v, [
        { texto: v.codigo, peso: 1 },
        { texto: v.nombre, peso: 1 },
        ...v.alias.map((a) => ({ texto: a, peso: 0.9 })),
        ...v.areas.map((a) => ({ texto: a.nombre, peso: 0.6 })),
        { texto: v.tipo.nombre, peso: 0.4 },
      ]);
    });
  }

  async tipos() {
    const t = await this.prisma.tipo_espacio.findMany({ orderBy: { nombre: 'asc' } });
    return t.map((x) => ({ id: x.id, nombre: x.nombre, esBuscable: x.es_buscable }));
  }

  async listar(f: FiltrosSalas): Promise<{ total: number; items: VistaSala[] }> {
    const todo = await this.indice.obtener();
    // Quien no es administrador solo ve espacios activos y de tipos que se pueden buscar.
    let base = todo.filter((d) => f.admin || (d.item.activo && d.item.esBuscable));
    if (f.pisoId) base = base.filter((d) => d.item.piso.id === f.pisoId);
    if (f.tipoEspacioId) base = base.filter((d) => d.item.tipo.id === f.tipoEspacioId);

    const orden = (a: ItemIndice, b: ItemIndice) => a.piso.numero - b.piso.numero || compararNatural(a.codigo, b.codigo);
    const encontrados = f.q ? buscar(f.q, base, orden) : base.map((d) => d.item).sort(orden);
    const items = encontrados.slice(f.desplazamiento, f.desplazamiento + f.limite).map(({ esBuscable: _omitido, ...v }) => v);
    return { total: encontrados.length, items };
  }

  async obtener(id: number, admin: boolean) {
    const e = await this.prisma.espacio.findUnique({ where: { id }, include: incluirDetalle });
    if (!e || (!e.activo && !admin)) throw noEncontrado('SALA_NO_ENCONTRADA', 'No existe la sala indicada.');
    const { esBuscable: _omitido, ...v } = this.vista(e);
    return {
      ...v,
      equipamiento: e.equipamiento_rel.map((q) => ({ id: q.id, nombre: q.nombre, cantidad: q.cantidad, observacion: q.observacion })),
      areas: e.area_rel.map((a) => ({
        id: a.id,
        nombre: a.nombre,
        descripcion: a.descripcion,
        horarioAtencion: a.horario_atencion,
        contacto: { correo: a.correo_contacto, anexo: a.anexo },
      })),
    };
  }

  // ------------------------------------------------------------------ administración

  async crear(dto: CrearSalaDto, admin: AdminActual) {
    const id = await this.prisma.$transaction(async (tx) => {
      await this.validarReferencias(tx, dto.pisoId, dto.tipoEspacioId);
      await this.validarUnicos(tx, dto.pisoId, dto.codigo, dto.svgElementId ?? null);
      const equipamiento = this.normalizarEquipamiento(dto.equipamiento);
      const e = await tx.espacio.create({
        data: {
          piso_id: dto.pisoId,
          tipo_espacio_id: dto.tipoEspacioId,
          codigo: dto.codigo,
          nombre: dto.nombre ?? null,
          svg_element_id: dto.svgElementId ?? null,
          capacidad: dto.capacidad ?? null,
          activo: dto.activo ?? true,
          alias_rel: { create: this.normalizarAlias(dto.alias).map((alias) => ({ alias })) },
          equipamiento_rel: { create: equipamiento },
        },
      });
      await this.auditoria.registrar(tx, { usuarioId: admin.usuarioId, accion: 'crear', entidad: 'espacio', entidadId: e.id, detalle: { codigo: e.codigo, pisoId: e.piso_id } });
      return e.id;
    });
    this.invalidador.invalidar();
    return this.obtener(id, true);
  }

  async actualizar(id: number, dto: ActualizarSalaDto, admin: AdminActual) {
    await this.prisma.$transaction(async (tx) => {
      const actual = await tx.espacio.findUnique({ where: { id } });
      if (!actual) throw noEncontrado('SALA_NO_ENCONTRADA', 'No existe la sala indicada.');
      const pisoId = dto.pisoId ?? actual.piso_id;
      const codigo = dto.codigo ?? actual.codigo;
      const svg = dto.svgElementId === undefined ? actual.svg_element_id : dto.svgElementId;
      await this.validarReferencias(tx, dto.pisoId, dto.tipoEspacioId);
      await this.validarUnicos(tx, pisoId, codigo, svg, id);

      const data: Prisma.espacioUncheckedUpdateInput = {};
      if (dto.pisoId !== undefined) data.piso_id = dto.pisoId;
      if (dto.tipoEspacioId !== undefined) data.tipo_espacio_id = dto.tipoEspacioId;
      if (dto.codigo !== undefined) data.codigo = dto.codigo;
      if (dto.nombre !== undefined) data.nombre = dto.nombre;
      if (dto.svgElementId !== undefined) data.svg_element_id = dto.svgElementId;
      if (dto.capacidad !== undefined) data.capacidad = dto.capacidad;
      if (dto.activo !== undefined) data.activo = dto.activo;
      await tx.espacio.update({ where: { id }, data });

      if (dto.alias !== undefined) {
        await tx.espacio_alias.deleteMany({ where: { espacio_id: id } });
        await tx.espacio_alias.createMany({ data: this.normalizarAlias(dto.alias).map((alias) => ({ espacio_id: id, alias })) });
      }
      if (dto.equipamiento !== undefined) {
        const equipamiento = this.normalizarEquipamiento(dto.equipamiento);
        await tx.equipamiento.deleteMany({ where: { espacio_id: id } });
        await tx.equipamiento.createMany({ data: equipamiento.map((q) => ({ ...q, espacio_id: id })) });
      }
      await this.auditoria.registrar(tx, { usuarioId: admin.usuarioId, accion: 'editar', entidad: 'espacio', entidadId: id, detalle: { campos: Object.keys(dto) } });
    });
    this.invalidador.invalidar();
    return this.obtener(id, true);
  }

  async eliminar(id: number, admin: AdminActual): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const e = await tx.espacio.findUnique({ where: { id }, include: { area_rel: { select: { id: true, nombre: true } }, _count: { select: { totem_rel: true } } } });
      if (!e) throw noEncontrado('SALA_NO_ENCONTRADA', 'No existe la sala indicada.');
      if (e.area_rel.length || e._count.totem_rel) {
        throw conflicto('SALA_EN_USO', 'La sala está asignada a un área o a un tótem. Quita esa asignación antes de eliminarla, o márcala como inactiva.', {
          areas: e.area_rel,
          totems: e._count.totem_rel,
        });
      }
      await tx.espacio.delete({ where: { id } });
      await this.auditoria.registrar(tx, { usuarioId: admin.usuarioId, accion: 'eliminar', entidad: 'espacio', entidadId: id, detalle: { codigo: e.codigo, pisoId: e.piso_id } });
    });
    this.invalidador.invalidar();
  }

  // ------------------------------------------------------------------ validaciones

  private async validarReferencias(tx: Prisma.TransactionClient, pisoId?: number, tipoId?: number) {
    if (pisoId !== undefined && !(await tx.piso.findUnique({ where: { id: pisoId }, select: { id: true } }))) {
      throw invalido('PISO_INEXISTENTE', 'El piso indicado no existe.');
    }
    if (tipoId !== undefined && !(await tx.tipo_espacio.findUnique({ where: { id: tipoId }, select: { id: true } }))) {
      throw invalido('TIPO_INEXISTENTE', 'El tipo de espacio indicado no existe.');
    }
  }

  private async validarUnicos(tx: Prisma.TransactionClient, pisoId: number, codigo: string, svg: string | null, excluirId?: number) {
    const distinto = excluirId ? { id: { not: excluirId } } : {};
    if (await tx.espacio.findFirst({ where: { piso_id: pisoId, codigo: { equals: codigo, mode: 'insensitive' }, ...distinto }, select: { id: true } })) {
      throw conflicto('CODIGO_DUPLICADO', `Ya existe una sala con el código "${codigo}" en ese piso.`);
    }
    if (svg && (await tx.espacio.findFirst({ where: { piso_id: pisoId, svg_element_id: svg, ...distinto }, select: { id: true } }))) {
      throw conflicto('SVG_DUPLICADO', `Otro espacio de ese piso ya usa el elemento del plano "${svg}".`);
    }
  }

  private normalizarAlias(alias: string[] | undefined): string[] {
    const vistos = new Map<string, string>();
    for (const a of alias ?? []) {
      const limpio = a.trim();
      // Si se repite con otras mayúsculas, se conserva la primera forma escrita.
      if (limpio && !vistos.has(limpio.toLowerCase())) vistos.set(limpio.toLowerCase(), limpio);
    }
    return [...vistos.values()];
  }

  private normalizarEquipamiento(lista: CrearSalaDto['equipamiento']) {
    const vistos = new Set<string>();
    return (lista ?? []).map((q) => {
      const clave = q.nombre.toLowerCase();
      if (vistos.has(clave)) throw new ErrorNegocio(HttpStatus.UNPROCESSABLE_ENTITY, 'EQUIPAMIENTO_DUPLICADO', `El equipamiento "${q.nombre}" está repetido.`);
      vistos.add(clave);
      return { nombre: q.nombre, cantidad: q.cantidad ?? 1, observacion: q.observacion ?? null };
    });
  }
}
