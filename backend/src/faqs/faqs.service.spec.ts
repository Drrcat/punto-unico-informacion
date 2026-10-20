import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FaqsService } from './faqs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';

// Pruebas unitarias del servicio. No usan la base real: se reemplaza Prisma
// por funciones falsas (jest.fn) para controlar qué "devuelve la base".
describe('FaqsService', () => {
  let service: FaqsService;

  const faqEjemplo = {
    id: 1,
    pregunta: '¿Pregunta?',
    respuesta: 'Respuesta.',
    categoria: { nombre: 'General' },
    area: null,
  };

  const datosNuevos: CreateFaqDto = {
    pregunta: 'Nueva',
    respuesta: 'Resp',
    categoria_id: 1,
    creado_por_id: 1,
  };

  // Error que lanza Prisma cuando una llave foránea apunta a algo que no existe
  const errorLlaveForanea = new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    { code: 'P2003', clientVersion: '5' },
  );

  // Prisma falso: solo los métodos que usa el servicio
  const prismaMock = {
    pregunta_frecuente: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };
  const tabla = prismaMock.pregunta_frecuente;

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<FaqsService>(FaqsService);
  });

  describe('findAll', () => {
    it('pide solo las publicadas, ordenadas por id', async () => {
      tabla.findMany.mockResolvedValue([faqEjemplo]);

      await expect(service.findAll()).resolves.toEqual([faqEjemplo]);
      expect(tabla.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { publicada: true },
          orderBy: { id: 'asc' },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('devuelve la FAQ publicada cuando existe', async () => {
      tabla.findFirst.mockResolvedValue(faqEjemplo);

      await expect(service.findOne(1)).resolves.toEqual(faqEjemplo);
      expect(tabla.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1, publicada: true } }),
      );
    });

    it('lanza 404 si no existe o no está publicada', async () => {
      tabla.findFirst.mockResolvedValue(null);

      await expect(service.findOne(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('create', () => {
    it('guarda la FAQ con los datos recibidos', async () => {
      tabla.create.mockResolvedValue({ id: 2, ...datosNuevos });

      await service.create(datosNuevos);
      expect(tabla.create).toHaveBeenCalledWith({ data: datosNuevos });
    });

    it('responde 400 si la categoría, área o usuario no existe', async () => {
      tabla.create.mockRejectedValue(errorLlaveForanea);

      await expect(service.create(datosNuevos)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('deja pasar otros errores de la base sin disfrazarlos', async () => {
      const otroError = new Error('sin conexión');
      tabla.create.mockRejectedValue(otroError);

      await expect(service.create(datosNuevos)).rejects.toBe(otroError);
    });
  });

  describe('update', () => {
    it('edita la FAQ si existe (aunque no esté publicada)', async () => {
      tabla.findUnique.mockResolvedValue({ id: 1 });
      tabla.update.mockResolvedValue({ ...faqEjemplo, respuesta: 'Editada' });

      const resultado = await service.update(1, { respuesta: 'Editada' });
      expect(resultado.respuesta).toBe('Editada');
      expect(tabla.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 1 } }),
      );
      expect(tabla.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: { respuesta: 'Editada' },
      });
    });

    it('lanza 404 y no toca la base si la FAQ no existe', async () => {
      tabla.findUnique.mockResolvedValue(null);

      await expect(
        service.update(99, { respuesta: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(tabla.update).not.toHaveBeenCalled();
    });

    it('responde 400 si se cambia a una categoría que no existe', async () => {
      tabla.findUnique.mockResolvedValue({ id: 1 });
      tabla.update.mockRejectedValue(errorLlaveForanea);

      await expect(
        service.update(1, { categoria_id: 999 }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('remove', () => {
    it('borra la FAQ si existe', async () => {
      tabla.findUnique.mockResolvedValue({ id: 1 });
      tabla.delete.mockResolvedValue(faqEjemplo);

      await expect(service.remove(1)).resolves.toEqual(faqEjemplo);
      expect(tabla.delete).toHaveBeenCalledWith({ where: { id: 1 } });
    });

    it('lanza 404 y no borra nada si la FAQ no existe', async () => {
      tabla.findUnique.mockResolvedValue(null);

      await expect(service.remove(99)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(tabla.delete).not.toHaveBeenCalled();
    });
  });
});
