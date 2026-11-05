import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { hashToken } from '../../src/common/auth/tokens';
import { ErrorNegocio } from '../../src/common/filtros/errores';
import { Entorno } from '../../src/config/entorno';
import { AuthService } from '../../src/modulos/auth/auth.service';

const SECRETO = 'secreto-de-prueba-unitaria';
const jwt = new JwtService();
const entorno = { jwtSecret: SECRETO } as Entorno;
const CLAVE = 'Correcta#2026';
let HASH: string;

beforeAll(async () => {
  HASH = await bcrypt.hash(CLAVE, 4);
});

function usuario(cambios: Record<string, unknown> = {}) {
  return {
    id: 7,
    correo: 'ada@ejemplo.cl',
    nombres: 'Ada',
    apellidos: 'Admin',
    activo: true,
    clave_hash: HASH,
    intentos_fallidos: 0,
    bloqueado_hasta: null as Date | null,
    usuario_rol_rel: [{ rol: { rol_permiso_rel: [{ permiso: { codigo: 'sala.editar' } }, { permiso: { codigo: 'area.editar' } }] } }],
    ...cambios,
  };
}

function servicio(fila: unknown, config: Record<string, number> = {}, intentosTrasFallo = 1) {
  const valores: Record<string, number> = { login_max_intentos: 5, login_bloqueo_min: 15, sesion_admin_horas: 8, ...config };
  const prisma = {
    usuario: {
      findUnique: jest.fn().mockResolvedValue(fila),
      update: jest.fn().mockResolvedValue({ intentos_fallidos: intentosTrasFallo }),
      findUniqueOrThrow: jest.fn(),
    },
    sesion_admin: { create: jest.fn().mockReturnValue('crear-sesion'), updateMany: jest.fn().mockResolvedValue({ count: 1 }) },
    $transaction: jest.fn().mockResolvedValue([]),
  };
  const cfg = { entero: jest.fn(async (k: string) => valores[k]) };
  return { svc: new AuthService(prisma as never, jwt, cfg as never, entorno), prisma };
}

async function error(promesa: Promise<unknown>): Promise<{ codigo: string; estado: number }> {
  try {
    await promesa;
  } catch (e) {
    return { codigo: (e as ErrorNegocio).codigo, estado: (e as ErrorNegocio).getStatus() };
  }
  return { codigo: 'SIN_ERROR', estado: 0 };
}

describe('AuthService.login', () => {
  it('con la contraseña correcta emite un JWT válido y registra su hash en sesion_admin', async () => {
    const { svc, prisma } = servicio(usuario());
    const r = await svc.login('  ADA@Ejemplo.cl ', CLAVE);

    expect(prisma.usuario.findUnique.mock.calls[0][0].where).toEqual({ correo: 'ada@ejemplo.cl' });
    const payload = await jwt.verifyAsync(r.token, { secret: SECRETO, algorithms: ['HS256'] });
    expect(payload.sub).toBe('7');
    expect(payload.exp - payload.iat).toBe(8 * 3600);
    const datos = prisma.sesion_admin.create.mock.calls[0][0].data;
    expect(datos.token_hash).toBe(hashToken(r.token));
    expect(datos.usuario_id).toBe(7);
    expect(r.usuario).toEqual({ id: 7, correo: 'ada@ejemplo.cl', nombres: 'Ada', apellidos: 'Admin', permisos: ['area.editar', 'sala.editar'] });
    // Un ingreso correcto reinicia el contador de intentos.
    expect(prisma.usuario.update).toHaveBeenCalledWith({ where: { id: 7 }, data: { intentos_fallidos: 0, bloqueado_hasta: null } });
  });

  it('usa la duración de sesión configurada', async () => {
    const r = await servicio(usuario(), { sesion_admin_horas: 2 }).svc.login('ada@ejemplo.cl', CLAVE);
    const payload = await jwt.verifyAsync(r.token, { secret: SECRETO });
    expect(payload.exp - payload.iat).toBe(2 * 3600);
    expect(new Date(r.expiraEn).getTime()).toBeGreaterThan(Date.now() + 1.9 * 3_600_000);
  });

  it.each([
    ['correo inexistente', null],
    ['usuario desactivado', usuario({ activo: false })],
    ['usuario sin contraseña (estudiante enrolado)', usuario({ clave_hash: null })],
  ])('responde lo mismo ante %s', async (_n, fila) => {
    const { svc, prisma } = servicio(fila);
    expect(await error(svc.login('ada@ejemplo.cl', CLAVE))).toEqual({ codigo: 'CREDENCIALES_INVALIDAS', estado: 401 });
    expect(prisma.sesion_admin.create).not.toHaveBeenCalled();
  });

  it('una contraseña incorrecta suma un intento y no crea sesión', async () => {
    const { svc, prisma } = servicio(usuario(), {}, 2);
    expect(await error(svc.login('ada@ejemplo.cl', 'otra'))).toEqual({ codigo: 'CREDENCIALES_INVALIDAS', estado: 401 });
    expect(prisma.usuario.update).toHaveBeenCalledWith(expect.objectContaining({ data: { intentos_fallidos: { increment: 1 } } }));
    expect(prisma.sesion_admin.create).not.toHaveBeenCalled();
  });

  it('al llegar al máximo de intentos bloquea la cuenta los minutos configurados', async () => {
    const { svc, prisma } = servicio(usuario(), { login_max_intentos: 3, login_bloqueo_min: 10 }, 3);
    expect(await error(svc.login('ada@ejemplo.cl', 'otra'))).toEqual({ codigo: 'CUENTA_BLOQUEADA', estado: 429 });
    const bloqueo = prisma.usuario.update.mock.calls[1][0].data;
    expect(bloqueo.intentos_fallidos).toBe(0);
    expect(Math.round((bloqueo.bloqueado_hasta.getTime() - Date.now()) / 60_000)).toBe(10);
  });

  it('con la cuenta bloqueada rechaza incluso la contraseña correcta', async () => {
    const { svc, prisma } = servicio(usuario({ bloqueado_hasta: new Date(Date.now() + 5 * 60_000) }));
    expect(await error(svc.login('ada@ejemplo.cl', CLAVE))).toEqual({ codigo: 'CUENTA_BLOQUEADA', estado: 429 });
    expect(prisma.sesion_admin.create).not.toHaveBeenCalled();
  });

  it('un bloqueo ya vencido no impide entrar', async () => {
    const r = await servicio(usuario({ bloqueado_hasta: new Date(Date.now() - 1000) })).svc.login('ada@ejemplo.cl', CLAVE);
    expect(r.token).toBeTruthy();
  });

  it('rechaza a un usuario sin ningún permiso de administración', async () => {
    const { svc, prisma } = servicio(usuario({ usuario_rol_rel: [] }));
    expect(await error(svc.login('ada@ejemplo.cl', CLAVE))).toEqual({ codigo: 'SIN_PERMISO', estado: 403 });
    expect(prisma.sesion_admin.create).not.toHaveBeenCalled();
  });
});

describe('AuthService.logout', () => {
  it('revoca la sesión buscándola por el hash del token', async () => {
    const { svc, prisma } = servicio(null);
    await svc.logout('Bearer abc.def.ghi');
    const arg = prisma.sesion_admin.updateMany.mock.calls[0][0];
    expect(arg.where).toEqual({ token_hash: hashToken('abc.def.ghi'), revocada_en: null });
    expect(arg.data.revocada_en).toBeInstanceOf(Date);
  });
});
