import { BadRequestException, Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ActualizarFaqDto, CrearFaqDto } from './faq.dto';

/** Campos que el tótem muestra de cada pregunta. */
const camposPublicos = {
  id: true,
  pregunta: true,
  respuesta: true,
  categoria: { select: { nombre: true } },
  area: { select: { nombre: true } },
} satisfies Prisma.pregunta_frecuenteSelect;

/** Preguntas frecuentes: lectura pública para el tótem y administración desde la aplicación de escritorio. */
@Injectable()
export class FaqService {
  constructor(private readonly prisma: PrismaService) {}

  /** Solo las publicadas, para el tótem. */
  listar() {
    return this.prisma.pregunta_frecuente.findMany({
      where: { publicada: true },
      orderBy: { id: 'asc' },
      select: camposPublicos,
    });
  }

  /** Todas, incluidos los borradores, para la aplicación de escritorio. */
  listarAdmin() {
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

  categorias() {
    return this.prisma.categoria_faq.findMany({
      orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
      select: { id: true, nombre: true },
    });
  }

  /** Una pregunta publicada. Si no existe o es un borrador → 404. */
  async obtener(id: number) {
    const faq = await this.prisma.pregunta_frecuente.findFirst({
      where: { id, publicada: true },
      select: camposPublicos,
    });
    if (!faq) throw new NotFoundException(`No existe la pregunta ${id}`);
    return faq;
  }

  crear(datos: CrearFaqDto) {
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
          ...(datos.publicada !== undefined ? { publicada: datos.publicada } : {}),
          creado_por_id: creadorId,
        },
      }),
    );
  }

  /** Edita solo los campos enviados. Funciona también con borradores. */
  async actualizar(id: number, datos: ActualizarFaqDto) {
    await this.verificarQueExiste(id);
    return this.guardar(() => this.prisma.pregunta_frecuente.update({ where: { id }, data: datos }));
  }

  async eliminar(id: number) {
    await this.verificarQueExiste(id);
    return this.prisma.pregunta_frecuente.delete({ where: { id } });
  }

  private async verificarQueExiste(id: number): Promise<void> {
    const faq = await this.prisma.pregunta_frecuente.findUnique({ where: { id }, select: { id: true } });
    if (!faq) throw new NotFoundException(`No existe la pregunta ${id}`);
  }

  /** Si la categoría, el área o el autor no existen, Prisma lanza P2003: se responde 400 en vez de 500. */
  private async guardar<T>(operacion: () => Promise<T>): Promise<T> {
    try {
      return await operacion();
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2003') {
        throw new BadRequestException('La categoría, el área o el usuario indicado no existe');
      }
      throw error;
    }
  }
}
