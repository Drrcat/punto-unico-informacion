import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from './../src/app.module';
import { PrismaService } from './../src/prisma/prisma.service';
import { configurarApp } from './../src/configurar-app';

// Pruebas end-to-end: levantan la API completa y le hacen peticiones HTTP reales.
// La base de datos se reemplaza por una "base en memoria" (un arreglo), así las
// pruebas no necesitan PostgreSQL ni modifican datos reales.
type FaqFalsa = {
  id: number;
  pregunta: string;
  respuesta: string;
  creadaEn: Date;
};

function crearPrismaEnMemoria() {
  let faqs: FaqFalsa[] = [];
  let siguienteId = 1;

  return {
    // Deja la "base" con datos iniciales antes de cada prueba
    reiniciar(iniciales: { pregunta: string; respuesta: string }[]) {
      siguienteId = 1;
      faqs = iniciales.map((f) => ({
        ...f,
        id: siguienteId++,
        creadaEn: new Date(),
      }));
    },
    $connect: async () => {},
    $disconnect: async () => {},
    faq: {
      findMany: async () => [...faqs].sort((a, b) => a.id - b.id),
      findUnique: async ({ where }: { where: { id: number } }) =>
        faqs.find((f) => f.id === where.id) ?? null,
      create: async ({ data }: { data: Omit<FaqFalsa, 'id' | 'creadaEn'> }) => {
        const nueva = { ...data, id: siguienteId++, creadaEn: new Date() };
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
        Object.assign(faq, data);
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

  beforeAll(async () => {
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
      { pregunta: '¿Primera?', respuesta: 'Uno' },
      { pregunta: '¿Segunda?', respuesta: 'Dos' },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / responde estado ok', () => {
    return request(app.getHttpServer())
      .get('/')
      .expect(200)
      .expect({ estado: 'ok', servicio: 'OrientaSede API' });
  });

  describe('Lectura', () => {
    it('GET /faqs devuelve la lista', async () => {
      const res = await request(app.getHttpServer()).get('/faqs').expect(200);
      expect(res.body).toHaveLength(2);
      expect(res.body[0]).toMatchObject({ id: 1, pregunta: '¿Primera?' });
    });

    it('GET /faqs/:id devuelve una FAQ', async () => {
      const res = await request(app.getHttpServer()).get('/faqs/2').expect(200);
      expect(res.body).toMatchObject({ id: 2, respuesta: 'Dos' });
    });

    it('GET /faqs/:id responde 404 si no existe', () => {
      return request(app.getHttpServer()).get('/faqs/999').expect(404);
    });

    it('GET /faqs/:id responde 400 si el id no es número', () => {
      return request(app.getHttpServer()).get('/faqs/abc').expect(400);
    });
  });

  describe('Creación', () => {
    it('POST /faqs crea una FAQ y responde 201', async () => {
      const res = await request(app.getHttpServer())
        .post('/faqs')
        .send({ pregunta: '¿Nueva?', respuesta: 'Sí' })
        .expect(201);
      expect(res.body).toMatchObject({ id: 3, pregunta: '¿Nueva?' });

      const lista = await request(app.getHttpServer()).get('/faqs');
      expect(lista.body).toHaveLength(3);
    });

    it('POST /faqs responde 400 si falta un campo', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ pregunta: '¿Sin respuesta?' })
        .expect(400);
    });

    it('POST /faqs responde 400 si un campo viene vacío', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ pregunta: '', respuesta: 'Algo' })
        .expect(400);
    });

    it('POST /faqs responde 400 si mandan campos que no existen', () => {
      return request(app.getHttpServer())
        .post('/faqs')
        .send({ pregunta: 'P', respuesta: 'R', admin: true })
        .expect(400);
    });
  });

  describe('Edición', () => {
    it('PATCH /faqs/:id edita solo los campos enviados', async () => {
      const res = await request(app.getHttpServer())
        .patch('/faqs/1')
        .send({ respuesta: 'Editada' })
        .expect(200);
      expect(res.body).toMatchObject({
        id: 1,
        pregunta: '¿Primera?',
        respuesta: 'Editada',
      });
    });

    it('PATCH /faqs/:id responde 404 si no existe', () => {
      return request(app.getHttpServer())
        .patch('/faqs/999')
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
