import { EstadoEnrolamiento } from '@prisma/client';
import { ErrorNegocio } from '../../src/common/filtros/errores';
import { exigirTransicion, origenesPosibles, puedeTransicionar } from '../../src/modulos/enrolamiento/estados';

describe('estados del enrolamiento (PU-15)', () => {
  it('acepta el camino normal: iniciado -> foto pendiente -> completado', () => {
    expect(puedeTransicionar('INICIADO', 'FOTO_PENDIENTE')).toBe(true);
    expect(puedeTransicionar('FOTO_PENDIENTE', 'COMPLETADO')).toBe(true);
  });
  it('rechaza volver atrás', () => {
    expect(puedeTransicionar('FOTO_PENDIENTE', 'INICIADO')).toBe(false);
    expect(puedeTransicionar('COMPLETADO', 'FOTO_PENDIENTE')).toBe(false);
    expect(() => exigirTransicion('COMPLETADO', 'INICIADO')).toThrow(ErrorNegocio);
  });
  it('completado y cancelado son finales', () => {
    for (const final of ['COMPLETADO', 'CANCELADO'] as EstadoEnrolamiento[]) {
      for (const otro of ['INICIADO', 'FOTO_PENDIENTE', 'COMPLETADO', 'FALLIDO', 'CANCELADO'] as EstadoEnrolamiento[]) expect(puedeTransicionar(final, otro)).toBe(false);
    }
  });
  it('desde fallido solo se reintenta o se cancela', () => {
    expect(puedeTransicionar('FALLIDO', 'FOTO_PENDIENTE')).toBe(true);
    expect(puedeTransicionar('FALLIDO', 'CANCELADO')).toBe(true);
    expect(puedeTransicionar('FALLIDO', 'COMPLETADO')).toBe(false);
  });
  it('no se puede quedar en el mismo estado', () => {
    expect(puedeTransicionar('FOTO_PENDIENTE', 'FOTO_PENDIENTE')).toBe(false);
  });
  it('los orígenes posibles de cada estado coinciden con las transiciones', () => {
    expect(origenesPosibles('COMPLETADO').sort()).toEqual(['FOTO_PENDIENTE']);
    expect(origenesPosibles('CANCELADO').sort()).toEqual(['FALLIDO', 'FOTO_PENDIENTE', 'INICIADO']);
    expect(origenesPosibles('INICIADO')).toEqual([]);
  });
});
