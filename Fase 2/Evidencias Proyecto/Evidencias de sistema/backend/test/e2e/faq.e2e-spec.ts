import { PERMISOS } from '../../src/common/auth/permisos';
import { Contexto, crearAdmin, crearApp } from '../soporte/app';
import { sembrar, vaciar } from '../soporte/fixtures';

/** Las preguntas frecuentes se leen sin sesión (tótem), pero solo un administrador las ve en borrador o las modifica. */
describe('Preguntas frecuentes: permisos', () => {
  let c: Contexto;
  let categoriaId: number;

  beforeAll(async () => {
    c = await crearApp();
  });
  beforeEach(async () => {
    await vaciar(c.prisma);
    await sembrar(c.prisma);
    categoriaId = (await c.prisma.categoria_faq.create({ data: { nombre: 'General' } })).id;
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  const auth = (token: string) => ({ Authorization: `Bearer ${token}` });
  const nueva = () => ({ pregunta: '¿Dónde está la biblioteca?', respuesta: 'En el piso 2.', categoria_id: categoriaId, publicada: true });

  async function faqExistente(autorId: number) {
    return c.prisma.pregunta_frecuente.create({ data: { ...nueva(), creado_por_id: autorId } });
  }

  // Ambos prefijos: /api/faq (oficial) y /faqs (el que usa la app de escritorio).
  describe.each(['/api/faq', '/faqs'])('%s', (base) => {
    it('sin sesión: el tótem sigue leyendo, pero no puede ver borradores ni escribir', async () => {
      const autor = await crearAdmin(c.prisma, []);
      const f = await faqExistente(autor.usuarioId);
      await c.http().get(base).expect(200);
      await c.http().get(`${base}/categorias`).expect(200);
      await c.http().get(`${base}/${f.id}`).expect(200);

      const rechazos = [
        c.http().get(`${base}/admin`),
        c.http().post(base).send(nueva()),
        c.http().put(`${base}/${f.id}`).send({ respuesta: 'Hackeada' }),
        c.http().patch(`${base}/${f.id}`).send({ respuesta: 'Hackeada' }),
        c.http().delete(`${base}/${f.id}`),
      ];
      for (const r of await Promise.all(rechazos)) {
        expect(r.status).toBe(401);
        expect(r.body.codigo).toBe('NO_AUTENTICADO');
      }
      // Nada cambió en la base.
      expect(await c.prisma.pregunta_frecuente.findUnique({ where: { id: f.id } })).toMatchObject({ respuesta: 'En el piso 2.' });
      expect(await c.prisma.pregunta_frecuente.count()).toBe(1);
    });

    it('con sesión pero sin el permiso necesario responde 403', async () => {
      const soloSalas = await crearAdmin(c.prisma, [PERMISOS.SALA_EDITAR]);
      const f = await faqExistente(soloSalas.usuarioId);
      expect((await c.http().post(base).set(auth(soloSalas.token)).send(nueva()).expect(403)).body.codigo).toBe('SIN_PERMISO');
      await c.http().put(`${base}/${f.id}`).set(auth(soloSalas.token)).send({ respuesta: 'x' }).expect(403);
      await c.http().delete(`${base}/${f.id}`).set(auth(soloSalas.token)).expect(403);
      await c.http().get(`${base}/admin`).set(auth(soloSalas.token)).expect(403);
    });

    it('un administrador con permisos crea (como autor), edita, ve borradores y elimina', async () => {
      const admin = await crearAdmin(c.prisma, [PERMISOS.FAQ_CREAR, PERMISOS.FAQ_EDITAR, PERMISOS.FAQ_ELIMINAR]);
      const creada = await c.http().post(base).set(auth(admin.token)).send({ ...nueva(), publicada: false }).expect(201);
      expect((await c.prisma.pregunta_frecuente.findUnique({ where: { id: creada.body.id } }))?.creado_por_id).toBe(admin.usuarioId);

      const borradores = await c.http().get(`${base}/admin`).set(auth(admin.token)).expect(200);
      expect(borradores.body.map((f: { id: number }) => f.id)).toContain(creada.body.id);

      await c.http().put(`${base}/${creada.body.id}`).set(auth(admin.token)).send({ respuesta: 'En el piso 3.' }).expect(200);
      expect((await c.prisma.pregunta_frecuente.findUnique({ where: { id: creada.body.id } }))?.respuesta).toBe('En el piso 3.');

      await c.http().delete(`${base}/${creada.body.id}`).set(auth(admin.token)).expect(200);
      expect(await c.prisma.pregunta_frecuente.count()).toBe(0);
    });
  });
});
