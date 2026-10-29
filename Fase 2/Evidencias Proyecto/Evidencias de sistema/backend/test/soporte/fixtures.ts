import { PrismaService } from '../../src/common/prisma/prisma.service';

/** Vacía todas las tablas (la base de pruebas es solo para pruebas). */
export async function vaciar(prisma: PrismaService): Promise<void> {
  const tablas = await prisma.$queryRaw<{ tablename: string }[]>`SELECT tablename::text AS tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT LIKE '\_prisma%'`;
  const lista = tablas.map((t) => `"${t.tablename}"`).join(', ');
  await prisma.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
}

export interface Base {
  sedeId: number;
  edificioId: number;
  piso1: number;
  piso2: number;
  tipoSala: number;
  tipoBano: number;
  tipoBodega: number;
  s01: number;
  s02: number;
  lab: number;
  bano: number;
  areaFin: number;
  tramiteBeca: number;
}

/** Datos mínimos y conocidos para las pruebas. Nombres genéricos, sin relación con ninguna institución real. */
export async function sembrar(prisma: PrismaService, config: Record<string, string> = {}): Promise<Base> {
  const sede = await prisma.sede.create({ data: { nombre: 'Sede de prueba' } });
  const edificio = await prisma.edificio.create({ data: { sede_id: sede.id, nombre: 'Edificio A' } });
  const p1 = await prisma.piso.create({ data: { edificio_id: edificio.id, numero: 1, nombre: 'Piso 1', plano_svg_ruta: 'piso-1.svg' } });
  const p2 = await prisma.piso.create({ data: { edificio_id: edificio.id, numero: 2, nombre: 'Piso 2' } });
  const sala = await prisma.tipo_espacio.create({ data: { nombre: 'Sala', es_buscable: true } });
  const bano = await prisma.tipo_espacio.create({ data: { nombre: 'Baño', es_buscable: true } });
  const bodega = await prisma.tipo_espacio.create({ data: { nombre: 'Bodega', es_buscable: false } });

  const s01 = await prisma.espacio.create({ data: { piso_id: p1.id, tipo_espacio_id: sala.id, codigo: 'S01', nombre: 'Sala 01', svg_element_id: 'P1-S01', capacidad: 40, equipamiento_rel: { create: [{ nombre: 'Proyector', cantidad: 1 }, { nombre: 'Computadores', cantidad: 20, observacion: 'Con licencias' }] } } });
  const s02 = await prisma.espacio.create({ data: { piso_id: p1.id, tipo_espacio_id: sala.id, codigo: 'S02', nombre: 'Sala 02', svg_element_id: 'P1-S02' } });
  const lab = await prisma.espacio.create({ data: { piso_id: p2.id, tipo_espacio_id: sala.id, codigo: 'LC-07', nombre: 'Laboratorio de Computación', svg_element_id: 'P2-LC07', alias_rel: { create: [{ alias: 'Pañol de computación' }] } } });
  const b = await prisma.espacio.create({ data: { piso_id: p2.id, tipo_espacio_id: bano.id, codigo: 'B1', nombre: 'Baño 1', svg_element_id: 'P2-B1' } });
  await prisma.espacio.create({ data: { piso_id: p2.id, tipo_espacio_id: bodega.id, codigo: 'BOD', nombre: 'Bodega de aseo', svg_element_id: 'P2-BOD' } });
  await prisma.espacio.create({ data: { piso_id: p2.id, tipo_espacio_id: sala.id, codigo: 'S99', nombre: 'Sala clausurada', activo: false } });

  const fin = await prisma.area_institucional.create({
    data: { nombre: 'Financiamiento Estudiantil', descripcion: 'Becas, créditos y beneficios.', espacio_id: s02.id, horario_atencion: 'Lunes a viernes, 9:00 a 17:00', correo_contacto: 'financiamiento@ejemplo.cl', anexo: '1234' },
  });
  const escuela = await prisma.escuela.create({ data: { nombre: 'Escuela de Informática' } });
  await prisma.carrera.create({ data: { escuela_id: escuela.id, area_id: fin.id, codigo: 'INF', nombre: 'Ingeniería en Informática' } });
  const beca = await prisma.tramite.create({
    data: {
      area_id: fin.id,
      nombre: 'Postulación a beca de alimentación',
      descripcion: 'Beneficio para cubrir el almuerzo.',
      plazo_dias: 10,
      paso_rel: { create: [{ orden: 2, titulo: 'Entregar documentos', descripcion: 'Lleva los documentos a la oficina.' }, { orden: 1, titulo: 'Completar el formulario', descripcion: 'Disponible en línea.' }] },
      requisito_rel: { create: [{ nombre: 'Cédula de identidad', obligatorio: true }, { nombre: 'Certificado de notas', obligatorio: false }] },
    },
  });
  await prisma.tramite.create({ data: { area_id: fin.id, nombre: 'Trámite dado de baja', activo: false } });

  await prisma.totem.create({ data: { id: 1, nombre: 'Tótem de prueba', sede_id: sede.id } });
  const base: Record<string, string> = {
    institucion_nombre: 'Institución de Prueba',
    dominios_correo: 'ejemplo.cl, estudiantes.ejemplo.cl',
    modulo_enrolamiento_activo: 'true',
    conector_enrolamiento: 'simulado',
    ...config,
  };
  await prisma.configuracion_sistema.createMany({ data: Object.entries(base).map(([clave, valor]) => ({ clave, valor })) });

  return { sedeId: sede.id, edificioId: edificio.id, piso1: p1.id, piso2: p2.id, tipoSala: sala.id, tipoBano: bano.id, tipoBodega: bodega.id, s01: s01.id, s02: s02.id, lab: lab.id, bano: b.id, areaFin: fin.id, tramiteBeca: beca.id };
}
