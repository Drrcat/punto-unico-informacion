import { JwtService } from '@nestjs/jwt';
import { PERMISOS } from '../../src/common/auth/permisos';
import { claveEnrolamiento, hashToken } from '../../src/common/auth/tokens';
import { crearAdmin, Contexto, crearApp, JWT_SECRET_PRUEBAS } from '../soporte/app';
import { Base, sembrar, vaciar } from '../soporte/fixtures';

const TODOS = Object.values(PERMISOS);

describe('Administración de salas y áreas', () => {
  let c: Contexto;
  let b: Base;
  let admin: { token: string; usuarioId: number };
  const auth = (token = admin.token) => ({ Authorization: `Bearer ${token}` });

  beforeAll(async () => {
    c = await crearApp();
  });
  beforeEach(async () => {
    await vaciar(c.prisma);
    b = await sembrar(c.prisma);
    admin = await crearAdmin(c.prisma, TODOS);
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  const nuevaSala = (extra: Record<string, unknown> = {}) => ({ pisoId: b.piso1, tipoEspacioId: b.tipoSala, codigo: 'S10', nombre: 'Sala 10', svgElementId: 'P1-S10', capacidad: 30, ...extra });

  describe('quién puede entrar', () => {
    const rutas: [string, string, object | null][] = [
      ['post', '/api/salas', {}],
      ['put', '/api/salas/1', {}],
      ['delete', '/api/salas/1', null],
      ['post', '/api/areas', {}],
      ['put', '/api/areas/1', {}],
      ['delete', '/api/areas/1', null],
      ['get', '/api/enrolamiento/solicitudes', null],
    ];

    it.each(rutas)('%s %s sin sesión responde 401', async (metodo, ruta, cuerpo) => {
      const peticion = (c.http() as never as Record<string, (r: string) => { send: (b: object) => Promise<{ status: number; body: { codigo: string } }> } & Promise<{ status: number; body: { codigo: string } }>>)[metodo](ruta);
      const r = await (cuerpo ? peticion.send(cuerpo) : peticion);
      expect(r.status).toBe(401);
      expect(r.body.codigo).toBe('NO_AUTENTICADO');
    });

    it('rechaza un token mal firmado', async () => {
      const falso = await new JwtService().signAsync({ sub: String(admin.usuarioId) }, { secret: 'otra-clave', expiresIn: '1h' });
      await c.http().post('/api/salas').set(auth(falso)).send(nuevaSala()).expect(401);
    });

    it('rechaza un token bien firmado pero sin sesión registrada', async () => {
      const huérfano = await new JwtService().signAsync({ sub: String(admin.usuarioId) }, { secret: JWT_SECRET_PRUEBAS, expiresIn: '1h' });
      expect((await c.http().post('/api/salas').set(auth(huérfano)).send(nuevaSala()).expect(401)).body.codigo).toBe('SESION_INVALIDA');
    });

    it('rechaza una sesión revocada (cerrar sesión) y una vencida', async () => {
      await c.prisma.sesion_admin.updateMany({ where: { token_hash: hashToken(admin.token) }, data: { revocada_en: new Date() } });
      expect((await c.http().post('/api/salas').set(auth()).send(nuevaSala()).expect(401)).body.codigo).toBe('SESION_INVALIDA');

      const otro = await crearAdmin(c.prisma, TODOS);
      await c.prisma.sesion_admin.updateMany({ where: { token_hash: hashToken(otro.token) }, data: { expira_en: new Date(Date.now() - 1000) } });
      expect((await c.http().post('/api/salas').set(auth(otro.token)).send(nuevaSala()).expect(401)).body.codigo).toBe('SESION_INVALIDA');
    });

    it('rechaza a un usuario desactivado aunque su sesión siga vigente', async () => {
      await c.prisma.usuario.update({ where: { id: admin.usuarioId }, data: { activo: false } });
      await c.http().post('/api/salas').set(auth()).send(nuevaSala()).expect(401);
    });

    it('el token de enrolamiento de una persona no abre las rutas de administración', async () => {
      const token = await new JwtService().signAsync({ sub: String(admin.usuarioId), scope: 'enrolamiento' }, { secret: claveEnrolamiento(JWT_SECRET_PRUEBAS), expiresIn: '10m' });
      await c.http().get('/api/enrolamiento/solicitudes').set(auth(token)).expect(401);
      const conClaveAdmin = await new JwtService().signAsync({ sub: String(admin.usuarioId), scope: 'enrolamiento' }, { secret: JWT_SECRET_PRUEBAS, expiresIn: '10m' });
      await c.http().get('/api/enrolamiento/solicitudes').set(auth(conClaveAdmin)).expect(401);
    });

    it('cada acción exige su permiso', async () => {
      const soloEditar = await crearAdmin(c.prisma, [PERMISOS.SALA_EDITAR]);
      expect((await c.http().post('/api/salas').set(auth(soloEditar.token)).send(nuevaSala()).expect(403)).body.codigo).toBe('SIN_PERMISO');
      await c.http().delete(`/api/salas/${b.s01}`).set(auth(soloEditar.token)).expect(403);
      await c.http().put(`/api/salas/${b.s01}`).set(auth(soloEditar.token)).send({ capacidad: 35 }).expect(200);
      await c.http().post('/api/areas').set(auth(soloEditar.token)).send({ nombre: 'X' }).expect(403);
      await c.http().get('/api/enrolamiento/solicitudes').set(auth(soloEditar.token)).expect(403);
    });

    it('"todas=true" es solo para administradores', async () => {
      expect((await c.http().get('/api/salas?todas=true').expect(401)).body.codigo).toBe('NO_AUTENTICADO');
      const r = await c.http().get('/api/salas?todas=true').set(auth()).expect(200);
      expect(r.body.total).toBe(6);
      expect(r.body.items.map((s: { codigo: string }) => s.codigo)).toContain('S99');
      const inactiva = await c.prisma.espacio.findFirstOrThrow({ where: { codigo: 'S99' } });
      await c.http().get(`/api/salas/${inactiva.id}`).set(auth()).expect(200);
    });

    it('un encabezado inválido en una ruta pública responde 401 en vez de ignorarse', async () => {
      await c.http().get('/api/salas').set({ Authorization: 'Bearer basura' }).expect(401);
    });

    it('las consultas de un administrador no cuentan como uso del tótem', async () => {
      await c.http().get('/api/salas?q=sala').set(auth()).expect(200);
      expect(await c.prisma.registro_consulta.count()).toBe(0);
    });
  });

  describe('salas', () => {
    it('crea una sala con alias y equipamiento, y de inmediato se puede buscar', async () => {
      const r = await c.http().post('/api/salas').set(auth()).send(nuevaSala({ alias: ['Auditorio chico', ' auditorio chico ', 'Sala magna'], equipamiento: [{ nombre: 'Proyector' }, { nombre: 'Pizarra', cantidad: 2, observacion: 'Blanca' }] })).expect(201);
      expect(r.body).toMatchObject({ codigo: 'S10', nombre: 'Sala 10', capacidad: 30, activo: true, svgElementId: 'P1-S10', piso: { numero: 1 }, alias: ['Auditorio chico', 'Sala magna'] });
      expect(r.body.equipamiento.map((q: { nombre: string; cantidad: number }) => [q.nombre, q.cantidad])).toEqual([['Pizarra', 2], ['Proyector', 1]]);
      const busqueda = await c.http().get('/api/salas?q=magna').expect(200);
      expect(busqueda.body.items.map((s: { codigo: string }) => s.codigo)).toEqual(['S10']);
    });

    it('deja registro de quién lo hizo', async () => {
      const r = await c.http().post('/api/salas').set(auth()).send(nuevaSala()).expect(201);
      const reg = await c.prisma.registro_auditoria.findFirstOrThrow({ where: { entidad: 'espacio', accion: 'crear' } });
      expect(reg).toMatchObject({ usuario_id: admin.usuarioId, entidad_id: String(r.body.id), detalle: { codigo: 'S10', pisoId: b.piso1 } });
    });

    it.each([
      ['código repetido en el mismo piso', { codigo: 'S01' }, 409, 'CODIGO_DUPLICADO'],
      ['código repetido sin importar mayúsculas', { codigo: 's01' }, 409, 'CODIGO_DUPLICADO'],
      ['elemento del plano ya usado', { svgElementId: 'P1-S01' }, 409, 'SVG_DUPLICADO'],
      ['piso inexistente', { pisoId: 9999 }, 422, 'PISO_INEXISTENTE'],
      ['tipo inexistente', { tipoEspacioId: 9999 }, 422, 'TIPO_INEXISTENTE'],
      ['equipamiento repetido', { equipamiento: [{ nombre: 'Mesa' }, { nombre: 'mesa' }] }, 422, 'EQUIPAMIENTO_DUPLICADO'],
      ['código vacío', { codigo: '   ' }, 400, 'VALIDACION'],
      ['código demasiado largo', { codigo: 'x'.repeat(31) }, 400, 'VALIDACION'],
      ['campo desconocido', { esAdmin: true }, 400, 'VALIDACION'],
      ['capacidad negativa', { capacidad: -1 }, 400, 'VALIDACION'],
      ['piso como texto', { pisoId: 'uno' }, 400, 'VALIDACION'],
    ])('rechaza %s', async (_n, extra, estado, codigo) => {
      const r = await c.http().post('/api/salas').set(auth()).send(nuevaSala(extra)).expect(estado);
      expect(r.body.codigo).toBe(codigo);
    });

    it('permite el mismo código en otro piso', async () => {
      await c.http().post('/api/salas').set(auth()).send(nuevaSala({ codigo: 'S01', svgElementId: 'P2-S01', pisoId: b.piso2 })).expect(201);
    });

    it('edita solo lo que se envía y reemplaza alias y equipamiento cuando se envían', async () => {
      const r = await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ capacidad: 45, nombre: null, alias: ['Sala norte'], equipamiento: [{ nombre: 'Parlantes', cantidad: 2 }] }).expect(200);
      expect(r.body).toMatchObject({ codigo: 'S01', capacidad: 45, nombre: null, svgElementId: 'P1-S01', alias: ['Sala norte'] });
      expect(r.body.equipamiento).toEqual([{ id: expect.any(Number), nombre: 'Parlantes', cantidad: 2, observacion: null }]);
      const sin = await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ capacidad: 50 }).expect(200);
      expect(sin.body.alias).toEqual(['Sala norte']);
    });

    it('mover una sala a otro piso respeta los códigos del piso destino', async () => {
      await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ pisoId: b.piso2 }).expect(200);
      expect((await c.http().put(`/api/salas/${b.s02}`).set(auth()).send({ pisoId: b.piso2, codigo: 'S01' }).expect(409)).body.codigo).toBe('CODIGO_DUPLICADO');
      await c.http().put(`/api/salas/${b.s02}`).set(auth()).send({ pisoId: b.piso2, codigo: 'S02' }).expect(200);
    });

    it('una sala puede conservar su propio código y elemento del plano al editarse', async () => {
      await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ codigo: 'S01', svgElementId: 'P1-S01', nombre: 'Sala 01 renovada' }).expect(200);
    });

    it('desactivar una sala la saca de las búsquedas', async () => {
      await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ activo: false }).expect(200);
      const r = await c.http().get('/api/salas?q=sala 01').expect(200);
      expect(r.body.items).toEqual([]);
    });

    it('editar o eliminar una sala inexistente responde 404', async () => {
      expect((await c.http().put('/api/salas/9999').set(auth()).send({ capacidad: 1 }).expect(404)).body.codigo).toBe('SALA_NO_ENCONTRADA');
      expect((await c.http().delete('/api/salas/9999').set(auth()).expect(404)).body.codigo).toBe('SALA_NO_ENCONTRADA');
    });

    it('no elimina una sala que usa un área; avisa cuál', async () => {
      const r = await c.http().delete(`/api/salas/${b.s02}`).set(auth()).expect(409);
      expect(r.body).toMatchObject({ codigo: 'SALA_EN_USO', areas: [{ id: b.areaFin, nombre: 'Financiamiento Estudiantil' }] });
      expect(await c.prisma.espacio.count({ where: { id: b.s02 } })).toBe(1);
    });

    it('no elimina una sala donde está instalado un tótem', async () => {
      await c.prisma.totem.update({ where: { id: 1 }, data: { espacio_id: b.s01 } });
      expect((await c.http().delete(`/api/salas/${b.s01}`).set(auth()).expect(409)).body).toMatchObject({ codigo: 'SALA_EN_USO', totems: 1 });
    });

    it('elimina una sala libre junto con sus alias y equipamiento, y lo registra', async () => {
      await c.http().delete(`/api/salas/${b.lab}`).set(auth()).expect(204);
      expect(await c.prisma.espacio_alias.count({ where: { espacio_id: b.lab } })).toBe(0);
      await c.http().get(`/api/salas/${b.lab}`).expect(404);
      expect((await c.http().get('/api/salas?q=LC07').expect(200)).body.items).toEqual([]);
      expect(await c.prisma.registro_auditoria.findFirst({ where: { accion: 'eliminar', entidad: 'espacio' } })).toMatchObject({ usuario_id: admin.usuarioId, entidad_id: String(b.lab) });
    });

    it('si falla algo, no queda un cambio a medias', async () => {
      // El equipamiento repetido se detecta antes de escribir; el código repetido, dentro de la transacción.
      await c.http().put(`/api/salas/${b.s01}`).set(auth()).send({ nombre: 'Cambiado', codigo: 'S02' }).expect(409);
      expect((await c.prisma.espacio.findUniqueOrThrow({ where: { id: b.s01 } })).nombre).toBe('Sala 01');
      expect(await c.prisma.registro_auditoria.count({ where: { accion: 'editar' } })).toBe(0);
    });
  });

  describe('áreas', () => {
    const nuevaArea = (extra: Record<string, unknown> = {}) => ({ nombre: 'Biblioteca', descripcion: 'Préstamo de libros.', espacioId: b.s01, horarioAtencion: 'Lunes a viernes', correoContacto: 'biblioteca@ejemplo.cl', anexo: '5678', ...extra });

    it('crea un área y aparece en el directorio y en la sala', async () => {
      const r = await c.http().post('/api/areas').set(auth()).send(nuevaArea()).expect(201);
      expect(r.body).toMatchObject({ nombre: 'Biblioteca', contacto: { correo: 'biblioteca@ejemplo.cl', anexo: '5678' }, ubicacion: { sala: { codigo: 'S01' } }, atiende: { tramites: [], carreras: [] } });
      expect((await c.http().get('/api/areas?q=biblioteca').expect(200)).body).toHaveLength(1);
      expect((await c.http().get('/api/salas?q=biblioteca').expect(200)).body.items.map((s: { codigo: string }) => s.codigo)).toEqual(['S01']);
    });

    it('acepta un área sin ubicación ni contacto', async () => {
      const r = await c.http().post('/api/areas').set(auth()).send({ nombre: 'Orientación' }).expect(201);
      expect(r.body).toMatchObject({ ubicacion: null, contacto: { correo: null, anexo: null } });
    });

    it.each([
      ['nombre repetido', { nombre: 'financiamiento estudiantil' }, 409, 'NOMBRE_DUPLICADO'],
      ['sala inexistente', { espacioId: 9999 }, 422, 'SALA_INEXISTENTE'],
      ['correo inválido', { correoContacto: 'no-es-un-correo' }, 400, 'VALIDACION'],
      ['nombre vacío', { nombre: '' }, 400, 'VALIDACION'],
      ['campo desconocido', { prioridad: 1 }, 400, 'VALIDACION'],
    ])('rechaza %s', async (_n, extra, estado, codigo) => {
      expect((await c.http().post('/api/areas').set(auth()).send(nuevaArea(extra)).expect(estado)).body.codigo).toBe(codigo);
    });

    it('edita solo lo enviado y permite quitar la ubicación', async () => {
      const r = await c.http().put(`/api/areas/${b.areaFin}`).set(auth()).send({ horarioAtencion: 'Todos los días', espacioId: null }).expect(200);
      expect(r.body).toMatchObject({ nombre: 'Financiamiento Estudiantil', horarioAtencion: 'Todos los días', ubicacion: null, contacto: { anexo: '1234' } });
      expect((await c.http().put('/api/areas/9999').set(auth()).send({ anexo: '1' }).expect(404)).body.codigo).toBe('AREA_NO_ENCONTRADA');
    });

    it('el cambio se ve de inmediato en trámites y salas', async () => {
      await c.http().get('/api/tramites').expect(200); // calienta los índices
      await c.http().put(`/api/areas/${b.areaFin}`).set(auth()).send({ nombre: 'Beneficios Estudiantiles' }).expect(200);
      expect((await c.http().get('/api/tramites?q=beneficios').expect(200)).body).toHaveLength(1);
      expect((await c.http().get('/api/salas?q=beneficios').expect(200)).body.items).toHaveLength(1);
    });

    it('no elimina un área que resuelve trámites', async () => {
      const r = await c.http().delete(`/api/areas/${b.areaFin}`).set(auth()).expect(409);
      expect(r.body).toMatchObject({ codigo: 'AREA_EN_USO', tramites: 2 });
    });

    it('elimina un área sin trámites y desvincula sus carreras', async () => {
      await c.prisma.tramite.deleteMany();
      await c.http().delete(`/api/areas/${b.areaFin}`).set(auth()).expect(204);
      expect((await c.prisma.carrera.findFirstOrThrow()).area_id).toBeNull();
      expect(await c.prisma.registro_auditoria.findFirst({ where: { accion: 'eliminar', entidad: 'area_institucional' } })).toMatchObject({ detalle: { nombre: 'Financiamiento Estudiantil', carrerasDesvinculadas: 1 } });
      await c.http().get(`/api/areas/${b.areaFin}`).expect(404);
    });
  });
});
