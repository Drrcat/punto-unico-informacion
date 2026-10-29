import { BadRequestException, HttpStatus, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { ErrorNegocio, conflicto } from '../../src/common/filtros/errores';
import { FiltroErrores } from '../../src/common/filtros/filtro-errores';

function capturar(error: unknown): { estado: number; cuerpo: Record<string, unknown> } {
  const res = { estado: 0, cuerpo: {} as Record<string, unknown>, status(e: number) { this.estado = e; return this; }, json(c: Record<string, unknown>) { this.cuerpo = c; } };
  const host = { switchToHttp: () => ({ getResponse: () => res }) };
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
  new FiltroErrores().catch(error, host as never);
  return { estado: res.estado, cuerpo: res.cuerpo };
}

describe('FiltroErrores', () => {
  it('entrega los errores de negocio con su código y datos extra', () => {
    const r = capturar(conflicto('SALA_EN_USO', 'Está en uso.', { areas: [1] }));
    expect(r).toEqual({ estado: 409, cuerpo: { statusCode: 409, codigo: 'SALA_EN_USO', mensaje: 'Está en uso.', areas: [1] } });
  });
  it('convierte los errores de validación en un código estable con el detalle', () => {
    const r = capturar(new BadRequestException({ message: ['codigo no debe estar vacío', 'pisoId debe ser un entero'], error: 'Bad Request', statusCode: 400 }));
    expect(r.estado).toBe(400);
    expect(r.cuerpo).toMatchObject({ codigo: 'VALIDACION', mensaje: 'codigo no debe estar vacío', detalle: ['codigo no debe estar vacío', 'pisoId debe ser un entero'] });
  });
  it('asigna un código a los errores HTTP de Nest', () => {
    expect(capturar(new NotFoundException()).cuerpo).toMatchObject({ statusCode: 404, codigo: 'NO_ENCONTRADO' });
  });
  it('traduce los errores conocidos de Prisma', () => {
    const e = (code: string) => new Prisma.PrismaClientKnownRequestError('x', { code, clientVersion: 'test' });
    expect(capturar(e('P2002'))).toMatchObject({ estado: 409, cuerpo: { codigo: 'DUPLICADO' } });
    expect(capturar(e('P2025')).estado).toBe(404);
    expect(capturar(e('P2003')).cuerpo).toMatchObject({ codigo: 'REFERENCIA_INVALIDA' });
  });
  it('no filtra detalles de errores inesperados', () => {
    const r = capturar(new Error('password=hunter2 en la conexión postgres://u:p@host/db'));
    expect(r.estado).toBe(HttpStatus.INTERNAL_SERVER_ERROR);
    expect(JSON.stringify(r.cuerpo)).not.toMatch(/hunter2|postgres:/);
    expect(r.cuerpo).toMatchObject({ codigo: 'ERROR_INTERNO' });
  });
  it('ErrorNegocio expone su código', () => {
    expect(new ErrorNegocio(HttpStatus.GONE, 'X', 'y').codigo).toBe('X');
  });
});
