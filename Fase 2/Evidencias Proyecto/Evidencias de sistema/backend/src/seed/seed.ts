/**
 * Carga inicial de datos. Se puede ejecutar las veces que se quiera: crea lo que falta y no pisa lo que
 * ya existe ni los cambios hechos desde el panel de administración.
 *
 *   npx prisma db seed            (dentro del contenedor: lee backend/package.json -> prisma.seed)
 *   npm run seed                  (en desarrollo, después de "npm run build")
 *
 * Qué carga:
 *   1. Sede, edificio, pisos, tipos de espacio y los espacios del plano (desde `zonas.json`).
 *   2. Parámetros de la institución (`configuracion_sistema`), solo los que faltan.
 *   3. Permisos del sistema y el rol Administrador (con todos los permisos existentes).
 *   4. El tótem de esta instalación.
 *   5. Opcional: un administrador inicial, y las áreas y trámites de la institución (`contenido.json`).
 */
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcryptjs';
import { existsSync, readFileSync } from 'fs';
import * as path from 'path';
import { DESCRIPCION_PERMISOS } from '../common/auth/permisos';

type Cliente = PrismaClient | Prisma.TransactionClient;

export interface Zona {
  piso: number;
  id: string;
  nombre: string;
  detalle: string;
  tipo: string;
  torre: number;
  clave: string;
}

export interface OpcionesSeed {
  zonas: Zona[];
  sedeNombre: string;
  edificioNombre: string;
  totemId: number;
  totemNombre: string;
  institucionNombre: string;
  dominiosCorreo: string;
  conectorEnrolamiento: 'ninguno' | 'simulado' | 'click_visitas';
  admin?: { correo: string; clave: string; nombres?: string; apellidos?: string };
  contenido?: ContenidoInstitucion;
}

export interface ContenidoInstitucion {
  areas?: {
    nombre: string;
    descripcion?: string;
    horarioAtencion?: string;
    correoContacto?: string;
    anexo?: string;
    sala?: { piso: number; codigo: string };
  }[];
  tramites?: {
    nombre: string;
    area: string;
    descripcion?: string;
    plazoDias?: number;
    requisitos?: { nombre: string; obligatorio?: boolean }[];
    pasos?: { titulo: string; descripcion: string }[];
  }[];
}

export interface ResumenSeed {
  pisos: number;
  espacios: number;
  tipos: number;
  parametrosNuevos: number;
  permisos: number;
  areas: number;
  tramites: number;
  adminCreado: boolean;
}

const TIPOS: Record<string, string> = { sala: 'Sala', bano: 'Baño', escalera: 'Escalera', ascensor: 'Ascensor', terraza: 'Terraza' };

/** Parámetros de la institución. Los cuatro últimos son del módulo de enrolamiento y se documentan en el README. */
function parametros(o: OpcionesSeed): [string, string, string][] {
  const enrolamientoActivo = o.conectorEnrolamiento !== 'ninguno';
  return [
    ['institucion_nombre', o.institucionNombre, 'Nombre que se muestra en el tótem y en los correos.'],
    ['institucion_logo_ruta', 'assets/logo.png', 'Ubicación del logotipo.'],
    ['color_primario', '#1D3557', 'Color principal de la interfaz del tótem.'],
    ['color_secundario', '#E9A23B', 'Color secundario de la interfaz del tótem.'],
    ['dominios_correo', o.dominiosCorreo, 'Dominios de correo aceptados para verificar a una persona, separados por coma.'],
    ['modulo_enrolamiento_activo', String(enrolamientoActivo), 'Activa el enrolamiento en las sedes con identificación facial.'],
    ['conector_enrolamiento', o.conectorEnrolamiento, 'Conector del sistema de enrolamiento: click_visitas, simulado o ninguno.'],
    ['codigo_vigencia_min', '5', 'Minutos de validez del código enviado al correo.'],
    ['codigo_max_intentos', '3', 'Códigos incorrectos permitidos antes de rechazar el intento.'],
    ['login_max_intentos', '5', 'Intentos fallidos de inicio de sesión antes del bloqueo temporal.'],
    ['login_bloqueo_min', '15', 'Minutos de bloqueo del inicio de sesión.'],
    ['sesion_admin_horas', '8', 'Duración de la sesión del administrador.'],
    ['foto_retencion_horas', '24', 'Máximo de horas que se conserva una fotografía si falló su carga.'],
    ['tiempo_inactividad_seg', '60', 'Segundos sin uso antes de volver a la pantalla de inicio del tótem.'],
    ['foto_max_intentos', '5', 'Fotografías rechazadas permitidas en una solicitud antes de empezar de nuevo.'],
    ['enrolamiento_vigencia_min', '10', 'Minutos que tiene la persona, tras verificar su correo, para enviar la fotografía.'],
    ['codigo_max_solicitudes', '3', 'Códigos que se pueden pedir para un mismo correo dentro de la ventana de tiempo.'],
    ['codigo_ventana_min', '10', 'Minutos de la ventana para contar las solicitudes de código de un correo.'],
  ];
}

export async function ejecutarSeed(prisma: PrismaClient, o: OpcionesSeed): Promise<ResumenSeed> {
  return prisma.$transaction(
    async (tx) => {
      const sede = await tx.sede.upsert({ where: { nombre: o.sedeNombre }, update: {}, create: { nombre: o.sedeNombre } });
      const edificio = await tx.edificio.upsert({
        where: { sede_id_nombre: { sede_id: sede.id, nombre: o.edificioNombre } },
        update: {},
        create: { sede_id: sede.id, nombre: o.edificioNombre },
      });

      // Tipos de espacio
      const tipoIds = new Map<string, number>();
      for (const [clave, nombre] of Object.entries(TIPOS)) {
        const t = await tx.tipo_espacio.upsert({ where: { nombre }, update: {}, create: { nombre, es_buscable: true } });
        tipoIds.set(clave, t.id);
      }

      // Pisos y espacios
      const numeros = [...new Set(o.zonas.map((z) => z.piso))].sort((a, b) => a - b);
      const pisoIds = new Map<number, number>();
      for (const n of numeros) {
        const p = await tx.piso.upsert({
          where: { edificio_id_numero: { edificio_id: edificio.id, numero: n } },
          update: {},
          create: { edificio_id: edificio.id, numero: n, nombre: `Piso ${n}`, plano_svg_ruta: `piso-${n}.svg` },
        });
        pisoIds.set(n, p.id);
      }
      const espacios = await cargarEspacios(tx, o.zonas, pisoIds, tipoIds);

      // Parámetros: solo los que faltan
      const nuevos = await tx.configuracion_sistema.createMany({
        data: parametros(o).map(([clave, valor, descripcion]) => ({ clave, valor, descripcion })),
        skipDuplicates: true,
      });

      // Permisos y rol Administrador
      for (const [codigo, descripcion] of Object.entries(DESCRIPCION_PERMISOS)) {
        await tx.permiso.upsert({ where: { codigo }, update: {}, create: { codigo, descripcion } });
      }
      const rol = await tx.rol.upsert({ where: { nombre: 'Administrador' }, update: {}, create: { nombre: 'Administrador', descripcion: 'Gestiona los contenidos y consulta las solicitudes de enrolamiento.' } });
      const permisos = await tx.permiso.findMany({ select: { id: true } });
      await tx.rol_permiso.createMany({ data: permisos.map((p) => ({ rol_id: rol.id, permiso_id: p.id })), skipDuplicates: true });

      // Tótem de esta instalación
      await tx.totem.upsert({ where: { id: o.totemId }, update: {}, create: { id: o.totemId, nombre: o.totemNombre, sede_id: sede.id } });
      await tx.$executeRaw`SELECT setval(pg_get_serial_sequence('totem', 'id'), GREATEST((SELECT MAX(id) FROM totem), 1))`;

      const adminCreado = o.admin ? await crearAdmin(tx, o.admin, rol.id) : false;
      const contenido = o.contenido ? await cargarContenido(tx, o.contenido) : { areas: 0, tramites: 0 };

      return { pisos: numeros.length, espacios, tipos: tipoIds.size, parametrosNuevos: nuevos.count, permisos: permisos.length, adminCreado, ...contenido };
    },
    { timeout: 60_000 },
  );
}

/**
 * Una sala puede estar dibujada con varias piezas del plano (misma `clave`). Se crea un solo espacio por
 * `clave`; su `svg_element_id` es el id de la primera pieza y el plano exportado agrupa todas bajo ese id.
 */
async function cargarEspacios(tx: Cliente, zonas: Zona[], pisoIds: Map<number, number>, tipoIds: Map<string, number>): Promise<number> {
  const grupos = new Map<string, Zona[]>();
  for (const z of zonas) grupos.set(`${z.piso}|${z.clave}`, [...(grupos.get(`${z.piso}|${z.clave}`) ?? []), z]);

  // Nombres repetidos dentro de un piso (p. ej. "Baño hombres" en dos torres) se distinguen por la torre.
  const repeticiones = new Map<string, number>();
  for (const [, g] of grupos) repeticiones.set(`${g[0].piso}|${g[0].nombre}`, (repeticiones.get(`${g[0].piso}|${g[0].nombre}`) ?? 0) + 1);

  const codigosUsados = new Set<string>();
  let n = 0;
  for (const [, g] of grupos) {
    const z = g[0];
    const codigo = codigoUnico(codigoDeZona(z), `${z.piso}`, codigosUsados);
    const repetido = (repeticiones.get(`${z.piso}|${z.nombre}`) ?? 0) > 1;
    const nombre = (repetido ? `${z.nombre} (torre ${z.torre})` : z.nombre).slice(0, 120);
    const pisoId = pisoIds.get(z.piso) as number;
    const e = await tx.espacio.upsert({
      where: { piso_id_codigo: { piso_id: pisoId, codigo } },
      update: {},
      create: { piso_id: pisoId, tipo_espacio_id: tipoIds.get(z.tipo) ?? (tipoIds.get('sala') as number), codigo, nombre, svg_element_id: z.id },
    });
    if (z.detalle) await tx.espacio_alias.createMany({ data: [{ espacio_id: e.id, alias: z.detalle.slice(0, 120) }], skipDuplicates: true });
    n++;
  }
  return n;
}

/**
 * Código de la sala a partir del id del plano: "P3-T1-S01" -> "S01" y "P3-PA-323" -> "PA-323" (se quitan el piso y,
 * si lo trae, la torre). Si el id arrastra el detalle ("P3-PA-LATI-LABORATORIO...") se usa el nombre.
 */
function codigoDeZona(z: Zona): string {
  const sinPrefijo = (z.id.startsWith(`P${z.piso}-`) ? z.id.slice(`P${z.piso}-`.length) : z.id).replace(/^T\d+-/, '');
  const base = z.detalle || sinPrefijo.length > 30 ? z.nombre : sinPrefijo;
  const limpio = base
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return (limpio || sinPrefijo).slice(0, 30);
}

/** Si dos espacios de un mismo piso dieran el mismo código, el segundo recibe un sufijo numérico. */
function codigoUnico(codigo: string, piso: string, usados: Set<string>): string {
  let candidato = codigo;
  for (let i = 2; usados.has(`${piso}|${candidato}`); i++) candidato = `${codigo.slice(0, 30 - String(i).length - 1)}-${i}`;
  usados.add(`${piso}|${candidato}`);
  return candidato;
}

async function crearAdmin(tx: Cliente, a: NonNullable<OpcionesSeed['admin']>, rolId: number): Promise<boolean> {
  const correo = a.correo.trim().toLowerCase();
  const existente = await tx.usuario.findUnique({ where: { correo } });
  const usuario =
    existente ??
    (await tx.usuario.create({
      data: { correo, nombres: a.nombres ?? 'Administrador', apellidos: a.apellidos ?? 'del sistema', clave_hash: await bcrypt.hash(a.clave, 12) },
    }));
  await tx.usuario_rol.createMany({ data: [{ usuario_id: usuario.id, rol_id: rolId }], skipDuplicates: true });
  return !existente;
}

/** Áreas y trámites de la institución. Reemplaza los pasos y requisitos de cada trámite por los del archivo. */
export async function cargarContenido(tx: Cliente, c: ContenidoInstitucion): Promise<{ areas: number; tramites: number }> {
  const areaIds = new Map<string, number>();
  for (const a of c.areas ?? []) {
    let espacioId: number | null = null;
    if (a.sala) {
      const e = await tx.espacio.findFirst({ where: { codigo: a.sala.codigo, piso: { numero: a.sala.piso } }, select: { id: true } });
      if (!e) throw new Error(`Área "${a.nombre}": no existe la sala ${a.sala.codigo} del piso ${a.sala.piso}.`);
      espacioId = e.id;
    }
    const datos = { descripcion: a.descripcion ?? null, espacio_id: espacioId, horario_atencion: a.horarioAtencion ?? null, correo_contacto: a.correoContacto ?? null, anexo: a.anexo ?? null };
    const area = await tx.area_institucional.upsert({ where: { nombre: a.nombre }, update: datos, create: { nombre: a.nombre, ...datos } });
    areaIds.set(a.nombre, area.id);
  }
  for (const t of c.tramites ?? []) {
    const areaId = areaIds.get(t.area) ?? (await tx.area_institucional.findUnique({ where: { nombre: t.area }, select: { id: true } }))?.id;
    if (!areaId) throw new Error(`Trámite "${t.nombre}": no existe el área "${t.area}".`);
    const existente = await tx.tramite.findFirst({ where: { nombre: t.nombre, area_id: areaId }, select: { id: true } });
    const datos = { descripcion: t.descripcion ?? null, plazo_dias: t.plazoDias ?? null, activo: true };
    const tramite = existente
      ? await tx.tramite.update({ where: { id: existente.id }, data: datos })
      : await tx.tramite.create({ data: { nombre: t.nombre, area_id: areaId, ...datos } });
    await tx.tramite_paso.deleteMany({ where: { tramite_id: tramite.id } });
    await tx.tramite_requisito.deleteMany({ where: { tramite_id: tramite.id } });
    await tx.tramite_paso.createMany({ data: (t.pasos ?? []).map((p, i) => ({ tramite_id: tramite.id, orden: i + 1, titulo: p.titulo, descripcion: p.descripcion })) });
    await tx.tramite_requisito.createMany({ data: (t.requisitos ?? []).map((r) => ({ tramite_id: tramite.id, nombre: r.nombre, obligatorio: r.obligatorio ?? true })) });
  }
  return { areas: c.areas?.length ?? 0, tramites: c.tramites?.length ?? 0 };
}

// ---------------------------------------------------------------------- ejecución desde la línea de comandos

/** Busca un archivo de datos en la imagen (`./prisma/seed`) o en el repositorio (`../database/prisma/seed`). */
function archivoSeed(nombre: string): string | null {
  for (const base of ['./prisma/seed', '../database/prisma/seed']) {
    const ruta = path.resolve(base, nombre);
    if (existsSync(ruta)) return ruta;
  }
  return null;
}

async function main(): Promise<void> {
  const env = process.env;
  if (!env.DATABASE_URL) throw new Error('DATABASE_URL es obligatoria.');
  const rutaZonas = env.SEED_ZONAS ?? archivoSeed('zonas.json');
  if (!rutaZonas) throw new Error('No se encontró zonas.json. Indica su ruta con SEED_ZONAS.');
  const conector = (env.SEED_CONECTOR_ENROLAMIENTO ?? 'ninguno') as OpcionesSeed['conectorEnrolamiento'];
  if (!['ninguno', 'simulado', 'click_visitas'].includes(conector)) throw new Error(`SEED_CONECTOR_ENROLAMIENTO desconocido: ${conector}`);

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: env.DATABASE_URL }) });
  try {
    const resumen = await ejecutarSeed(prisma, {
      zonas: JSON.parse(readFileSync(rutaZonas, 'utf8')) as Zona[],
      sedeNombre: env.SEED_SEDE_NOMBRE ?? 'Sede principal',
      edificioNombre: env.SEED_EDIFICIO_NOMBRE ?? 'Edificio principal',
      totemId: Number(env.TOTEM_ID ?? 1),
      totemNombre: env.SEED_TOTEM_NOMBRE ?? 'Tótem 1',
      institucionNombre: env.SEED_INSTITUCION_NOMBRE ?? 'Mi institución',
      dominiosCorreo: env.SEED_DOMINIOS_CORREO ?? '',
      conectorEnrolamiento: conector,
      admin: env.SEED_ADMIN_CORREO && env.SEED_ADMIN_CLAVE ? { correo: env.SEED_ADMIN_CORREO, clave: env.SEED_ADMIN_CLAVE } : undefined,
      contenido: env.SEED_CONTENIDO ? (JSON.parse(readFileSync(env.SEED_CONTENIDO, 'utf8')) as ContenidoInstitucion) : undefined,
    });
    console.log('Carga inicial lista:', resumen);
    if (!env.SEED_ADMIN_CORREO) console.log('No se creó administrador (define SEED_ADMIN_CORREO y SEED_ADMIN_CLAVE para crear el primero).');
    if (!env.SEED_DOMINIOS_CORREO) console.log('Recuerda definir los dominios de correo aceptados (SEED_DOMINIOS_CORREO o la tabla configuracion_sistema).');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  });
}
