import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';

// Campos que el tótem muestra de cada pregunta
const camposPublicos = {
  id: true,
  pregunta: true,
  respuesta: true,
  categoria: { select: { nombre: true } },
  area: { select: { nombre: true } },
};

@Injectable()
export class FaqsService {
  constructor(private prisma: PrismaService) {}

  // LEER todas las publicadas (para el tótem)
  findAll() {
    return this.prisma.pregunta_frecuente.findMany({
      where: { publicada: true },
      orderBy: { id: 'asc' },
      select: camposPublicos,
    });
  }

  findAllForAdmin() {
    return this.prisma.pregunta_frecuente.findMany({
      orderBy: { id: 'asc' },
      select: {
        id: true,
        pregunta: true,
        respuesta: true,
        publicada: true,
        categoria_id: true,
        categoria: { select: { nombre: true } },
      },
    });
  }

  findCategories() {
    return this.prisma.categoria_faq.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true },
    });
  }

  // LEER una publicada por id. Si no existe o no está publicada → 404
  async findOne(id: number) {
    const faq = await this.prisma.pregunta_frecuente.findFirst({
      where: { id, publicada: true },
      select: camposPublicos,
    });
    if (!faq) throw new NotFoundException(`No existe la pregunta ${id}`);
    return faq;
  }

  // CREAR una pregunta
  create(datos: CreateFaqDto) {
    const creadorId = Number(process.env.FAQ_CREATED_BY_ID);
    if (!Number.isInteger(creadorId) || creadorId < 1) {
      throw new ServiceUnavailableException(
        'Configura FAQ_CREATED_BY_ID con el id de un usuario existente antes de crear preguntas frecuentes',
      );
    }

    return this.guardar(() =>
      this.prisma.pregunta_frecuente.create({
        data: {
          pregunta: datos.pregunta,
          respuesta: datos.respuesta,
          categoria_id: datos.categoria_id,
          ...(datos.area_id !== undefined ? { area_id: datos.area_id } : {}),
          ...(datos.publicada !== undefined
            ? { publicada: datos.publicada }
            : {}),
          creado_por_id: creadorId,
        },
      }),
    );
  }

  // EDITAR una pregunta (solo los campos enviados)
  async update(id: number, datos: UpdateFaqDto) {
    await this.verificarQueExiste(id);
    return this.guardar(() =>
      this.prisma.pregunta_frecuente.update({ where: { id }, data: datos }),
    );
  }

  // BORRAR una pregunta
  async remove(id: number) {
    await this.verificarQueExiste(id);
    return this.prisma.pregunta_frecuente.delete({ where: { id } });
  }

  // Lanza 404 si la pregunta no existe (publicada o no, para poder editarla)
  private async verificarQueExiste(id: number) {
    const faq = await this.prisma.pregunta_frecuente.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!faq) throw new NotFoundException(`No existe la pregunta ${id}`);
  }

  // Si categoria_id, area_id o creado_por_id apuntan a algo que no existe,
  // Prisma lanza el error P2003. Lo convertimos en un 400 entendible en vez de un 500.
  private async guardar<T>(operacion: () => Promise<T>) {
    try {
      return await operacion();
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2003'
      ) {
        throw new BadRequestException(
          'La categoría, el área o el usuario indicado no existe',
        );
      }
      throw error;
    }
  }
}
