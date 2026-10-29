/**
 * Variables de entorno del backend, validadas una sola vez al iniciar.
 * Las claves coinciden con las de `env.example` de la raíz del repositorio.
 */
export const ENTORNO = Symbol('ENTORNO');

export type DriverCorreo = 'resend' | 'consola';
export type DriverVision = 'google' | 'simulado';

export interface Entorno {
  produccion: boolean;
  puerto: number;
  host: string;
  databaseUrl: string;
  jwtSecret: string;
  /** Id del tótem donde corre esta instalación (fila de la tabla `totem`). */
  totemId: number;
  correo: { driver: DriverCorreo; apiKey: string; remitente: string };
  vision: { driver: DriverVision };
  /** Conector por defecto si `configuracion_sistema.conector_enrolamiento` no está definido. */
  enrolamiento: { conector: string; url: string; usuario: string; clave: string };
  fotosDir: string;
  /** Carpeta donde están los planos SVG referenciados por `piso.plano_svg_ruta`. */
  planosDir: string;
  /** Carpeta con la aplicación web del tótem (opcional). */
  publicDir: string;
  /** Límite general de solicitudes por minuto y por origen. */
  limitePorMinuto: number;
  limitesActivos: boolean;
  tareasActivas: boolean;
  /** Orígenes autorizados para llamar al backend desde un navegador (vacío = ninguno). */
  corsOrigenes: string[];
  /** Publica la documentación OpenAPI en /api/docs. */
  docs: boolean;
  /** Avisos que se imprimen al iniciar (p. ej. proveedores simulados). */
  advertencias: string[];
}

export class EntornoInvalido extends Error {}

function entero(v: string | undefined, def: number, nombre: string): number {
  if (v === undefined || v === '') return def;
  const n = Number(v);
  if (!Number.isInteger(n) || n < 0) throw new EntornoInvalido(`${nombre} debe ser un entero positivo (valor: "${v}")`);
  return n;
}

export function cargarEntorno(env: NodeJS.ProcessEnv = process.env): Entorno {
  const produccion = env.NODE_ENV === 'production';
  const errores: string[] = [];

  const databaseUrl = env.DATABASE_URL ?? '';
  if (!databaseUrl) errores.push('DATABASE_URL es obligatoria');

  const jwtSecret = env.JWT_SECRET ?? '';
  if (!jwtSecret) errores.push('JWT_SECRET es obligatoria');
  else if (produccion && jwtSecret.length < 32) errores.push('JWT_SECRET debe tener al menos 32 caracteres en producción');

  const apiKey = env.CORREO_API_KEY ?? '';
  const driverCorreo = (env.CORREO_DRIVER ?? (apiKey ? 'resend' : 'consola')) as DriverCorreo;
  if (!['resend', 'consola'].includes(driverCorreo)) errores.push(`CORREO_DRIVER desconocido: ${driverCorreo}`);
  if (driverCorreo === 'resend' && (!apiKey || !env.CORREO_REMITENTE)) {
    errores.push('CORREO_API_KEY y CORREO_REMITENTE son obligatorias con el proveedor de correo "resend"');
  }

  const credenciales = env.GOOGLE_APPLICATION_CREDENTIALS ?? '';
  const driverVision = (env.VISION_DRIVER ?? (credenciales ? 'google' : 'simulado')) as DriverVision;
  if (!['google', 'simulado'].includes(driverVision)) errores.push(`VISION_DRIVER desconocido: ${driverVision}`);

  const advertencias: string[] = [];
  if (driverCorreo === 'consola') advertencias.push('Correo en modo "consola": los códigos de verificación se imprimen en el log y no se envía ningún correo.');
  if (driverVision === 'simulado') advertencias.push('Validador de rostros en modo "simulado": acepta cualquier imagen válida, sin consultar Google Vision AI.');
  if (!produccion && jwtSecret && jwtSecret.length < 32) advertencias.push('JWT_SECRET tiene menos de 32 caracteres (solo se tolera fuera de producción).');

  let puerto = 3000;
  let totemId = 1;
  let limitePorMinuto = 300;
  try {
    puerto = entero(env.PORT, 3000, 'PORT');
    totemId = entero(env.TOTEM_ID, 1, 'TOTEM_ID');
    limitePorMinuto = entero(env.LIMITE_SOLICITUDES_POR_MIN, 300, 'LIMITE_SOLICITUDES_POR_MIN');
  } catch (e) {
    errores.push((e as Error).message);
  }

  if (errores.length) throw new EntornoInvalido(`Configuración inválida:\n - ${errores.join('\n - ')}`);

  return {
    produccion,
    puerto,
    host: env.HOST ?? '0.0.0.0',
    databaseUrl,
    jwtSecret,
    totemId,
    correo: { driver: driverCorreo, apiKey, remitente: env.CORREO_REMITENTE ?? '' },
    vision: { driver: driverVision },
    enrolamiento: {
      conector: env.ENROLAMIENTO_CONECTOR ?? 'ninguno',
      url: env.ENROLAMIENTO_URL ?? '',
      usuario: env.ENROLAMIENTO_USUARIO ?? '',
      clave: env.ENROLAMIENTO_CLAVE ?? '',
    },
    fotosDir: env.FOTOS_DIR ?? './fotos',
    planosDir: env.PLANOS_DIR ?? './public/assets/planos',
    publicDir: env.PUBLIC_DIR ?? './public',
    limitePorMinuto,
    limitesActivos: env.LIMITES !== 'off',
    tareasActivas: env.TAREAS !== 'off',
    corsOrigenes: (env.CORS_ORIGENES ?? '').split(',').map((o) => o.trim()).filter(Boolean),
    docs: !produccion || env.DOCS === 'on',
    advertencias,
  };
}
