import { NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { FaqsService } from './faqs.service';
import { PrismaService } from '../prisma/prisma.service';

// Pruebas unitarias del servicio. No usan la base real: se reemplaza Prisma
// por funciones falsas (jest.fn) para controlar qué "devuelve la base".
describe('FaqsService', () => {
  let service: FaqsService;

  const faqEjemplo = {
    id: 1,
    pregunta: '¿Pregunta?',
    respuesta: 'Respuesta.',
    creadaEn: new Date(),
  };

  // Prisma falso: solo los métodos que usa el servicio
  const prismaMock = {
    faq: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

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

  it('findAll devuelve todas las FAQ ordenadas por id', async () => {
    prismaMock.faq.findMany.mockResolvedValue([faqEjemplo]);

    await expect(service.findAll()).resolves.toEqual([faqEjemplo]);
    expect(prismaMock.faq.findMany).toHaveBeenCalledWith({
      orderBy: { id: 'asc' },
    });
  });

  it('findOne devuelve la FAQ cuando existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(faqEjemplo);

    await expect(service.findOne(1)).resolves.toEqual(faqEjemplo);
    expect(prismaMock.faq.findUnique).toHaveBeenCalledWith({
      where: { id: 1 },
    });
  });

  it('findOne lanza 404 cuando la FAQ no existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(null);

    await expect(service.findOne(99)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('create guarda la FAQ con los datos recibidos', async () => {
    const datos = { pregunta: 'Nueva', respuesta: 'Resp' };
    prismaMock.faq.create.mockResolvedValue({ ...faqEjemplo, ...datos });

    await service.create(datos);
    expect(prismaMock.faq.create).toHaveBeenCalledWith({ data: datos });
  });

  it('update edita la FAQ si existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(faqEjemplo);
    prismaMock.faq.update.mockResolvedValue({
      ...faqEjemplo,
      respuesta: 'Editada',
    });

    const resultado = await service.update(1, { respuesta: 'Editada' });
    expect(resultado.respuesta).toBe('Editada');
    expect(prismaMock.faq.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { respuesta: 'Editada' },
    });
  });

  it('update lanza 404 y no toca la base si la FAQ no existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(null);

    await expect(service.update(99, { respuesta: 'x' })).rejects.toBeInstanceOf(
      NotFoundException,
    );
    expect(prismaMock.faq.update).not.toHaveBeenCalled();
  });

  it('remove borra la FAQ si existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(faqEjemplo);
    prismaMock.faq.delete.mockResolvedValue(faqEjemplo);

    await expect(service.remove(1)).resolves.toEqual(faqEjemplo);
    expect(prismaMock.faq.delete).toHaveBeenCalledWith({ where: { id: 1 } });
  });

  it('remove lanza 404 y no borra nada si la FAQ no existe', async () => {
    prismaMock.faq.findUnique.mockResolvedValue(null);

    await expect(service.remove(99)).rejects.toBeInstanceOf(NotFoundException);
    expect(prismaMock.faq.delete).not.toHaveBeenCalled();
  });
});
