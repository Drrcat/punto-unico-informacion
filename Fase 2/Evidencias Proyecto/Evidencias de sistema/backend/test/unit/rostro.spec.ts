import { evaluarRostro, MENSAJES_RECHAZO } from '../../src/modulos/enrolamiento/rostro';
import { RostroDetectado } from '../../src/integraciones/vision/validador-rostros';
import { rostroBueno } from '../soporte/falsos';

const dim = { ancho: 640, alto: 480 };
const con = (cambios: Partial<RostroDetectado>): RostroDetectado[] => [{ ...rostroBueno(), ...cambios }];
const caja = (x0: number, y0: number, x1: number, y1: number) => [{ x: x0, y: y0 }, { x: x1, y: y0 }, { x: x1, y: y1 }, { x: x0, y: y1 }];

describe('evaluarRostro', () => {
  it('acepta un rostro único, de frente, nítido y encuadrado', () => {
    const r = evaluarRostro([rostroBueno()], dim);
    expect(r).toEqual({ valido: true, confianza: 0.97, motivo: null, mensaje: null });
  });

  it.each([
    ['SIN_ROSTRO', [] as RostroDetectado[]],
    ['VARIOS_ROSTROS', [rostroBueno(), rostroBueno()]],
    ['BAJA_CONFIANZA', con({ confianza: 0.7 })],
    ['ROSTRO_DE_LADO', con({ giro: 40 })],
    ['ROSTRO_DE_LADO', con({ ladeo: -30 })],
    ['POCA_LUZ', con({ subexpuesta: 'LIKELY' })],
    ['IMAGEN_BORROSA', con({ borrosa: 'VERY_LIKELY' })],
    ['ROSTRO_CORTADO', con({ caja: caja(-40, 100, 160, 300) })],
    ['ROSTRO_LEJANO', con({ caja: caja(290, 210, 350, 270) })],
    ['ROSTRO_CERCANO', con({ caja: caja(5, 5, 635, 475) })],
    ['ROSTRO_DESCENTRADO', con({ caja: caja(430, 100, 630, 340) })],
  ])('rechaza con %s', (motivo, rostros) => {
    const r = evaluarRostro(rostros, dim);
    expect(r.valido).toBe(false);
    expect(r.motivo).toBe(motivo);
    expect(r.mensaje).toBe(MENSAJES_RECHAZO[motivo as keyof typeof MENSAJES_RECHAZO]);
  });

  it('rechaza una imagen de muy baja resolución antes de mirar el rostro', () => {
    expect(evaluarRostro([rostroBueno()], { ancho: 200, alto: 150 }).motivo).toBe('RESOLUCION_BAJA');
  });

  it('un rostro de fondo con baja confianza no cuenta como otra persona', () => {
    const fondo = { ...rostroBueno(), confianza: 0.4 };
    expect(evaluarRostro([rostroBueno(), fondo], dim).valido).toBe(true);
  });

  it('"probablemente" nublado o desenfocado todavía pasa; "UNKNOWN" no bloquea', () => {
    expect(evaluarRostro(con({ borrosa: 'POSSIBLE', subexpuesta: 'UNKNOWN' }), dim).valido).toBe(true);
  });

  it('cada motivo tiene una indicación para la persona', () => {
    for (const m of Object.values(MENSAJES_RECHAZO)) expect(m.length).toBeGreaterThan(10);
  });
});
