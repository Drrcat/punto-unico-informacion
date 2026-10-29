import { readFileSync } from 'fs';
import * as path from 'path';
import { PERMISOS } from '../../src/common/auth/permisos';
import { ejecutarSeed, Zona } from '../../src/seed/seed';
import { crearApp, crearAdmin, Contexto } from '../soporte/app';
import { vaciar } from '../soporte/fixtures';

/**
 * Lo que el mapa del tótem (`frontend-web/front-end/mapa-totem.html`) espera de la API, con los datos y los planos reales
 * del repositorio: si alguien cambia una respuesta, estas pruebas dicen qué se rompe en el mapa.
 */
const RAIZ = path.resolve(__dirname, '../../..');
const zonas = JSON.parse(readFileSync(path.join(RAIZ, 'database/prisma/seed/zonas.json'), 'utf8')) as Zona[];

describe('API que usa el mapa del tótem', () => {
  let c: Contexto;
  beforeAll(async () => {
    c = await crearApp({ planosDir: path.join(RAIZ, 'frontend-web/front-end/assets/planos') });
    await vaciar(c.prisma);
    await ejecutarSeed(c.prisma, {
      zonas,
      sedeNombre: 'Sede de prueba',
      edificioNombre: 'Edificio principal',
      totemId: 1,
      totemNombre: 'Tótem 1',
      institucionNombre: 'Institución de Prueba',
      dominiosCorreo: 'ejemplo.cl',
      conectorEnrolamiento: 'ninguno',
    });
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  const detalle = async (numero: number) => {
    const pisos = (await c.http().get('/api/pisos').expect(200)).body as { id: number; numero: number; planoUrl: string | null }[];
    const piso = pisos.find((p) => p.numero === numero) as { id: number; planoUrl: string };
    return { piso, ...(await c.http().get(`/api/pisos/${piso.id}`).expect(200)).body } as {
      piso: { id: number; planoUrl: string };
      espacios: { id: number; codigo: string; nombre: string; tipo: string; svgElementId: string }[];
    };
  };

  it.each([2, 3])('el piso %i trae un espacio por cada zona del mapa, con el id del dibujo', async (numero) => {
    const d = await detalle(numero);
    expect(d.espacios.map((e) => e.svgElementId).sort()).toEqual(zonas.filter((z) => z.piso === numero).map((z) => z.id).sort());
  });

  it('los tipos de espacio son los cinco que el mapa reconoce', async () => {
    const tipos = new Set([...(await detalle(2)).espacios, ...(await detalle(3)).espacios].map((e) => e.tipo));
    expect([...tipos].sort()).toEqual(['Ascensor', 'Baño', 'Escalera', 'Sala', 'Terraza']);
  });

  it.each([2, 3])('el plano del piso %i trae el dibujo de cada zona', async (numero) => {
    const { piso } = await detalle(numero);
    const r = await c.http().get(piso.planoUrl).expect(200);
    expect(r.headers['content-type']).toMatch(/image\/svg\+xml/);
    const svg = Buffer.isBuffer(r.body) ? r.body.toString('utf8') : r.text;
    for (const z of zonas.filter((x) => x.piso === numero)) expect(svg).toContain(`<g id="${z.id}" class="zona ${z.tipo}"`);
    expect(svg).toContain(`<g id="piso-${numero}"`);
  });

  it('la búsqueda devuelve el id del dibujo y el número de piso, y entiende alias', async () => {
    const porNombre = (await c.http().get('/api/salas?limite=100&q=PA-326').expect(200)).body.items[0];
    expect(porNombre).toMatchObject({ svgElementId: 'P3-T3-S31', piso: { numero: 3 } });
    const porAlias = (await c.http().get('/api/salas?limite=100&q=laboratorio').expect(200)).body.items;
    expect(porAlias.map((s: { svgElementId: string }) => s.svgElementId)).toContain('P3-T2-S13');
  });

  it('un cambio de nombre hecho por la API se ve en el detalle del piso y en la búsqueda', async () => {
    const { token } = await crearAdmin(c.prisma, [PERMISOS.SALA_EDITAR]);
    const sala = (await detalle(2)).espacios.find((e) => e.svgElementId === 'P2-T1-S03') as { id: number };
    await c.http().put(`/api/salas/${sala.id}`).set('Authorization', `Bearer ${token}`).send({ nombre: 'Laboratorio de Redes', alias: ['Sala 03'] }).expect(200);
    expect((await detalle(2)).espacios.find((e) => e.id === sala.id)).toMatchObject({ nombre: 'Laboratorio de Redes', svgElementId: 'P2-T1-S03' });
    const porAlias = (await c.http().get('/api/salas?limite=100&q=sala 03').expect(200)).body.items[0];
    expect(porAlias).toMatchObject({ id: sala.id, nombre: 'Laboratorio de Redes' });
  });

  it('un espacio desactivado deja de traerse en la búsqueda y en el detalle del piso', async () => {
    const { token } = await crearAdmin(c.prisma, [PERMISOS.SALA_EDITAR]);
    const sala = (await detalle(3)).espacios.find((e) => e.svgElementId === 'P3-T3-S31') as { id: number };
    await c.http().put(`/api/salas/${sala.id}`).set('Authorization', `Bearer ${token}`).send({ activo: false }).expect(200);
    expect((await detalle(3)).espacios.some((e) => e.id === sala.id)).toBe(false);
    expect((await c.http().get('/api/salas?q=PA-326').expect(200)).body.items).toEqual([]);
  });
});
