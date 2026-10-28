import {
  BadRequestException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { FaqsService } from './faqs.service';
import { PrismaService } from '../prisma/prisma.service';
import { CreateFaqDto } from './dto/create-faq.dto';

// Pruebas unitarias del servicio. No usan la base real: se reemplaza Prisma
// por funciones falsas (jest.fn) para controlar qué "devuelve la base".
describe('FaqsService', () => {
  let service: FaqsService;
  const creadorIdAnterior = process.env.FAQ_CREATED_BY_ID;

  const faqEjemplo = {
    id: 1,
    pregunta: '¿Pregunta?',
    respuesta: 'Respuesta.',
    categoria: { nombre: 'General' },
    area: null,
  };

  const datosNuevos = {
    pregunta: 'Nueva',
    respuesta: 'Resp',
    categoria_id: 1,
  } satisfies CreateFaqDto;

  // Error que lanza Prisma cuando una llave foránea apunta a algo que no existe
  const errorLlaveForanea = new Prisma.PrismaClientKnownRequestError(
    'Foreign key constraint failed',
    { code: 'P2003', clientVersion: '5' },
  );

  // Prisma falso: solo los métodos que usa el servicio
  const prismaMock = {
    categoria_faq: {
      findMany: jest.fn(),
    },
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
    process.env.FAQ_CREATED_BY_ID = '1';

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FaqsService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<FaqsService>(FaqsService);
  });

  afterAll(() => {
    if (creadorIdAnterior === undefined) {
      delete process.env.FAQ_CREATED_BY_ID;
    } else {
      process.env.FAQ_CREATED_BY_ID = creadorIdAnterior;
    }
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

  describe('findAllForAdmin', () => {
    it('devuelve publicadas y borradores ordenados por id', async () => {
      tabla.findMany.mockResolvedValue([faqEjemplo]);

      await expect(service.findAllForAdmin()).resolves.toEqual([faqEjemplo]);
      expect(tabla.findMany).toHaveBeenCalledWith({
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
    });
  });

  describe('findCategories', () => {
    it('devuelve las categorías en orden de visualización', async () => {
      prismaMock.categoria_faq.findMany.mockResolvedValue([
        { id: 1, nombre: 'General' },
      ]);

      await expect(service.findCategories()).resolves.toEqual([
        { id: 1, nombre: 'General' },
      ]);
      expect(prismaMock.categoria_faq.findMany).toHaveBeenCalledWith({
        orderBy: [{ orden: 'asc' }, { nombre: 'asc' }],
        select: { id: true, nombre: true },
      });
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
      expect(tabla.create).toHaveBeenCalledWith({
        data: {
          pregunta: datosNuevos.pregunta,
          respuesta: datosNuevos.respuesta,
          categoria_id: datosNuevos.categoria_id,
          creado_por_id: 1,
        },
      });
    });

    it('falla explícitamente cuando no se configura el usuario creador', () => {
      delete process.env.FAQ_CREATED_BY_ID;

      expect(() => service.create(datosNuevos)).toThrow(
        ServiceUnavailableException,
      );
      expect(tabla.create).not.toHaveBeenCalled();
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
