import { cargarEntorno, EntornoInvalido } from '../../src/config/entorno';

const minimo = { DATABASE_URL: 'postgresql://x@localhost/x', JWT_SECRET: 'una-clave-de-prueba' };

describe('cargarEntorno', () => {
  it('con lo mínimo usa valores por defecto razonables', () => {
    const e = cargarEntorno({ ...minimo });
    expect(e).toMatchObject({ puerto: 3000, totemId: 1, host: '0.0.0.0', produccion: false, limitesActivos: true, tareasActivas: true });
    expect(e.correo.driver).toBe('consola');
    expect(e.vision.driver).toBe('simulado');
    expect(e.advertencias.length).toBeGreaterThanOrEqual(2);
  });
  it('exige DATABASE_URL y JWT_SECRET, y lo informa todo junto', () => {
    expect(() => cargarEntorno({})).toThrow(/DATABASE_URL[\s\S]*JWT_SECRET/);
    expect(() => cargarEntorno({})).toThrow(EntornoInvalido);
  });
  it('en producción exige una clave JWT larga', () => {
    expect(() => cargarEntorno({ ...minimo, NODE_ENV: 'production', CORREO_API_KEY: 'k', CORREO_REMITENTE: 'a@b.cl' })).toThrow(/32 caracteres/);
  });
  it('elige Resend si hay clave de correo, y Google si hay credenciales', () => {
    const e = cargarEntorno({ ...minimo, CORREO_API_KEY: 're_123', CORREO_REMITENTE: 'no-responder@ejemplo.cl', GOOGLE_APPLICATION_CREDENTIALS: '/run/secrets/g.json' });
    expect(e.correo.driver).toBe('resend');
    expect(e.vision.driver).toBe('google');
    expect(e.advertencias).toEqual([expect.stringContaining('JWT_SECRET')]);
  });
  it('Resend sin remitente es un error', () => {
    expect(() => cargarEntorno({ ...minimo, CORREO_DRIVER: 'resend', CORREO_API_KEY: 'k' })).toThrow(/CORREO_REMITENTE/);
  });
  it('rechaza valores numéricos inválidos y proveedores desconocidos', () => {
    expect(() => cargarEntorno({ ...minimo, PORT: 'abc' })).toThrow(/PORT/);
    expect(() => cargarEntorno({ ...minimo, VISION_DRIVER: 'otro' })).toThrow(/VISION_DRIVER/);
  });
  it('interpreta las listas de orígenes y los interruptores', () => {
    const e = cargarEntorno({ ...minimo, CORS_ORIGENES: 'http://a.cl, http://b.cl ,', LIMITES: 'off', TAREAS: 'off', DOCS: 'on', NODE_ENV: 'production', JWT_SECRET: 'x'.repeat(40), CORREO_API_KEY: 'k', CORREO_REMITENTE: 'a@b.cl' });
    expect(e.corsOrigenes).toEqual(['http://a.cl', 'http://b.cl']);
    expect(e).toMatchObject({ limitesActivos: false, tareasActivas: false, docs: true });
  });
});
