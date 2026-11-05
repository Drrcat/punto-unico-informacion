import * as bcrypt from 'bcryptjs';
import { PERMISOS } from '../../src/common/auth/permisos';
import { Contexto, crearApp } from '../soporte/app';
import { sembrar, vaciar } from '../soporte/fixtures';

const CLAVE = 'Clave-Segura-2026';

describe('Inicio de sesión del personal', () => {
  let c: Contexto;

  beforeAll(async () => {
    c = await crearApp();
  });
  beforeEach(async () => {
    await vaciar(c.prisma);
    await sembrar(c.prisma);
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  async function crearPersonal(permisos: string[] = Object.values(PERMISOS), extra: Record<string, unknown> = {}) {
    const rol = await c.prisma.rol.create({ data: { nombre: `rol-${Date.now()}-${Math.random()}` } });
    for (const codigo of permisos) {
      const p = await c.prisma.permiso.upsert({ where: { codigo }, update: {}, create: { codigo } });
      await c.prisma.rol_permiso.create({ data: { rol_id: rol.id, permiso_id: p.id } });
    }
    return c.prisma.usuario.create({
      data: { correo: 'admin@duocuc.cl', nombres: 'Ada', apellidos: 'Admin', clave_hash: await bcrypt.hash(CLAVE, 4), usuario_rol_rel: { create: { rol_id: rol.id } }, ...extra },
    });
  }

  const login = (correo: string, clave: string) => c.http().post('/api/auth/login').send({ correo, clave });

  it('el token del login sirve en las rutas de administración, y deja de servir al cerrar sesión', async () => {
    await crearPersonal();
    const r = await login('Admin@DuocUC.cl', CLAVE).expect(200);
    expect(r.body.usuario).toMatchObject({ correo: 'admin@duocuc.cl', nombres: 'Ada' });
    expect(r.body.usuario.permisos).toContain(PERMISOS.ENROLAMIENTO_VER);
    const auth = { Authorization: `Bearer ${r.body.token}` };

    expect((await c.http().get('/api/auth/sesion').set(auth).expect(200)).body.correo).toBe('admin@duocuc.cl');
    await c.http().get('/api/enrolamiento/solicitudes').set(auth).expect(200);

    await c.http().post('/api/auth/logout').set(auth).expect(204);
    expect((await c.http().get('/api/enrolamiento/solicitudes').set(auth).expect(401)).body.codigo).toBe('SESION_INVALIDA');
  });

  it('las credenciales incorrectas responden igual exista o no el correo', async () => {
    await crearPersonal();
    const a = await login('admin@duocuc.cl', 'incorrecta').expect(401);
    const b = await login('nadie@duocuc.cl', CLAVE).expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.codigo).toBe('CREDENCIALES_INVALIDAS');
    expect(await c.prisma.sesion_admin.count()).toBe(0);
  });

  it('bloquea la cuenta tras los intentos configurados, aun con la contraseña correcta', async () => {
    await c.prisma.configuracion_sistema.upsert({ where: { clave: 'login_max_intentos' }, update: { valor: '3' }, create: { clave: 'login_max_intentos', valor: '3' } });
    c.refrescar();
    await crearPersonal();
    await login('admin@duocuc.cl', 'mal1').expect(401);
    await login('admin@duocuc.cl', 'mal2').expect(401);
    expect((await login('admin@duocuc.cl', 'mal3').expect(429)).body.codigo).toBe('CUENTA_BLOQUEADA');
    expect((await login('admin@duocuc.cl', CLAVE).expect(429)).body.codigo).toBe('CUENTA_BLOQUEADA');

    // Vencido el bloqueo, entra y el contador queda en cero.
    await c.prisma.usuario.update({ where: { correo: 'admin@duocuc.cl' }, data: { bloqueado_hasta: new Date(Date.now() - 1000) } });
    await login('admin@duocuc.cl', CLAVE).expect(200);
    expect(await c.prisma.usuario.findUnique({ where: { correo: 'admin@duocuc.cl' }, select: { intentos_fallidos: true, bloqueado_hasta: true } })).toEqual({ intentos_fallidos: 0, bloqueado_hasta: null });
  });

  it('rechaza a un usuario desactivado y a uno sin permisos', async () => {
    const u = await crearPersonal([]);
    expect((await login('admin@duocuc.cl', CLAVE).expect(403)).body.codigo).toBe('SIN_PERMISO');
    await c.prisma.usuario.update({ where: { id: u.id }, data: { activo: false } });
    expect((await login('admin@duocuc.cl', CLAVE).expect(401)).body.codigo).toBe('CREDENCIALES_INVALIDAS');
  });

  it('valida el cuerpo de la solicitud', async () => {
    await c.http().post('/api/auth/login').send({ correo: 'no-es-correo', clave: 'x' }).expect(400);
    await c.http().post('/api/auth/login').send({ correo: 'admin@duocuc.cl' }).expect(400);
    await c.http().post('/api/auth/login').send({ correo: 'admin@duocuc.cl', clave: 'x', rol: 'root' }).expect(400);
  });

  it('cerrar sesión y consultar la sesión exigen un token', async () => {
    await c.http().post('/api/auth/logout').expect(401);
    await c.http().get('/api/auth/sesion').expect(401);
  });
});
