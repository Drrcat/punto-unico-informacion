import * as bcrypt from 'bcryptjs';
import { readFileSync } from 'fs';
import * as path from 'path';
import { DESCRIPCION_PERMISOS } from '../../src/common/auth/permisos';
import { ContenidoInstitucion, ejecutarSeed, OpcionesSeed, Zona } from '../../src/seed/seed';
import { crearApp, Contexto } from '../soporte/app';
import { vaciar } from '../soporte/fixtures';

const RAIZ = path.resolve(__dirname, '../../../database/prisma/seed');
const zonas = JSON.parse(readFileSync(path.join(RAIZ, 'zonas.json'), 'utf8')) as Zona[];
const contenido = JSON.parse(readFileSync(path.join(RAIZ, 'contenido.ejemplo.json'), 'utf8')) as ContenidoInstitucion;

const opciones = (cambios: Partial<OpcionesSeed> = {}): OpcionesSeed => ({
  zonas,
  sedeNombre: 'Sede de prueba',
  edificioNombre: 'Edificio principal',
  totemId: 1,
  totemNombre: 'Tótem 1',
  institucionNombre: 'Institución de Prueba',
  dominiosCorreo: 'ejemplo.cl',
  conectorEnrolamiento: 'ninguno',
  ...cambios,
});

describe('Carga inicial', () => {
  let c: Contexto;
  beforeAll(async () => {
    c = await crearApp();
  });
  beforeEach(() => vaciar(c.prisma));
  afterAll(() => c.cerrar());

  const gruposEsperados = new Set(zonas.map((z) => `${z.piso}|${z.clave}`)).size;

  it('crea sede, edificio, pisos, tipos y un espacio por cada sala del plano', async () => {
    const r = await ejecutarSeed(c.prisma, opciones());
    expect(r).toMatchObject({ pisos: 2, espacios: gruposEsperados, tipos: 5, adminCreado: false });
    expect(await c.prisma.piso.findMany({ orderBy: { numero: 'asc' }, select: { numero: true, nombre: true, plano_svg_ruta: true } })).toEqual([
      { numero: 2, nombre: 'Piso 2', plano_svg_ruta: 'piso-2.svg' },
      { numero: 3, nombre: 'Piso 3', plano_svg_ruta: 'piso-3.svg' },
    ]);
    expect(await c.prisma.espacio.count()).toBe(gruposEsperados);
    expect((await c.prisma.tipo_espacio.findMany({ orderBy: { nombre: 'asc' } })).map((t) => t.nombre)).toEqual(['Ascensor', 'Baño', 'Escalera', 'Sala', 'Terraza']);
  });

  it('cada espacio apunta al elemento del plano de su primera pieza, sin repetir ids', async () => {
    await ejecutarSeed(c.prisma, opciones());
    const espacios = await c.prisma.espacio.findMany({ include: { piso: true } });
    const ids = espacios.map((e) => `${e.piso.numero}|${e.svg_element_id}`);
    expect(new Set(ids).size).toBe(espacios.length);
    const zonaIds = new Set(zonas.map((z) => z.id));
    for (const e of espacios) expect(zonaIds.has(e.svg_element_id as string)).toBe(true);
    const pa323 = espacios.find((e) => e.nombre === 'PA-323');
    expect(pa323).toMatchObject({ svg_element_id: 'P3-T3-S34', codigo: 'S34' });
  });

  it('el código sale del id del plano sin el piso ni la torre', async () => {
    await ejecutarSeed(c.prisma, opciones());
    const codigos = async (piso: number) => (await c.prisma.espacio.findMany({ where: { piso: { numero: piso } }, select: { codigo: true } })).map((e) => e.codigo);
    expect(await codigos(2)).toEqual(expect.arrayContaining(['S01', 'S28', 'B1', 'E1', 'A1', 'TZ1']));
    expect(await codigos(3)).toEqual(expect.arrayContaining(['S01', 'S36', 'LIN', 'SERVICIOS-DIGITALES', 'PA-LATI']));
    expect((await codigos(2)).concat(await codigos(3)).some((x) => /^T\d-/.test(x))).toBe(false);
  });

  it('las piezas con la misma clave forman un solo espacio, con el id de la primera', async () => {
    const dos: Zona[] = [
      { piso: 3, id: 'P3-T1-S01', nombre: 'Sala doble', detalle: '', tipo: 'sala', torre: 1, clave: 'P3|Sala doble|1' },
      { piso: 3, id: 'P3-T1-S02', nombre: 'Sala doble', detalle: '', tipo: 'sala', torre: 1, clave: 'P3|Sala doble|1' },
      { piso: 3, id: 'P3-T1-S03', nombre: 'Sala simple', detalle: '', tipo: 'sala', torre: 1, clave: 'P3|Sala simple|1' },
    ];
    expect(await ejecutarSeed(c.prisma, opciones({ zonas: dos }))).toMatchObject({ espacios: 2 });
    const e = await c.prisma.espacio.findMany({ orderBy: { codigo: 'asc' } });
    expect(e.map((x) => [x.codigo, x.svg_element_id])).toEqual([['S01', 'P3-T1-S01'], ['S03', 'P3-T1-S03']]);
  });

  it('distingue por torre los nombres repetidos dentro de un piso', async () => {
    await ejecutarSeed(c.prisma, opciones());
    const banos = await c.prisma.espacio.findMany({ where: { codigo: { startsWith: 'BANO-HOMBRES' } }, orderBy: { codigo: 'asc' } });
    expect(banos.map((b) => b.nombre)).toEqual(['Baño hombres (torre 1)', 'Baño hombres (torre 2)']);
  });

  it('guarda el detalle de una sala como alias, para poder encontrarla', async () => {
    await ejecutarSeed(c.prisma, opciones());
    const r = await c.http().get('/api/salas?q=laboratorio de autotronica').expect(200);
    expect(r.body.items.map((s: { codigo: string }) => s.codigo)).toEqual(['PA-LATI']);
  });

  it('se puede ejecutar varias veces sin duplicar nada ni pisar cambios', async () => {
    await ejecutarSeed(c.prisma, opciones({ contenido, admin: { correo: 'admin@ejemplo.cl', clave: 'una-clave-larga' } }));
    await c.prisma.configuracion_sistema.update({ where: { clave: 'codigo_vigencia_min' }, data: { valor: '9' } });
    await c.prisma.espacio.updateMany({ where: { codigo: 'S01', piso: { numero: 2 } }, data: { nombre: 'Sala editada por el administrador' } });
    const antes = { espacios: await c.prisma.espacio.count(), config: await c.prisma.configuracion_sistema.count(), tramites: await c.prisma.tramite.count(), pasos: await c.prisma.tramite_paso.count(), usuarios: await c.prisma.usuario.count() };

    const r = await ejecutarSeed(c.prisma, opciones({ contenido, admin: { correo: 'admin@ejemplo.cl', clave: 'otra-clave-distinta' } }));
    expect(r).toMatchObject({ parametrosNuevos: 0, adminCreado: false });
    expect({ espacios: await c.prisma.espacio.count(), config: await c.prisma.configuracion_sistema.count(), tramites: await c.prisma.tramite.count(), pasos: await c.prisma.tramite_paso.count(), usuarios: await c.prisma.usuario.count() }).toEqual(antes);
    expect((await c.prisma.configuracion_sistema.findUniqueOrThrow({ where: { clave: 'codigo_vigencia_min' } })).valor).toBe('9');
    expect((await c.prisma.espacio.findFirstOrThrow({ where: { codigo: 'S01', piso: { numero: 2 } } })).nombre).toBe('Sala editada por el administrador');
    // La contraseña de un administrador existente no se cambia.
    const admin = await c.prisma.usuario.findUniqueOrThrow({ where: { correo: 'admin@ejemplo.cl' } });
    expect(await bcrypt.compare('una-clave-larga', admin.clave_hash as string)).toBe(true);
  });

  it('carga los parámetros de la institución', async () => {
    await ejecutarSeed(c.prisma, opciones({ institucionNombre: 'Institución X', dominiosCorreo: 'x.cl, y.cl' }));
    const cfg = Object.fromEntries((await c.prisma.configuracion_sistema.findMany()).map((p) => [p.clave, p.valor]));
    expect(cfg).toMatchObject({
      institucion_nombre: 'Institución X',
      dominios_correo: 'x.cl, y.cl',
      modulo_enrolamiento_activo: 'false',
      conector_enrolamiento: 'ninguno',
      codigo_vigencia_min: '5',
      codigo_max_intentos: '3',
      login_max_intentos: '5',
      login_bloqueo_min: '15',
      sesion_admin_horas: '8',
      foto_retencion_horas: '24',
      tiempo_inactividad_seg: '60',
    });
  });

  it('activar un conector enciende el módulo de enrolamiento', async () => {
    await ejecutarSeed(c.prisma, opciones({ conectorEnrolamiento: 'simulado' }));
    c.refrescar();
    expect((await c.http().get('/api/enrolamiento/estado').expect(200)).body).toMatchObject({ activo: true, dominiosAceptados: ['ejemplo.cl'] });
  });

  it('crea el rol Administrador con todos los permisos, y el primer administrador con la clave cifrada', async () => {
    const r = await ejecutarSeed(c.prisma, opciones({ admin: { correo: ' Admin@Ejemplo.cl ', clave: 'una-clave-larga' } }));
    expect(r).toMatchObject({ adminCreado: true, permisos: Object.keys(DESCRIPCION_PERMISOS).length });
    const rol = await c.prisma.rol.findUniqueOrThrow({ where: { nombre: 'Administrador' }, include: { rol_permiso_rel: { include: { permiso: true } } } });
    expect(rol.rol_permiso_rel.map((p) => p.permiso.codigo).sort()).toEqual(Object.keys(DESCRIPCION_PERMISOS).sort());
    const admin = await c.prisma.usuario.findUniqueOrThrow({ where: { correo: 'admin@ejemplo.cl' }, include: { usuario_rol_rel: true } });
    expect(admin.clave_hash).toMatch(/^\$2[aby]\$12\$/);
    expect(admin.clave_hash).not.toContain('una-clave-larga');
    expect(admin.usuario_rol_rel).toEqual([expect.objectContaining({ rol_id: rol.id })]);
  });

  it('un permiso agregado por otro módulo queda asignado al Administrador en la siguiente carga', async () => {
    await ejecutarSeed(c.prisma, opciones());
    await c.prisma.permiso.create({ data: { codigo: 'faq.publicar' } });
    await ejecutarSeed(c.prisma, opciones());
    const rol = await c.prisma.rol.findUniqueOrThrow({ where: { nombre: 'Administrador' }, include: { rol_permiso_rel: { include: { permiso: true } } } });
    expect(rol.rol_permiso_rel.map((p) => p.permiso.codigo)).toContain('faq.publicar');
  });

  it('crea el tótem con el id configurado y deja la secuencia lista', async () => {
    await ejecutarSeed(c.prisma, opciones({ totemId: 7, totemNombre: 'Tótem del hall' }));
    expect(await c.prisma.totem.findUniqueOrThrow({ where: { id: 7 } })).toMatchObject({ nombre: 'Tótem del hall' });
    const otro = await c.prisma.totem.create({ data: { nombre: 'Otro', sede_id: (await c.prisma.sede.findFirstOrThrow()).id } });
    expect(otro.id).toBe(8);
  });

  describe('contenido de la institución', () => {
    it('carga áreas con su sala y trámites con pasos y requisitos, y se ven en la API', async () => {
      const r = await ejecutarSeed(c.prisma, opciones({ contenido }));
      expect(r).toMatchObject({ areas: 3, tramites: 2 });
      c.refrescar();
      const areas = (await c.http().get('/api/areas').expect(200)).body as { nombre: string; ubicacion: { sala: { codigo: string }; piso: { numero: number } } | null }[];
      expect(areas.map((a) => a.nombre)).toEqual(['Atención de Estudiantes', 'Biblioteca', 'Informática y Soporte']);
      expect(areas.find((a) => a.nombre === 'Biblioteca')?.ubicacion).toBeNull();
      expect(areas.find((a) => a.nombre === 'Atención de Estudiantes')?.ubicacion).toMatchObject({ sala: { codigo: 'S01' }, piso: { numero: 2 } });
      const tramites = (await c.http().get('/api/tramites?q=certificado').expect(200)).body;
      const detalle = (await c.http().get(`/api/tramites/${tramites[0].id}`).expect(200)).body;
      expect(detalle.pasos.map((p: { orden: number }) => p.orden)).toEqual([1, 2, 3]);
      expect(detalle.requisitos).toHaveLength(2);
      expect(detalle.area.nombre).toBe('Atención de Estudiantes');
    });

    it('al cargar de nuevo reemplaza los pasos y requisitos en vez de duplicarlos', async () => {
      await ejecutarSeed(c.prisma, opciones({ contenido }));
      const modificado: ContenidoInstitucion = JSON.parse(JSON.stringify(contenido));
      (modificado.tramites as NonNullable<ContenidoInstitucion['tramites']>)[0].pasos = [{ titulo: 'Un solo paso', descripcion: 'Ahora es más simple.' }];
      await ejecutarSeed(c.prisma, opciones({ contenido: modificado }));
      expect(await c.prisma.tramite.count()).toBe(2);
      const t = await c.prisma.tramite.findFirstOrThrow({ where: { nombre: 'Solicitud de certificado de alumno regular' }, include: { paso_rel: true, requisito_rel: true } });
      expect(t.paso_rel.map((p) => p.titulo)).toEqual(['Un solo paso']);
      expect(t.requisito_rel).toHaveLength(2);
    });

    it('si el archivo tiene un error no deja nada a medias', async () => {
      const malo: ContenidoInstitucion = { areas: [{ nombre: 'Área rara', sala: { piso: 2, codigo: 'NO-EXISTE' } }] };
      await expect(ejecutarSeed(c.prisma, opciones({ contenido: malo }))).rejects.toThrow(/no existe la sala NO-EXISTE/);
      expect(await c.prisma.sede.count()).toBe(0);
      const sinArea: ContenidoInstitucion = { tramites: [{ nombre: 'Huérfano', area: 'Inexistente' }] };
      await expect(ejecutarSeed(c.prisma, opciones({ contenido: sinArea }))).rejects.toThrow(/no existe el área "Inexistente"/);
    });
  });
});
