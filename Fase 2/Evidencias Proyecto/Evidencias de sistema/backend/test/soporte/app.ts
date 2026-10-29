import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { mkdtempSync, rmSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import request from 'supertest';
import { AppModule } from '../../src/app.module';
import { configurarApp } from '../../src/app.setup';
import { hashToken } from '../../src/common/auth/tokens';
import { ConfiguracionService } from '../../src/common/configuracion/configuracion.service';
import { PrismaService } from '../../src/common/prisma/prisma.service';
import { Invalidador } from '../../src/common/util/indice-cache';
import { Entorno } from '../../src/config/entorno';
import { ConectoresService } from '../../src/integraciones/conector/conectores.service';
import { CorreoProvider } from '../../src/integraciones/correo/correo.provider';
import { ValidadorRostros } from '../../src/integraciones/vision/validador-rostros';
import { ConectorFalso, CorreoFalso, VisionFalsa } from './falsos';

export const JWT_SECRET_PRUEBAS = 'clave-de-pruebas-que-no-sirve-en-ningun-otro-lado';

export interface Contexto {
  app: INestApplication;
  prisma: PrismaService;
  entorno: Entorno;
  correo: CorreoFalso;
  vision: VisionFalsa;
  conector: ConectorFalso;
  fotosDir: string;
  planosDir: string;
  http: () => ReturnType<typeof request>;
  /** Tras cambiar datos o parámetros directo en la base, hay que vaciar las cachés. */
  refrescar: () => void;
  cerrar: () => Promise<void>;
}

export async function crearApp(cambios: Partial<Entorno> = {}): Promise<Contexto> {
  const carpeta = mkdtempSync(path.join(tmpdir(), 'orientasede-test-'));
  const entorno: Entorno = {
    produccion: false,
    puerto: 0,
    host: '127.0.0.1',
    databaseUrl: process.env.TEST_DATABASE_URL as string,
    jwtSecret: JWT_SECRET_PRUEBAS,
    totemId: 1,
    correo: { driver: 'consola', apiKey: '', remitente: '' },
    vision: { driver: 'simulado' },
    enrolamiento: { conector: 'ninguno', url: '', usuario: '', clave: '' },
    fotosDir: path.join(carpeta, 'fotos'),
    planosDir: path.join(carpeta, 'planos'),
    publicDir: path.join(carpeta, 'no-existe'),
    limitePorMinuto: 1000,
    limitesActivos: false,
    tareasActivas: false,
    corsOrigenes: [],
    docs: false,
    advertencias: [],
    ...cambios,
  };
  const correo = new CorreoFalso();
  const vision = new VisionFalsa();
  const conector = new ConectorFalso();

  const modulo = await Test.createTestingModule({ imports: [AppModule.forRoot(entorno)] })
    .overrideProvider(CorreoProvider)
    .useValue(correo)
    .overrideProvider(ValidadorRostros)
    .useValue(vision)
    .overrideProvider(ConectoresService)
    .useValue({ obtener: async () => conector })
    .compile();
  const app = modulo.createNestApplication();
  configurarApp(app, entorno);
  await app.init();

  const prisma = app.get(PrismaService);
  return {
    app,
    prisma,
    entorno,
    correo,
    vision,
    conector,
    fotosDir: entorno.fotosDir,
    planosDir: entorno.planosDir,
    http: () => request(app.getHttpServer()),
    refrescar: () => {
      app.get(ConfiguracionService).invalidar();
      app.get(Invalidador).invalidar();
    },
    cerrar: async () => {
      await app.close();
      rmSync(carpeta, { recursive: true, force: true });
    },
  };
}

/** Crea un usuario con un rol que tiene esos permisos, y una sesión vigente. Devuelve el token como lo emitiría el login. */
export async function crearAdmin(
  prisma: PrismaService,
  permisos: string[],
  opciones: { correo?: string; horas?: number; activo?: boolean; secreto?: string } = {},
): Promise<{ token: string; usuarioId: number }> {
  const correo = opciones.correo ?? `admin${Date.now()}${Math.floor(Math.random() * 1e6)}@ejemplo.cl`;
  const rol = await prisma.rol.create({ data: { nombre: `rol-${correo}` } });
  for (const codigo of permisos) {
    const p = await prisma.permiso.upsert({ where: { codigo }, update: {}, create: { codigo } });
    await prisma.rol_permiso.create({ data: { rol_id: rol.id, permiso_id: p.id } });
  }
  const usuario = await prisma.usuario.create({ data: { correo, nombres: 'Ada', apellidos: 'Admin', activo: opciones.activo ?? true, usuario_rol_rel: { create: { rol_id: rol.id } } } });
  const horas = opciones.horas ?? 8;
  const token = await new JwtService().signAsync({ sub: String(usuario.id) }, { secret: opciones.secreto ?? JWT_SECRET_PRUEBAS, algorithm: 'HS256', expiresIn: `${horas}h` });
  await prisma.sesion_admin.create({ data: { usuario_id: usuario.id, token_hash: hashToken(token), expira_en: new Date(Date.now() + horas * 3_600_000) } });
  return { token, usuarioId: usuario.id };
}
