import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// Datos que el tótem muestra de cada área, incluida su ubicación física
// (sala, piso y edificio) para responder "¿dónde debo ir?".
const camposArea = {
  id: true,
  nombre: true,
  descripcion: true,
  horario_atencion: true,
  correo_contacto: true,
  anexo: true,
  espacio: {
    select: {
      codigo: true,
      nombre: true,
      svg_element_id: true,
      piso: {
        select: {
          numero: true,
          nombre: true,
          edificio: { select: { nombre: true } },
        },
      },
    },
  },
};

@Injectable()
export class AreasService {
  constructor(private prisma: PrismaService) {}

  // LEER todas las áreas, ordenadas por nombre para el directorio
  findAll() {
    return this.prisma.area_institucional.findMany({
      orderBy: { nombre: 'asc' },
      select: camposArea,
    });
  }

  // LEER un área, junto con sus trámites activos
  async findOne(id: number) {
    const area = await this.prisma.area_institucional.findUnique({
      where: { id },
      select: {
        ...camposArea,
        tramite_rel: {
          where: { activo: true },
          orderBy: { nombre: 'asc' },
          select: { id: true, nombre: true },
        },
      },
    });
    if (!area) throw new NotFoundException(`No existe el área ${id}`);
    return area;
  }
}
