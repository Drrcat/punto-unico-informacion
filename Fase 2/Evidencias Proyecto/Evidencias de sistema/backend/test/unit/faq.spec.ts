import { BadRequestException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { FaqService } from '../../src/modulos/faq/faq.service';

/** Preguntas frecuentes, sin base de datos: Prisma se reemplaza por funciones falsas. */
describe('FaqService', () => {
  const faqEjemplo = { id: 1, pregunta: '¿Pregunta?', respuesta: 'Respuesta.', categoria: { nombre: 'General' }, area: null };
  const datosNuevos = { pregunta: 'Nueva', respuesta: 'Resp', categoria_id: 1 };
  const errorLlaveForanea = new Prisma.PrismaClientKnownRequestError('Foreign key constraint failed', { code: 'P2003', clientVersion: '6' });

  const tabla = { findMany: jest.fn(), findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), delete: jest.fn() };
  const categorias = { findMany: jest.fn() };
  const servicio = new FaqService({ pregunta_frecuente: tabla, categoria_faq: categorias } as unknown as PrismaService);

  const creadorOriginal = process.env.FAQ_CREATED_BY_ID;
  beforeEach(() => {
    jest.resetAllMocks();
    process.env.FAQ_CREATED_BY_ID = '7';
  });
  afterAll(() => {
    process.env.FAQ_CREATED_BY_ID = creadorOriginal;
  });

  it('listar pide solo las publicadas, ordenadas por id', async () => {
    tabla.findMany.mockResolvedValue([faqEjemplo]);
    await expect(servicio.listar()).resolves.toEqual([faqEjemplo]);
    expect(tabla.findMany).toHaveBeenCalledWith(expect.objectContaining({ where: { publicada: true }, orderBy: { id: 'asc' } }));
  });

  it('listarAdmin incluye los borradores', async () => {
    tabla.findMany.mockResolvedValue([]);
    await servicio.listarAdmin();
    expect(tabla.findMany.mock.calls[0][0].where).toBeUndefined();
  });

  it('categorias las ordena por orden y nombre', async () => {
    categorias.findMany.mockResolvedValue([]);
    await servicio.categorias();
    expect(categorias.findMany).toHaveBeenCalledWith(expect.objectContaining({ orderBy: [{ orden: 'asc' }, { nombre: 'asc' }] }));
  });

  it('obtener devuelve una publicada y responde 404 si no existe o es borrador', async () => {
    tabla.findFirst.mockResolvedValueOnce(faqEjemplo).mockResolvedValueOnce(null);
    await expect(servicio.obtener(1)).resolves.toEqual(faqEjemplo);
    expect(tabla.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 1, publicada: true } }));
    await expect(servicio.obtener(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('crear fija el autor con FAQ_CREATED_BY_ID', async () => {
    tabla.create.mockResolvedValue({ id: 2 });
    await servicio.crear(datosNuevos);
    expect(tabla.create).toHaveBeenCalledWith({ data: { ...datosNuevos, creado_por_id: 7 } });
  });

  it('crear responde 503 si FAQ_CREATED_BY_ID no está configurada', () => {
    delete process.env.FAQ_CREATED_BY_ID;
    expect(() => servicio.crear(datosNuevos)).toThrow(ServiceUnavailableException);
    expect(tabla.create).not.toHaveBeenCalled();
  });

  it('crear responde 400 si la categoría, el área o el autor no existen', async () => {
    tabla.create.mockRejectedValue(errorLlaveForanea);
    await expect(servicio.crear(datosNuevos)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('crear deja pasar otros errores de la base sin disfrazarlos', async () => {
    const otro = new Error('sin conexión');
    tabla.create.mockRejectedValue(otro);
    await expect(servicio.crear(datosNuevos)).rejects.toBe(otro);
  });

  it('actualizar edita solo los campos enviados, también en borradores', async () => {
    tabla.findUnique.mockResolvedValue({ id: 1 });
    tabla.update.mockResolvedValue({ ...faqEjemplo, respuesta: 'Editada' });
    await expect(servicio.actualizar(1, { respuesta: 'Editada' })).resolves.toMatchObject({ respuesta: 'Editada' });
    expect(tabla.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { respuesta: 'Editada' } });
  });

  it('actualizar responde 404 y no toca la base si la FAQ no existe', async () => {
    tabla.findUnique.mockResolvedValue(null);
    await expect(servicio.actualizar(99, { respuesta: 'x' })).rejects.toBeInstanceOf(NotFoundException);
    expect(tabla.update).not.toHaveBeenCalled();
  });

  it('eliminar borra la FAQ si existe y responde 404 si no', async () => {
    tabla.findUnique.mockResolvedValueOnce({ id: 1 }).mockResolvedValueOnce(null);
    tabla.delete.mockResolvedValue(faqEjemplo);
    await expect(servicio.eliminar(1)).resolves.toEqual(faqEjemplo);
    await expect(servicio.eliminar(99)).rejects.toBeInstanceOf(NotFoundException);
    expect(tabla.delete).toHaveBeenCalledTimes(1);
  });
});
