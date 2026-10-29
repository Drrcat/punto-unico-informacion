import { crearApp, Contexto } from '../soporte/app';
import { sembrar, vaciar } from '../soporte/fixtures';

describe('Límites de solicitudes', () => {
  let c: Contexto;
  beforeAll(async () => {
    c = await crearApp({ limitesActivos: true, limitePorMinuto: 30 });
    await vaciar(c.prisma);
    await sembrar(c.prisma);
  });
  afterAll(() => c.cerrar());

  it('frena las ráfagas en las rutas de enrolamiento sin afectar al mapa', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 12; i++) estados.push((await c.http().post('/api/enrolamiento/autenticar').send({ correo: `persona${i}@ejemplo.cl` })).status);
    expect(estados.slice(0, 10).every((s) => s === 201)).toBe(true);
    expect(estados.slice(10)).toEqual([429, 429]);
    const r = await c.http().post('/api/enrolamiento/autenticar').send({ correo: 'otra@ejemplo.cl' }).expect(429);
    expect(r.body.codigo).toBe('DEMASIADAS_SOLICITUDES');
    expect(c.correo.enviados).toHaveLength(10);
  });

  it('aplica el límite general a todo lo demás', async () => {
    const estados: number[] = [];
    for (let i = 0; i < 40; i++) estados.push((await c.http().get('/api/pisos')).status);
    expect(estados.filter((s) => s === 200).length).toBeGreaterThan(0);
    expect(estados.filter((s) => s === 429).length).toBeGreaterThan(0);
  });
});
