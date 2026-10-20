import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configurarApp } from './../src/configurar-app';

// Pruebas end-to-end: levantan la API completa y le hacen peticiones HTTP reales.
// La base de datos se reemplaza por una "base en memoria" (un arreglo), así las
// pruebas no necesitan Supabase ni modifican datos reales.
type FaqFalsa = {
  id: number;
  pregunta: string;
  respuesta: string;
  publicada: boolean;
  categoria_id: number;
  area_id: number | null;
  creado_por_id: number;
};

type Filtro = { id?: number; publicada?: boolean };

// Revisa si una FAQ cumple el "where" que manda el servicio
function cumple(faq: FaqFalsa, where: Filtro = {}) {
  return Object.entries(where).every(
    ([campo, valor]) => faq[campo as keyof FaqFalsa] === valor,
  );
}

// Prisma ignora los campos que vienen como undefined; la base falsa también
function sinIndefinidos(data: Partial<FaqFalsa>) {
  return Object.fromEntries(
    Object.entries(data).filter(([, valor]) => valor !== undefined),
  ) as Partial<FaqFalsa>;
}

function crearPrismaEnMemoria() {
  let faqs: FaqFalsa[] = [];
  let siguienteId = 1;
  const categorias = [{ id: 1, nombre: 'General', orden: 0 }];

  return {
    // Deja la "base" con datos iniciales antes de cada prueba
    reiniciar(iniciales: Partial<FaqFalsa>[]) {
      siguienteId = 1;
      faqs = iniciales.map((f) => ({
        pregunta: '',
        respuesta: '',
        publicada: false,
        categoria_id: 1,
        area_id: null,
        creado_por_id: 1,
        ...f,
        id: siguienteId++,
      }));
    },
    $connect: async () => {},
    $disconnect: async () => {},
    categoria_faq: {
      findMany: async () =>
        categorias.map(({ id, nombre }) => ({ id, nombre })),
    },
    pregunta_frecuente: {
      findMany: async ({ where }: { where?: Filtro }) =>
        faqs.filter((f) => cumple(f, where)).sort((a, b) => a.id - b.id),
      findFirst: async ({ where }: { where?: Filtro }) =>
        faqs.find((f) => cumple(f, where)) ?? null,
      findUnique: async ({ where }: { where: { id: number } }) =>
        faqs.find((f) => f.id === where.id) ?? null,
      // Igual que la base real: publicada y area_id tienen valor por defecto
      create: async ({ data }: { data: Partial<FaqFalsa> }) => {
        const nueva = {
          publicada: false,
          area_id: null,
          ...sinIndefinidos(data),
          id: siguienteId++,
        } as FaqFalsa;
        faqs.push(nueva);
        return nueva;
      },
      update: async ({
        where,
        data,
      }: {
        where: { id: number };
        data: Partial<FaqFalsa>;
      }) => {
        const faq = faqs.find((f) => f.id === where.id)!;
        Object.assign(faq, sinIndefinidos(data));
        return faq;
      },
      delete: async ({ where }: { where: { id: number } }) => {
        const faq = faqs.find((f) => f.id === where.id)!;
        faqs = faqs.filter((f) => f.id !== where.id);
        return faq;
      },
    },
  };
}

describe('API OrientaSede (e2e)', () => {
  let app: INestApplication<App>;
  const prisma = crearPrismaEnMemoria();

  // Body mínimo válido para crear una FAQ
  const faqValida = {
    pregunta: '¿Nueva?',
    respuesta: 'Sí',
    categoria_id: 1,
  };
  const creadorIdAnterior = process.env.FAQ_CREATED_BY_ID;

  beforeAll(async () => {
    process.env.FAQ_CREATED_BY_ID = '1';
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prisma)
      .compile();

    app = moduleFixture.createNestApplication();
    configurarApp(app); // misma configuración que main.ts (CORS + validación)
    await app.init();
  });

  beforeEach(() => {
    prisma.reiniciar([
      { pregunta: '¿Primera?', respuesta: 'Uno', publicada: true },
      { pregunta: '¿Segunda?', respuesta: 'Dos', publicada: true },
      { pregunta: '¿Borrador?', respuesta: 'Tres', publicada: false },
    ]);
  });

  afterAll(async () => {
    await app.close();
    if (creadorIdAnterior === undefined) {
      delete process.env.FAQ_CREATED_BY_ID;
    } else {
      process.env.FAQ_CREATED_BY_ID = creadorIdAnterior;
    }
  });

  it('GET / responde estado ok', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ estado: 'ok', servicio: 'OrientaSede API' });
  });

  describe('Lectura (tótem)', () => {
    it('GET /faqs devuelve solo las publicadas', async () => {
      const res = await request(app.getHttpServer()).get('/faqs').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ id: 1, pregunta: '¿Primera?' });
    });

    describe('Lectura (administración)', () => {
      it('GET /faqs/admin devuelve preguntas publicadas y borradores', async () => {
        const res = await request(app.getHttpServer())
          .get('/faqs/admin')
          .expect(200);
        expect(res.body).toHaveLength(3);
        expect(res.body[2]).toMatchObject({
          id: 3,
          pregunta: '¿Borrador?',
          publicada: false,
        });
      });

      it('GET /faqs/categorias devuelve categorías para el formulario', async () => {
        const res = await request(app.getHttpServer())
          .get('/faqs/categorias')
          .expect(200);
        expect(res.body).toEqual([{ id: 1, nombre: 'General' }]);
      });
    });

    it('GET /faqs/:id devuelve una FAQ publicada', async () => {
      const res = await request(app.getHttpServer()).get('/faqs/2').expect(200);
      expect(res.body).toMatchObject({ id: 2, respuesta: 'Dos' });
    });

    it('GET /faqs/:id responde 404 si la FAQ no está publicada', () => {
      return request(app.getHttpServer()).get('/faqs/3').expect(404);
    });

    it('GET /faqs/:id responde 404 si no existe', () => {
      return request(app.getHttpServer()).get('/faqs/999').expect(404);
    });

    it('GET /faqs/:id responde 400 si el id no es número', () => {
      return request(app.getHttpServer()).get('/faqs/abc').expect(400);
    });
  });

  describe('Creación', () => {
    it('POST /faqs crea una FAQ no publicada por defecto', async () => {
      const res = await request(app.getHttpServer())
        .post('/faqs')
        .send(faqValida)
        .expect(201);
      expect(res.body).toMatchObject({
        id: 4,
        pregunta: '¿Nueva?',
        publicada: false,
      });

      // Como no está publicada, el tótem todavía no la ve
      const lista = await request(app.getHttpServer()).get('/faqs');
      expect(lista.body).toHaveLength(2);
    });

    it('POST /faqs con publicada: true aparece en el tótem', async () => {
      await request(app.getHttpServer())
        .post('/faqs')
        .send({ ...faqValida, publicada: true })
        .expect(201);

      const lista = await request(app.getHttpServer()).get('/faqs');
      expect(lista.body).toHaveLength(3);
    });

    it('POST /faqs responde 400 si falta un campo obligatorio', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({
          pregunta: faqValida.pregunta,
          categoria_id: faqValida.categoria_id,
        })
        .expect(400);
    });

    it('POST /faqs explica en español qué campos faltan', async () => {
      const res = await request(app.getHttpServer())
        .post('/faqs')
        .send({ pregunta: '¿Solo pregunta?' })
        .expect(400);
      expect(res.body.message).toEqual([
        'La respuesta no puede estar vacía',
        'categoria_id es obligatorio y debe ser un número entero',
      ]);
    });

    it('POST /faqs responde 400 si falta la categoría', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({
          pregunta: faqValida.pregunta,
          respuesta: faqValida.respuesta,
        })
        .expect(400);
    });

    it('POST /faqs responde 400 si un campo viene vacío', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ ...faqValida, pregunta: '' })
        .expect(400);
    });

    it('POST /faqs responde 400 si un campo tiene el tipo incorrecto', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ ...faqValida, publicada: 'si' })
        .expect(400);
    });

    it('POST /faqs responde 400 si mandan campos que no existen', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ ...faqValida, admin: true })
        .expect(400);
    });
  });

  describe('Edición', () => {
    it('PATCH /faqs/:id edita preguntas desde el escritorio', async () => {
      const res = await request(app.getHttpServer())
        .patch('/faqs/1')
        .send({ pregunta: 'Editada desde escritorio' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        pregunta: 'Editada desde escritorio',
      });
    });

    it('PUT /faqs/:id edita solo los campos enviados', async () => {
      const res = await request(app.getHttpServer())
        .put('/faqs/1')
        .send({ respuesta: 'Editada' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        pregunta: '¿Primera?',
        respuesta: 'Editada',
      });
    });

    it('PUT /faqs/:id puede publicar un borrador', async () => {
      await request(app.getHttpServer())
        .put('/faqs/3')
        .send({ publicada: true })
        .expect(200);
      await request(app.getHttpServer()).get('/faqs/3').expect(200);
    });

    it('PUT /faqs/:id no permite cambiar el autor', () => {
      return request(app.getHttpServer())
        .put('/faqs/1')
        .send({ creado_por_id: 2 })
        .expect(400);
    });

    it('PUT /faqs/:id responde 404 si no existe', () => {
      return request(app.getHttpServer())
        .put('/faqs/999')
        .send({ respuesta: 'x' })
        .expect(404);
    });
  });

  describe('Borrado', () => {
    it('DELETE /faqs/:id borra la FAQ', async () => {
      await request(app.getHttpServer()).delete('/faqs/1').expect(200);
      await request(app.getHttpServer()).get('/faqs/1').expect(404);

      const lista = await request(app.getHttpServer()).get('/faqs');
      expect(lista.body).toHaveLength(1);
    });

    it('DELETE /faqs/:id responde 404 si no existe', () => {
      return request(app.getHttpServer()).delete('/faqs/999').expect(404);
    });
  });
});
