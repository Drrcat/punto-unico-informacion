import { construirCorreoCodigo } from '../../src/integraciones/correo/plantilla';

describe('correo con el código', () => {
  const base = { para: 'ana@ejemplo.cl', codigo: '042917', vigenciaMin: 5, institucion: 'Institución de Prueba' };
  it('incluye el código, la vigencia y el nombre de la institución', () => {
    const c = construirCorreoCodigo(base);
    expect(c.asunto).toBe('Institución de Prueba: tu código de verificación');
    for (const parte of [c.texto, c.html]) {
      expect(parte).toContain('042917');
      expect(parte).toContain('5 minutos');
      expect(parte).toContain('Institución de Prueba');
    }
  });
  it('escribe "1 minuto" en singular', () => {
    expect(construirCorreoCodigo({ ...base, vigenciaMin: 1 }).texto).toContain('1 minuto.');
  });
  it('escapa el nombre de la institución en el HTML', () => {
    const c = construirCorreoCodigo({ ...base, institucion: '<script>alert(1)</script> & Cía' });
    expect(c.html).not.toContain('<script>');
    expect(c.html).toContain('&lt;script&gt;');
    expect(c.html).toContain('&amp; Cía');
  });
  it('usa un nombre por defecto si la institución viene vacía', () => {
    expect(construirCorreoCodigo({ ...base, institucion: '  ' }).asunto).toContain('OrientaSede');
  });
});
