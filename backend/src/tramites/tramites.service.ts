import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TramitesService {
  constructor(private prisma: PrismaService) {}

  // LEER todos los trámites activos (lista resumida para el buscador del tótem)
  findAll() {
    return this.prisma.tramite.findMany({
      where: { activo: true },
      orderBy: { nombre: 'asc' },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        plazo_dias: true,
        area: { select: { id: true, nombre: true } },
      },
    });
  }

  // LEER un trámite activo con su guía completa: pasos en orden y requisitos
  async findOne(id: number) {
    const tramite = await this.prisma.tramite.findFirst({
      where: { id, activo: true },
      select: {
        id: true,
        nombre: true,
        descripcion: true,
        plazo_dias: true,
        area: {
          select: { id: true, nombre: true, horario_atencion: true },
        },
        paso_rel: {
          orderBy: { orden: 'asc' },
          select: { orden: true, titulo: true, descripcion: true },
        },
        requisito_rel: {
          // Primero los obligatorios
          orderBy: [{ obligatorio: 'desc' }, { id: 'asc' }],
          select: { nombre: true, obligatorio: true },
        },
      },
    });
    if (!tramite) throw new NotFoundException(`No existe el trámite ${id}`);
    return tramite;
  }
}
