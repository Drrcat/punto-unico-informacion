import { writeFileSync, mkdirSync } from 'fs';
import * as path from 'path';
import { crearApp, Contexto } from '../soporte/app';
import { Base, sembrar, vaciar } from '../soporte/fixtures';

describe('API pública: pisos, salas, áreas y trámites', () => {
  let c: Contexto;
  let b: Base;

  beforeAll(async () => {
    c = await crearApp();
    await vaciar(c.prisma);
    b = await sembrar(c.prisma);
    mkdirSync(c.planosDir, { recursive: true });
    writeFileSync(path.join(c.planosDir, 'piso-1.svg'), '<svg xmlns="http://www.w3.org/2000/svg"><g id="P1-S01"/></svg>');
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  describe('pisos', () => {
    it('lista los pisos con su edificio y la dirección del plano', async () => {
      const r = await c.http().get('/api/pisos').expect(200);
      expect(r.body).toEqual([
        { id: b.piso1, numero: 1, nombre: 'Piso 1', edificio: { id: b.edificioId, nombre: 'Edificio A' }, sede: { id: b.sedeId, nombre: 'Sede de prueba' }, planoUrl: `/api/pisos/${b.piso1}/plano` },
        { id: b.piso2, numero: 2, nombre: 'Piso 2', edificio: { id: b.edificioId, nombre: 'Edificio A' }, sede: { id: b.sedeId, nombre: 'Sede de prueba' }, planoUrl: null },
      ]);
    });

    it('el detalle trae solo los espacios activos, con el id del elemento del plano', async () => {
      const r = await c.http().get(`/api/pisos/${b.piso2}`).expect(200);
      expect(r.body.espacios.map((e: { codigo: string }) => e.codigo)).toEqual(['B1', 'BOD', 'LC-07']);
      expect(r.body.espacios.find((e: { codigo: string }) => e.codigo === 'LC-07')).toMatchObject({ svgElementId: 'P2-LC07', tipo: 'Sala' });
    });

    it('entrega el plano como SVG', async () => {
      const r = await c.http().get(`/api/pisos/${b.piso1}/plano`).expect(200);
      expect(r.headers['content-type']).toMatch(/image\/svg\+xml/);
      expect(r.headers['content-security-policy']).toContain("default-src 'none'");
      expect(Buffer.isBuffer(r.body) ? r.body.toString('utf8') : r.text).toContain('<g id="P1-S01"/>');
    });

    it('responde 404 con código claro si el piso no existe o no tiene plano', async () => {
      expect((await c.http().get('/api/pisos/9999').expect(404)).body.codigo).toBe('PISO_NO_ENCONTRADO');
      expect((await c.http().get(`/api/pisos/${b.piso2}/plano`).expect(404)).body.codigo).toBe('PLANO_NO_DISPONIBLE');
    });

    it('no entrega archivos fuera de la carpeta de planos', async () => {
      await c.prisma.piso.update({ where: { id: b.piso2 }, data: { plano_svg_ruta: '../../../etc/passwd' } });
      expect((await c.http().get(`/api/pisos/${b.piso2}/plano`).expect(404)).body.codigo).toBe('PLANO_NO_DISPONIBLE');
      await c.prisma.piso.update({ where: { id: b.piso2 }, data: { plano_svg_ruta: '../planos-otro/x.txt' } });
      expect((await c.http().get(`/api/pisos/${b.piso2}/plano`).expect(404)).body.codigo).toBe('PLANO_NO_DISPONIBLE');
      await c.prisma.piso.update({ where: { id: b.piso2 }, data: { plano_svg_ruta: null } });
    });

    it('un id que no es número es un error de solicitud', async () => {
      expect((await c.http().get('/api/pisos/abc').expect(400)).body.codigo).toBe('SOLICITUD_INVALIDA');
    });
  });

  describe('salas', () => {
    const codigos = (r: { body: { items: { codigo: string }[] } }) => r.body.items.map((s) => s.codigo);

    it('lista solo espacios activos y de tipos buscables, ordenados por piso y código', async () => {
      const r = await c.http().get('/api/salas').expect(200);
      expect(r.body.total).toBe(4);
      expect(codigos(r)).toEqual(['S01', 'S02', 'B1', 'LC-07']);
    });

    it('cada resultado indica piso, edificio y el elemento del plano', async () => {
      const r = await c.http().get('/api/salas?q=sala 01').expect(200);
      expect(r.body.items[0]).toMatchObject({
        codigo: 'S01',
        nombre: 'Sala 01',
        tipo: { nombre: 'Sala' },
        svgElementId: 'P1-S01',
        piso: { numero: 1, nombre: 'Piso 1', planoUrl: `/api/pisos/${b.piso1}/plano` },
        edificio: { nombre: 'Edificio A' },
      });
    });

    it.each([
      ['sala 1', ['S01']],
      ['s2', ['S02']],
      ['lc07', ['LC-07']],
      ['LC 7', ['LC-07']],
      ['laboratorio de computacion', ['LC-07']],
      ['panol', ['LC-07']],
      ['bano', ['B1']],
      ['financiamiento', ['S02']],
    ])('busca "%s"', async (q, esperado) => {
      expect(codigos(await c.http().get('/api/salas').query({ q }).expect(200))).toEqual(esperado);
    });

    it('no muestra salas inactivas ni tipos no buscables en las búsquedas', async () => {
      expect(codigos(await c.http().get('/api/salas?q=clausurada').expect(200))).toEqual([]);
      expect(codigos(await c.http().get('/api/salas?q=bodega').expect(200))).toEqual([]);
    });

    it('filtra por piso y pagina', async () => {
      expect(codigos(await c.http().get(`/api/salas?pisoId=${b.piso1}`).expect(200))).toEqual(['S01', 'S02']);
      const p = await c.http().get('/api/salas?limite=2&desplazamiento=1').expect(200);
      expect(p.body.total).toBe(4);
      expect(codigos(p)).toEqual(['S02', 'B1']);
    });

    it('el detalle trae equipamiento y las áreas que funcionan allí', async () => {
      const s01 = (await c.http().get(`/api/salas/${b.s01}`).expect(200)).body;
      expect(s01.equipamiento).toEqual([
        { id: expect.any(Number), nombre: 'Computadores', cantidad: 20, observacion: 'Con licencias' },
        { id: expect.any(Number), nombre: 'Proyector', cantidad: 1, observacion: null },
      ]);
      const s02 = (await c.http().get(`/api/salas/${b.s02}`).expect(200)).body;
      expect(s02.areas[0]).toMatchObject({ nombre: 'Financiamiento Estudiantil', horarioAtencion: 'Lunes a viernes, 9:00 a 17:00', contacto: { correo: 'financiamiento@ejemplo.cl', anexo: '1234' } });
    });

    it('una sala inactiva no se puede ver sin ser administrador', async () => {
      const inactiva = await c.prisma.espacio.findFirstOrThrow({ where: { codigo: 'S99' } });
      expect((await c.http().get(`/api/salas/${inactiva.id}`).expect(404)).body.codigo).toBe('SALA_NO_ENCONTRADA');
    });

    it('lista el catálogo de tipos', async () => {
      const r = await c.http().get('/api/salas/tipos').expect(200);
      expect(r.body.map((t: { nombre: string }) => t.nombre)).toEqual(['Baño', 'Bodega', 'Sala']);
      expect(r.body.find((t: { nombre: string }) => t.nombre === 'Bodega').esBuscable).toBe(false);
    });

    it('valida los parámetros de la consulta', async () => {
      expect((await c.http().get('/api/salas?limite=0').expect(400)).body.codigo).toBe('VALIDACION');
      expect((await c.http().get('/api/salas?limite=500').expect(400)).body.codigo).toBe('VALIDACION');
      expect((await c.http().get('/api/salas?pisoId=abc').expect(400)).body.codigo).toBe('VALIDACION');
      expect((await c.http().get('/api/salas?desconocido=1').expect(400)).body.codigo).toBe('VALIDACION');
    });

    it('registra las búsquedas del tótem, con y sin resultado', async () => {
      await c.prisma.registro_consulta.deleteMany();
      await c.http().get('/api/salas?q=sala 01').expect(200);
      await c.http().get('/api/salas?q=no existe nada así').expect(200);
      await c.http().get('/api/salas').expect(200); // sin texto no es una búsqueda
      const reg = await c.prisma.registro_consulta.findMany({ orderBy: { id: 'asc' } });
      expect(reg).toHaveLength(2);
      expect(reg[0]).toMatchObject({ tipo: 'SALA', termino: 'sala 01', hubo_resultado: true, espacio_id: b.s01, totem_id: 1 });
      expect(reg[1]).toMatchObject({ tipo: 'SALA', termino: 'no existe nada así', hubo_resultado: false, espacio_id: null });
    });

    it('una consulta muy larga o con símbolos no rompe nada', async () => {
      await c.http().get('/api/salas').query({ q: "'; DROP TABLE espacio; --" }).expect(200);
      await c.http().get('/api/salas').query({ q: 'a'.repeat(101) }).expect(400);
      expect(await c.prisma.espacio.count()).toBe(6);
    });
  });

  describe('áreas', () => {
    it('lista las áreas con ubicación, horario y canal de contacto', async () => {
      const r = await c.http().get('/api/areas').expect(200);
      expect(r.body).toEqual([
        {
          id: b.areaFin,
          nombre: 'Financiamiento Estudiantil',
          descripcion: 'Becas, créditos y beneficios.',
          horarioAtencion: 'Lunes a viernes, 9:00 a 17:00',
          contacto: { correo: 'financiamiento@ejemplo.cl', anexo: '1234' },
          ubicacion: {
            sala: { id: b.s02, codigo: 'S02', nombre: 'Sala 02', svgElementId: 'P1-S02' },
            piso: { id: b.piso1, numero: 1, nombre: 'Piso 1', planoUrl: `/api/pisos/${b.piso1}/plano` },
            edificio: { id: b.edificioId, nombre: 'Edificio A' },
          },
        },
      ]);
    });

    it('busca por nombre, trámite o carrera que atiende', async () => {
      for (const q of ['financiamiento', 'beca de alimentacion', 'ingenieria en informatica']) {
        expect((await c.http().get('/api/areas').query({ q }).expect(200)).body).toHaveLength(1);
      }
      expect((await c.http().get('/api/areas?q=zzz').expect(200)).body).toEqual([]);
    });

    it('el detalle indica qué trámites y carreras atiende', async () => {
      const r = (await c.http().get(`/api/areas/${b.areaFin}`).expect(200)).body;
      expect(r.atiende.tramites).toEqual([{ id: b.tramiteBeca, nombre: 'Postulación a beca de alimentación' }]); // el trámite inactivo no aparece
      expect(r.atiende.carreras).toEqual([{ id: expect.any(Number), codigo: 'INF', nombre: 'Ingeniería en Informática' }]);
      expect((await c.http().get('/api/areas/9999').expect(404)).body.codigo).toBe('AREA_NO_ENCONTRADA');
    });

    it('registra las búsquedas como consultas de directorio', async () => {
      await c.prisma.registro_consulta.deleteMany();
      await c.http().get('/api/areas?q=financiamiento').expect(200);
      expect(await c.prisma.registro_consulta.findFirst()).toMatchObject({ tipo: 'DIRECTORIO', termino: 'financiamiento', hubo_resultado: true });
    });
  });

  describe('trámites', () => {
    it('lista solo los activos con el área que los resuelve', async () => {
      const r = await c.http().get('/api/tramites').expect(200);
      expect(r.body).toEqual([{ id: b.tramiteBeca, nombre: 'Postulación a beca de alimentación', descripcion: 'Beneficio para cubrir el almuerzo.', plazoDias: 10, area: { id: b.areaFin, nombre: 'Financiamiento Estudiantil' } }]);
    });

    it('busca y filtra por área', async () => {
      expect((await c.http().get('/api/tramites?q=beca').expect(200)).body).toHaveLength(1);
      expect((await c.http().get('/api/tramites?q=financiamiento').expect(200)).body).toHaveLength(1);
      expect((await c.http().get('/api/tramites?q=pasaporte').expect(200)).body).toEqual([]);
      expect((await c.http().get(`/api/tramites?areaId=${b.areaFin}`).expect(200)).body).toHaveLength(1);
      expect((await c.http().get('/api/tramites?areaId=999').expect(200)).body).toEqual([]);
    });

    it('el detalle trae pasos en orden, requisitos y el área con su ubicación', async () => {
      const r = (await c.http().get(`/api/tramites/${b.tramiteBeca}`).expect(200)).body;
      expect(r.pasos.map((p: { orden: number; titulo: string }) => [p.orden, p.titulo])).toEqual([[1, 'Completar el formulario'], [2, 'Entregar documentos']]);
      expect(r.requisitos).toEqual([
        { id: expect.any(Number), nombre: 'Cédula de identidad', obligatorio: true },
        { id: expect.any(Number), nombre: 'Certificado de notas', obligatorio: false },
      ]);
      expect(r.plazoDias).toBe(10);
      expect(r.area).toMatchObject({ nombre: 'Financiamiento Estudiantil', contacto: { anexo: '1234' }, ubicacion: { sala: { codigo: 'S02' }, piso: { numero: 1 } } });
    });

    it('un trámite inactivo no existe para el tótem', async () => {
      const t = await c.prisma.tramite.findFirstOrThrow({ where: { activo: false } });
      expect((await c.http().get(`/api/tramites/${t.id}`).expect(404)).body.codigo).toBe('TRAMITE_NO_ENCONTRADO');
    });

    it('registra las búsquedas', async () => {
      await c.prisma.registro_consulta.deleteMany();
      await c.http().get('/api/tramites?q=pasaporte').expect(200);
      expect(await c.prisma.registro_consulta.findFirst()).toMatchObject({ tipo: 'TRAMITE', termino: 'pasaporte', hubo_resultado: false });
    });
  });

  it('los errores y los encabezados de seguridad tienen el formato esperado', async () => {
    const r = await c.http().get('/api/no-existe').expect(404);
    expect(r.body).toMatchObject({ statusCode: 404, codigo: 'NO_ENCONTRADO' });
    expect(r.headers['x-content-type-options']).toBe('nosniff');
    expect(r.headers['x-powered-by']).toBeUndefined();
  });
});
