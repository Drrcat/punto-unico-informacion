import { JwtService } from '@nestjs/jwt';
import { ErrorNegocio } from '../../src/common/filtros/errores';
import { SesionAdminService } from '../../src/common/auth/sesion-admin.service';
import { TokenEnrolamientoService } from '../../src/common/auth/token-enrolamiento.service';
import { hashToken } from '../../src/common/auth/tokens';
import { Entorno } from '../../src/config/entorno';

const SECRETO = 'secreto-de-prueba-unitaria';
const jwt = new JwtService();
const entorno = { jwtSecret: SECRETO } as Entorno;

function fila(cambios: Record<string, unknown> = {}) {
  return {
    usuario_id: 7,
    revocada_en: null,
    expira_en: new Date(Date.now() + 3_600_000),
    usuario: { correo: 'ada@ejemplo.cl', activo: true, usuario_rol_rel: [{ rol: { rol_permiso_rel: [{ permiso: { codigo: 'sala.editar' } }, { permiso: { codigo: 'area.editar' } }] } }] },
    ...cambios,
  };
}

function servicio(sesion: unknown) {
  const prisma = { sesion_admin: { findUnique: jest.fn().mockResolvedValue(sesion) } };
  return { svc: new SesionAdminService(prisma as never, jwt, entorno), prisma };
}

const emitir = (payload: object, opciones: { secret?: string; expiresIn?: string | number } = {}) =>
  jwt.signAsync(payload, { secret: opciones.secret ?? SECRETO, algorithm: 'HS256', expiresIn: (opciones.expiresIn ?? '1h') as never });

async function codigoDe(promesa: Promise<unknown>): Promise<string> {
  try {
    await promesa;
  } catch (e) {
    return (e as ErrorNegocio).codigo;
  }
  return 'SIN_ERROR';
}

describe('SesionAdminService', () => {
  it('sin encabezado no hay sesión (no es un error)', async () => {
    expect(await servicio(null).svc.desdeEncabezado(undefined)).toBeNull();
  });

  it('acepta un token vigente y entrega los permisos de los roles', async () => {
    const token = await emitir({ sub: '7' });
    const { svc, prisma } = servicio(fila());
    const admin = await svc.desdeEncabezado(`Bearer ${token}`);
    expect(admin?.usuarioId).toBe(7);
    expect([...(admin?.permisos ?? [])].sort()).toEqual(['area.editar', 'sala.editar']);
    // La sesión se busca por el SHA-256 del token, no por el token.
    expect(prisma.sesion_admin.findUnique.mock.calls[0][0].where.token_hash).toBe(hashToken(token));
  });

  it.each([
    ['esquema distinto de Bearer', 'Basic abc', 'TOKEN_INVALIDO'],
    ['token sin firma válida', 'Bearer abc.def.ghi', 'TOKEN_INVALIDO'],
  ])('rechaza %s', async (_n, enc, codigo) => {
    expect(await codigoDe(servicio(fila()).svc.desdeEncabezado(enc))).toBe(codigo);
  });

  it('rechaza un token firmado con otra clave', async () => {
    const token = await emitir({ sub: '7' }, { secret: 'otra-clave' });
    expect(await codigoDe(servicio(fila()).svc.desdeEncabezado(`Bearer ${token}`))).toBe('TOKEN_INVALIDO');
  });

  it('distingue un token vencido', async () => {
    const token = await emitir({ sub: '7' }, { expiresIn: -10 });
    expect(await codigoDe(servicio(fila()).svc.desdeEncabezado(`Bearer ${token}`))).toBe('TOKEN_EXPIRADO');
  });

  it('rechaza un token sin sub numérico', async () => {
    const token = await emitir({ sub: 'abc' });
    expect(await codigoDe(servicio(fila()).svc.desdeEncabezado(`Bearer ${token}`))).toBe('TOKEN_INVALIDO');
  });

  it('rechaza un token de enrolamiento aunque esté firmado con la misma clave', async () => {
    const token = await emitir({ sub: '7', scope: 'enrolamiento' });
    expect(await codigoDe(servicio(fila()).svc.desdeEncabezado(`Bearer ${token}`))).toBe('TOKEN_INVALIDO');
  });

  it.each([
    ['sin registro de sesión', null],
    ['sesión revocada', fila({ revocada_en: new Date() })],
    ['sesión vencida en la base', fila({ expira_en: new Date(Date.now() - 1000) })],
    ['sesión de otro usuario', fila({ usuario_id: 8 })],
    ['usuario desactivado', fila({ usuario: { ...fila().usuario, activo: false } })],
  ])('rechaza: %s', async (_n, sesion) => {
    const token = await emitir({ sub: '7' });
    expect(await codigoDe(servicio(sesion).svc.desdeEncabezado(`Bearer ${token}`))).toBe('SESION_INVALIDA');
  });
});

describe('TokenEnrolamientoService', () => {
  const svc = new TokenEnrolamientoService(jwt, entorno);

  it('emite y verifica el id del enrolamiento', async () => {
    expect(await svc.verificar(await svc.emitir(42, 10))).toBe(42);
  });
  it('un token de administrador no sirve como token de enrolamiento', async () => {
    const admin = await emitir({ sub: '42' });
    expect(await codigoDe(svc.verificar(admin))).toBe('TOKEN_INVALIDO');
    const conScope = await emitir({ sub: '42', scope: 'enrolamiento' });
    expect(await codigoDe(svc.verificar(conScope))).toBe('TOKEN_INVALIDO');
  });
  it('un token de enrolamiento no sirve como sesión de administrador', async () => {
    const token = await svc.emitir(42, 10);
    expect(await codigoDe(servicio(fila({ usuario_id: 42 })).svc.desdeEncabezado(`Bearer ${token}`))).toBe('TOKEN_INVALIDO');
  });
  it('distingue el token vencido', async () => {
    const vencido = await svc.emitir(42, -1);
    expect(await codigoDe(svc.verificar(vencido))).toBe('TOKEN_EXPIRADO');
  });
});
