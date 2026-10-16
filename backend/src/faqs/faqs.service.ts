import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class FaqsService {
  constructor(private prisma: PrismaService) {}

  // LEER todas las publicadas (para el tótem)
  findAll() {
    return this.prisma.pregunta_frecuente.findMany({
      where: { publicada: true },
      orderBy: { id: 'asc' },
      select: {
        id: true,
        pregunta: true,
        respuesta: true,
        categoria: { select: { nombre: true } },
        area: { select: { nombre: true } },
      },
    });
  }

  // LEER una por id
  findOne(id: number) {
    return this.prisma.pregunta_frecuente.findUnique({ where: { id } });
  }

  // CREAR una pregunta
  create(datos: any) {
    return this.prisma.pregunta_frecuente.create({
      data: {
        pregunta: datos.pregunta,
        respuesta: datos.respuesta,
        publicada: datos.publicada ?? false,
        categoria_id: datos.categoria_id,
        area_id: datos.area_id ?? null,
        creado_por_id: datos.creado_por_id,
      },
    });
  }

  // EDITAR una pregunta
  update(id: number, datos: any) {
    return this.prisma.pregunta_frecuente.update({
      where: { id },
      data: {
        pregunta: datos.pregunta,
        respuesta: datos.respuesta,
        publicada: datos.publicada,
        categoria_id: datos.categoria_id,
        area_id: datos.area_id,
      },
    });
  }

  // BORRAR una pregunta
  remove(id: number) {
    return this.prisma.pregunta_frecuente.delete({ where: { id } });
  }
}