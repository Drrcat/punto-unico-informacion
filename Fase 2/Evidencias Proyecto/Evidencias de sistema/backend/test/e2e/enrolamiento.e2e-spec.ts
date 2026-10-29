import { existsSync, readdirSync, rmSync, utimesSync, writeFileSync } from 'fs';
import * as path from 'path';
import { PERMISOS } from '../../src/common/auth/permisos';
import { noDisponible } from '../../src/common/filtros/errores';
import { ConectoresService } from '../../src/integraciones/conector/conectores.service';
import { ErrorServicioExterno } from '../../src/integraciones/errores';
import { LimpiezaService } from '../../src/modulos/enrolamiento/limpieza.service';
import { RetencionService } from '../../src/modulos/enrolamiento/retencion.service';
import { crearAdmin, Contexto, crearApp } from '../soporte/app';
import { rostroBueno } from '../soporte/falsos';
import { sembrar, vaciar } from '../soporte/fixtures';
import { jpegFalso, pngFalso } from '../soporte/imagenes';

const CORREO = 'ana.perez@ejemplo.cl';

describe('Enrolamiento fotográfico', () => {
  let c: Contexto;

  beforeAll(async () => {
    c = await crearApp();
  });
  beforeEach(async () => {
    await vaciar(c.prisma);
    await sembrar(c.prisma);
    rmSync(c.fotosDir, { recursive: true, force: true }); // cada prueba parte sin fotografías guardadas
    c.correo.enviados = [];
    c.correo.falla = null;
    c.vision.llamadas = 0;
    c.vision.respuesta = [rostroBueno()];
    c.conector.recibidos = [];
    c.conector.falla = null;
    c.conector.esperaMs = 0;
    c.refrescar();
  });
  afterAll(() => c.cerrar());

  const fotos = () => (existsSync(c.fotosDir) ? readdirSync(c.fotosDir) : []);
  const pedirCodigo = async (correo = CORREO) => (await c.http().post('/api/enrolamiento/autenticar').send({ correo }).expect(201)).body as { intentoId: number; correo: string; expiraEn: string; vigenciaMin: number; intentosMax: number };
  const verificar = async (correo = CORREO) => {
    const { intentoId } = await pedirCodigo(correo);
    return (await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: c.correo.codigoPara(correo) }).expect(200)).body as { enrolamientoId: number; token: string; estado: string; usuario: { correo: string; nombres: string; apellidos: string } };
  };
  const enviarFoto = (v: { enrolamientoId: number; token: string }, archivo: Buffer | null = pngFalso()) => {
    const r = c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).set('Authorization', `Bearer ${v.token}`);
    return archivo ? r.attach('foto', archivo, 'foto.png') : r;
  };
  const estado = async (id: number) => (await c.prisma.enrolamiento.findUniqueOrThrow({ where: { id } })).estado;
  const codigoDeError = (r: { body: { codigo: string } }) => r.body.codigo;

  describe('estado del módulo', () => {
    it('informa los parámetros que necesita el tótem', async () => {
      const r = await c.http().get('/api/enrolamiento/estado').expect(200);
      expect(r.body).toEqual({ activo: true, dominiosAceptados: ['ejemplo.cl', 'estudiantes.ejemplo.cl'], codigoVigenciaMin: 5, codigoMaxIntentos: 3, fotoMaxIntentos: 5 });
    });

    it('con el módulo apagado solo dice que está inactivo y no deja iniciar nada', async () => {
      await c.prisma.configuracion_sistema.update({ where: { clave: 'modulo_enrolamiento_activo' }, data: { valor: 'false' } });
      c.refrescar();
      expect((await c.http().get('/api/enrolamiento/estado').expect(200)).body).toEqual({ activo: false });
      expect(codigoDeError(await c.http().post('/api/enrolamiento/autenticar').send({ correo: CORREO }).expect(403))).toBe('MODULO_INACTIVO');
      expect(c.correo.enviados).toHaveLength(0);
    });
  });

  describe('verificación del correo', () => {
    it('envía un código de 6 dígitos y guarda solo su hash', async () => {
      const r = await pedirCodigo();
      expect(r).toMatchObject({ correo: 'a***@ejemplo.cl', vigenciaMin: 5, intentosMax: 3 });
      expect(r).not.toHaveProperty('codigo');
      expect(c.correo.enviados).toHaveLength(1);
      expect(c.correo.enviados[0]).toMatchObject({ para: CORREO, vigenciaMin: 5, institucion: 'Institución de Prueba' });
      const codigo = c.correo.codigoPara(CORREO);
      expect(codigo).toMatch(/^[0-9]{6}$/);
      const fila = await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: r.intentoId } });
      expect(fila.codigo_hash).not.toContain(codigo);
      expect(fila).toMatchObject({ estado: 'PENDIENTE', intentos_fallidos: 0, totem_id: 1, correo_ingresado: CORREO });
      expect(Math.round((fila.expira_en.getTime() - fila.solicitado_en.getTime()) / 60_000)).toBe(5);
    });

    it('acepta el correo con mayúsculas y espacios', async () => {
      await c.http().post('/api/enrolamiento/autenticar').send({ correo: '  ANA.Perez@Ejemplo.CL ' }).expect(201);
      expect(c.correo.enviados[0].para).toBe(CORREO);
    });

    it('rechaza dominios no aceptados, informando cuáles sirven, y no envía nada', async () => {
      const r = await c.http().post('/api/enrolamiento/autenticar').send({ correo: 'ana@gmail.com' }).expect(422);
      expect(r.body).toMatchObject({ codigo: 'DOMINIO_NO_PERMITIDO', dominiosAceptados: ['ejemplo.cl', 'estudiantes.ejemplo.cl'] });
      expect(c.correo.enviados).toHaveLength(0);
      await c.http().post('/api/enrolamiento/autenticar').send({ correo: 'ana@falso-ejemplo.cl' }).expect(422);
      await c.http().post('/api/enrolamiento/autenticar').send({ correo: 'ana@sub.ejemplo.cl' }).expect(422);
    });

    it('valida el formato del correo', async () => {
      for (const correo of ['', 'sin-arroba', 'a@', undefined, 123]) {
        expect(codigoDeError(await c.http().post('/api/enrolamiento/autenticar').send({ correo }).expect(400))).toBe('VALIDACION');
      }
    });

    it('un código nuevo anula el anterior', async () => {
      const primero = await pedirCodigo();
      const viejo = c.correo.codigoPara(CORREO);
      await pedirCodigo();
      expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: primero.intentoId } })).estado).toBe('EXPIRADA');
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${primero.intentoId}/codigo`).send({ codigo: viejo }).expect(410))).toBe('CODIGO_EXPIRADO');
    });

    it('limita cuántos códigos se pueden pedir para un mismo correo', async () => {
      await pedirCodigo();
      await pedirCodigo();
      await pedirCodigo();
      const r = await c.http().post('/api/enrolamiento/autenticar').send({ correo: CORREO }).expect(429);
      expect(r.body.codigo).toBe('DEMASIADAS_SOLICITUDES');
      expect(r.body.reintentarEnSeg).toBeGreaterThan(0);
      expect(c.correo.enviados).toHaveLength(3);
      await pedirCodigo('otra@ejemplo.cl'); // otro correo no se ve afectado
    });

    it('si el correo no se puede enviar, lo registra, avisa y no gasta el cupo', async () => {
      c.correo.falla = new ErrorServicioExterno('El servicio de correo respondió 503. Sin servicio', 503);
      const r = await c.http().post('/api/enrolamiento/autenticar').send({ correo: CORREO }).expect(503);
      expect(r.body.codigo).toBe('CORREO_NO_DISPONIBLE');
      expect(await c.prisma.registro_error.findFirstOrThrow()).toMatchObject({ servicio: 'CORREO', operacion: 'enviar_codigo', codigo_http: 503, totem_id: 1 });
      expect(await c.prisma.intento_autenticacion.count()).toBe(0);
      c.correo.falla = null;
      await pedirCodigo();
    });

    it('la falla del correo no deja de lado al resto del sistema', async () => {
      c.correo.falla = new Error('caído');
      await c.http().post('/api/enrolamiento/autenticar').send({ correo: CORREO }).expect(503);
      await c.http().get('/api/salas').expect(200);
      await c.http().get('/api/areas').expect(200);
      await c.http().get('/api/tramites').expect(200);
    });

    it('el mensaje de error del proveedor no queda guardado con datos personales', async () => {
      c.correo.falla = new ErrorServicioExterno(`No se pudo enviar a ${CORREO}`, 422);
      await c.http().post('/api/enrolamiento/autenticar').send({ correo: CORREO }).expect(503);
      expect((await c.prisma.registro_error.findFirstOrThrow()).mensaje).not.toContain('ana.perez');
    });
  });

  describe('validación del código', () => {
    it('con el código correcto crea al usuario y la solicitud en "foto pendiente" y entrega un token', async () => {
      const v = await verificar();
      expect(v).toMatchObject({ estado: 'FOTO_PENDIENTE', usuario: { correo: CORREO, nombres: 'Ana', apellidos: 'Perez' } });
      expect(typeof v.token).toBe('string');
      const enr = await c.prisma.enrolamiento.findUniqueOrThrow({ where: { id: v.enrolamientoId }, include: { intento: true, usuario: true } });
      expect(enr).toMatchObject({ estado: 'FOTO_PENDIENTE', totem_id: 1, completado_en: null });
      expect(enr.intento).toMatchObject({ estado: 'VERIFICADA', usuario_id: enr.usuario_id });
      expect(enr.intento.resuelto_en).not.toBeNull();
      expect(enr.usuario).toMatchObject({ correo: CORREO, clave_hash: null, activo: true });
    });

    it('reutiliza al usuario si ya existía', async () => {
      const previo = await c.prisma.usuario.create({ data: { correo: CORREO, nombres: 'Ana María', apellidos: 'Pérez Soto' } });
      const v = await verificar();
      expect(v.usuario).toMatchObject({ nombres: 'Ana María', apellidos: 'Pérez Soto' });
      expect(await c.prisma.usuario.count({ where: { correo: CORREO } })).toBe(1);
      expect((await c.prisma.enrolamiento.findUniqueOrThrow({ where: { id: v.enrolamientoId } })).usuario_id).toBe(previo.id);
    });

    it('rechaza a un usuario desactivado sin gastar la verificación', async () => {
      await c.prisma.usuario.create({ data: { correo: CORREO, nombres: 'Ana', apellidos: 'Pérez', activo: false } });
      const { intentoId } = await pedirCodigo();
      const r = await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: c.correo.codigoPara(CORREO) }).expect(403);
      expect(r.body.codigo).toBe('USUARIO_INACTIVO');
      expect(await c.prisma.enrolamiento.count()).toBe(0);
      expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } })).estado).toBe('PENDIENTE');
    });

    it('un código incorrecto suma un intento fallido e informa cuántos quedan', async () => {
      const { intentoId } = await pedirCodigo();
      const correcto = c.correo.codigoPara(CORREO);
      const malo = correcto === '000000' ? '111111' : '000000';
      const r = await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: malo }).expect(401);
      expect(r.body).toMatchObject({ codigo: 'CODIGO_INCORRECTO', intentosRestantes: 2 });
      expect((await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: malo }).expect(401)).body.intentosRestantes).toBe(1);
      // El código correcto sigue sirviendo mientras queden intentos.
      await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: correcto }).expect(200);
    });

    it('al agotar los intentos el intento queda rechazado, incluso con el código correcto', async () => {
      const { intentoId } = await pedirCodigo();
      const correcto = c.correo.codigoPara(CORREO);
      const malo = correcto === '000000' ? '111111' : '000000';
      await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: malo }).expect(401);
      await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: malo }).expect(401);
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: malo }).expect(429))).toBe('INTENTOS_AGOTADOS');
      const fila = await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } });
      expect(fila).toMatchObject({ estado: 'RECHAZADA', intentos_fallidos: 3 });
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: correcto }).expect(429))).toBe('INTENTOS_AGOTADOS');
      expect(await c.prisma.enrolamiento.count()).toBe(0);
    });

    it('probar muchos códigos a la vez no permite pasar de los intentos permitidos', async () => {
      const { intentoId } = await pedirCodigo();
      const correcto = c.correo.codigoPara(CORREO);
      const candidatos = Array.from({ length: 12 }, (_, i) => String(i).padStart(6, '0')).filter((x) => x !== correcto);
      const rs = await Promise.all(candidatos.map((codigo) => c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo })));
      expect(rs.every((r) => [401, 429].includes(r.status))).toBe(true);
      const fila = await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } });
      expect(fila.intentos_fallidos).toBe(3);
      expect(fila.estado).toBe('RECHAZADA');
    });

    it('un código vencido se marca como expirado', async () => {
      const { intentoId } = await pedirCodigo();
      await c.prisma.intento_autenticacion.update({ where: { id: intentoId }, data: { expira_en: new Date(Date.now() - 1000) } });
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo: c.correo.codigoPara(CORREO) }).expect(410))).toBe('CODIGO_EXPIRADO');
      expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } })).estado).toBe('EXPIRADA');
    });

    it('un código solo se puede usar una vez, ni siquiera dos veces a la vez', async () => {
      const { intentoId } = await pedirCodigo();
      const codigo = c.correo.codigoPara(CORREO);
      const rs = await Promise.all([1, 2, 3, 4].map(() => c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo })));
      expect(rs.filter((r) => r.status === 200)).toHaveLength(1);
      expect(rs.filter((r) => r.status === 409)).toHaveLength(3);
      expect(await c.prisma.enrolamiento.count()).toBe(1);
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo }).expect(409))).toBe('CODIGO_YA_USADO');
    });

    it('valida el formato del código y la existencia de la verificación', async () => {
      const { intentoId } = await pedirCodigo();
      for (const codigo of ['12345', '1234567', 'abcdef', '12 345', 123456, undefined]) {
        expect(codigoDeError(await c.http().post(`/api/enrolamiento/autenticar/${intentoId}/codigo`).send({ codigo }).expect(400))).toBe('VALIDACION');
      }
      expect(codigoDeError(await c.http().post('/api/enrolamiento/autenticar/9999/codigo').send({ codigo: '123456' }).expect(404))).toBe('VERIFICACION_NO_ENCONTRADA');
      expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } })).intentos_fallidos).toBe(0);
    });

    it('una nueva verificación cancela la solicitud anterior sin terminar y borra su foto', async () => {
      const a = await verificar();
      await c.prisma.captura_facial.create({ data: { enrolamiento_id: a.enrolamientoId, rostro_valido: false, motivo_rechazo: 'ERROR_VISION', ruta_imagen: 'enr-x.png' } });
      const b = await verificar();
      expect(await estado(a.enrolamientoId)).toBe('CANCELADO');
      expect(await estado(b.enrolamientoId)).toBe('FOTO_PENDIENTE');
      expect((await c.prisma.captura_facial.findFirstOrThrow()).ruta_imagen).toBeNull();
    });
  });

  describe('fotografía', () => {
    it('camino feliz: valida, envía al conector, elimina la imagen y completa la solicitud', async () => {
      const v = await verificar();
      const r = await enviarFoto(v).expect(200);
      expect(r.body).toMatchObject({ enrolamientoId: v.enrolamientoId, estado: 'COMPLETADO' });

      expect(c.vision.llamadas).toBe(1);
      expect(c.conector.recibidos).toHaveLength(1);
      expect(c.conector.recibidos[0]).toMatchObject({ enrolamientoId: v.enrolamientoId, usuario: { correo: CORREO, nombres: 'Ana', apellidos: 'Perez' }, existiaArchivo: true });
      expect(fotos()).toEqual([]); // la imagen se eliminó
      expect(await c.prisma.enrolamiento.findUniqueOrThrow({ where: { id: v.enrolamientoId } })).toMatchObject({ estado: 'COMPLETADO' });
      const captura = await c.prisma.captura_facial.findFirstOrThrow();
      expect(captura).toMatchObject({ rostro_valido: true, ruta_imagen: null, motivo_rechazo: null });
      expect(Number(captura.confianza)).toBeCloseTo(0.97);
      expect(captura.eliminada_en).not.toBeNull();
      expect((await c.prisma.enrolamiento.findUniqueOrThrow({ where: { id: v.enrolamientoId } })).completado_en).not.toBeNull();
    });

    it('acepta JPEG', async () => {
      const v = await verificar();
      await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).set('Authorization', `Bearer ${v.token}`).attach('foto', jpegFalso(), 'foto.jpg').expect(200);
    });

    it('una solicitud completada no se puede repetir', async () => {
      const v = await verificar();
      await enviarFoto(v).expect(200);
      expect(codigoDeError(await enviarFoto(v).expect(409))).toBe('ENROLAMIENTO_FINALIZADO');
      expect(c.conector.recibidos).toHaveLength(1);
    });

    describe('seguridad', () => {
      it('exige el token de la verificación', async () => {
        const v = await verificar();
        expect(codigoDeError(await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).attach('foto', pngFalso(), 'f.png').expect(401))).toBe('NO_AUTENTICADO');
        expect(codigoDeError(await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).set('Authorization', 'Bearer x.y.z').attach('foto', pngFalso(), 'f.png').expect(401))).toBe('TOKEN_INVALIDO');
        expect(c.vision.llamadas).toBe(0);
      });

      it('el token sirve solo para su propia solicitud', async () => {
        const ana = await verificar();
        const luis = await verificar('luis.soto@ejemplo.cl');
        const r = await c.http().post(`/api/enrolamiento/${luis.enrolamientoId}/foto`).set('Authorization', `Bearer ${ana.token}`).attach('foto', pngFalso(), 'f.png').expect(403);
        expect(r.body.codigo).toBe('ENROLAMIENTO_AJENO');
        await c.http().post(`/api/enrolamiento/${luis.enrolamientoId}/cancelar`).set('Authorization', `Bearer ${ana.token}`).expect(403);
        expect(await estado(luis.enrolamientoId)).toBe('FOTO_PENDIENTE');
      });

      it('un token de administrador no sirve para enviar fotos', async () => {
        const v = await verificar();
        const admin = await crearAdmin(c.prisma, Object.values(PERMISOS));
        await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).set('Authorization', `Bearer ${admin.token}`).attach('foto', pngFalso(), 'f.png').expect(401);
      });

      it('el token vence', async () => {
        await c.prisma.configuracion_sistema.create({ data: { clave: 'enrolamiento_vigencia_min', valor: '-1' } });
        c.refrescar();
        const v = await verificar();
        expect(codigoDeError(await enviarFoto(v).expect(401))).toBe('TOKEN_EXPIRADO');
      });
    });

    describe('archivos inválidos', () => {
      it('exige la fotografía', async () => {
        const v = await verificar();
        expect(codigoDeError(await enviarFoto(v, null).expect(400))).toBe('FOTO_REQUERIDA');
      });

      it.each([
        ['un texto con extensión de imagen', Buffer.from('esto no es una imagen')],
        ['un GIF', Buffer.from('GIF89a' + 'x'.repeat(40))],
        ['un PNG cortado', pngFalso().subarray(0, 18)],
        ['un script', Buffer.from('<?php system($_GET["c"]); ?>')],
      ])('rechaza %s', async (_n, archivo) => {
        const v = await verificar();
        expect(codigoDeError(await enviarFoto(v, archivo).expect(422))).toBe('IMAGEN_INVALIDA');
        expect(c.vision.llamadas).toBe(0);
        expect(fotos()).toEqual([]);
        expect(await estado(v.enrolamientoId)).toBe('FOTO_PENDIENTE');
      });

      it('rechaza archivos de más de 5 MB', async () => {
        const v = await verificar();
        const grande = Buffer.concat([pngFalso(), Buffer.alloc(5 * 1024 * 1024)]);
        expect(codigoDeError(await enviarFoto(v, grande).expect(413))).toBe('ARCHIVO_MUY_GRANDE');
        expect(c.vision.llamadas).toBe(0);
      });

      it('rechaza un campo de archivo con otro nombre', async () => {
        const v = await verificar();
        const r = await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/foto`).set('Authorization', `Bearer ${v.token}`).attach('imagen', pngFalso(), 'f.png');
        expect(r.status).toBeGreaterThanOrEqual(400);
        expect(c.vision.llamadas).toBe(0);
      });
    });

    describe('foto rechazada por Vision AI', () => {
      it.each([
        ['sin rostro', [], 'SIN_ROSTRO'],
        ['más de una persona', [rostroBueno(), rostroBueno()], 'VARIOS_ROSTROS'],
        ['con poca luz', [{ ...rostroBueno(), subexpuesta: 'VERY_LIKELY' as const }], 'POCA_LUZ'],
      ])('%s: nunca se guarda ni se envía, y se registra el motivo', async (_n, rostros, motivo) => {
        c.vision.respuesta = rostros;
        const v = await verificar();
        const r = await enviarFoto(v).expect(422);
        expect(r.body).toMatchObject({ codigo: 'FOTO_RECHAZADA', motivo, intentosRestantes: 4 });
        expect(r.body.mensaje.length).toBeGreaterThan(10);
        expect(fotos()).toEqual([]);
        expect(c.conector.recibidos).toHaveLength(0);
        expect(await estado(v.enrolamientoId)).toBe('FOTO_PENDIENTE');
        expect(await c.prisma.captura_facial.findFirstOrThrow()).toMatchObject({ rostro_valido: false, motivo_rechazo: motivo, ruta_imagen: null });
      });

      it('la persona puede volver a intentar y completar', async () => {
        const v = await verificar();
        c.vision.respuesta = [];
        await enviarFoto(v).expect(422);
        c.vision.respuesta = [rostroBueno()];
        await enviarFoto(v).expect(200);
        expect(await c.prisma.captura_facial.count()).toBe(2);
        expect(await estado(v.enrolamientoId)).toBe('COMPLETADO');
      });

      it('tras el máximo de rechazos hay que empezar de nuevo', async () => {
        const v = await verificar();
        c.vision.respuesta = [];
        for (let i = 4; i >= 1; i--) expect((await enviarFoto(v).expect(422)).body.intentosRestantes).toBe(i);
        const ultima = await enviarFoto(v).expect(422);
        expect(ultima.body.intentosRestantes).toBe(0);
        expect(ultima.body.mensaje).toContain('vuelve a empezar');
        expect(await estado(v.enrolamientoId)).toBe('FALLIDO');
        c.vision.respuesta = [rostroBueno()];
        expect(codigoDeError(await enviarFoto(v).expect(409))).toBe('ENROLAMIENTO_FINALIZADO');
        expect(c.conector.recibidos).toHaveLength(0);
      });
    });

    describe('fallas de los servicios externos', () => {
      it('si Vision AI no responde: registra el error, marca la solicitud como fallida y conserva la copia para reintentar', async () => {
        c.vision.respuesta = new ErrorServicioExterno('Google Vision AI no pudo analizar la imagen: UNAVAILABLE', 503);
        const v = await verificar();
        const r = await enviarFoto(v).expect(503);
        expect(r.body).toMatchObject({ codigo: 'VISION_NO_DISPONIBLE', puedeReintentar: true });
        expect(await estado(v.enrolamientoId)).toBe('FALLIDO');
        expect(fotos()).toHaveLength(1);
        expect(await c.prisma.registro_error.findFirstOrThrow()).toMatchObject({ servicio: 'GOOGLE_VISION', operacion: 'validar_foto', codigo_http: 503, enrolamiento_id: v.enrolamientoId });
        expect(c.conector.recibidos).toHaveLength(0);

        // Reintento sin volver a tomar la foto: usa la copia conservada.
        c.vision.respuesta = [rostroBueno()];
        const ok = await enviarFoto(v, null).expect(200);
        expect(ok.body.estado).toBe('COMPLETADO');
        expect(c.conector.recibidos[0].existiaArchivo).toBe(true);
        expect(fotos()).toEqual([]);
        expect(await c.prisma.captura_facial.count()).toBe(1);
      });

      it('si el reintento muestra que la foto no sirve, se borra', async () => {
        c.vision.respuesta = new ErrorServicioExterno('caído');
        const v = await verificar();
        await enviarFoto(v).expect(503);
        c.vision.respuesta = [];
        expect(codigoDeError(await enviarFoto(v, null).expect(422))).toBe('FOTO_RECHAZADA');
        expect(fotos()).toEqual([]);
        expect(await estado(v.enrolamientoId)).toBe('FOTO_PENDIENTE');
      });

      it('si el sistema de enrolamiento falla: error registrado, solicitud fallida, copia conservada y reintento posible', async () => {
        c.conector.falla = new ErrorServicioExterno('Falló la automatización: tiempo agotado');
        const v = await verificar();
        const r = await enviarFoto(v).expect(502);
        expect(r.body).toMatchObject({ codigo: 'ENROLAMIENTO_NO_DISPONIBLE', puedeReintentar: true });
        expect(await estado(v.enrolamientoId)).toBe('FALLIDO');
        expect(fotos()).toHaveLength(1);
        expect(await c.prisma.registro_error.findFirstOrThrow()).toMatchObject({ servicio: 'ENROLAMIENTO', operacion: 'enviar_enrolamiento', enrolamiento_id: v.enrolamientoId });
        expect(await c.prisma.captura_facial.findFirstOrThrow()).toMatchObject({ rostro_valido: true });

        c.conector.falla = null;
        const visionAntes = c.vision.llamadas;
        await enviarFoto(v, null).expect(200);
        expect(c.vision.llamadas).toBe(visionAntes); // la foto ya estaba validada: no se vuelve a pagar a Vision
        expect(c.conector.recibidos).toHaveLength(2);
        expect(fotos()).toEqual([]);
        expect(await estado(v.enrolamientoId)).toBe('COMPLETADO');
      });

      it('si el sistema de enrolamiento rechaza la solicitud de forma definitiva, borra la foto y no ofrece reintento', async () => {
        c.conector.falla = new ErrorServicioExterno('Click Visitas rechazó el registro: la persona ya existe', undefined, false, 'Ya estás registrado. Acércate a la oficina de atención.');
        const v = await verificar();
        const r = await enviarFoto(v).expect(422);
        expect(r.body).toMatchObject({ codigo: 'ENROLAMIENTO_RECHAZADO', mensaje: 'Ya estás registrado. Acércate a la oficina de atención.' });
        expect(fotos()).toEqual([]);
        expect(await estado(v.enrolamientoId)).toBe('FALLIDO');
        expect(codigoDeError(await enviarFoto(v, null).expect(409))).toBe('ENROLAMIENTO_FINALIZADO');
      });

      it('una foto nueva reemplaza a la conservada', async () => {
        c.conector.falla = new ErrorServicioExterno('caído');
        const v = await verificar();
        await enviarFoto(v).expect(502);
        const [antes] = fotos();
        c.conector.falla = null;
        await enviarFoto(v, jpegFalso()).expect(200);
        expect(fotos()).toEqual([]);
        expect(antes).toBeDefined();
        expect(c.vision.llamadas).toBe(2);
      });

      it('sin conector configurado avisa antes de analizar ni guardar nada', async () => {
        const v = await verificar();
        const original = c.app.get(ConectoresService);
        jest.spyOn(original, 'obtener').mockRejectedValueOnce(noDisponible('SIN_CONECTOR', 'sin destino'));
        expect(codigoDeError(await enviarFoto(v).expect(503))).toBe('SIN_CONECTOR');
        expect(c.vision.llamadas).toBe(0);
        expect(fotos()).toEqual([]);
        expect(await estado(v.enrolamientoId)).toBe('FOTO_PENDIENTE');
      });
    });

    it('no procesa dos veces la misma solicitud a la vez', async () => {
      c.conector.esperaMs = 300;
      const v = await verificar();
      const [a, b] = await Promise.all([enviarFoto(v), (async () => { await new Promise((r) => setTimeout(r, 50)); return enviarFoto(v); })()]);
      expect([a.status, b.status].sort()).toEqual([200, 409]);
      expect(c.conector.recibidos).toHaveLength(1);
    });
  });

  describe('cancelación y limpieza', () => {
    it('cancelar elimina la foto pendiente y deja la solicitud cancelada', async () => {
      c.conector.falla = new ErrorServicioExterno('caído');
      const v = await verificar();
      await enviarFoto(v).expect(502);
      expect(fotos()).toHaveLength(1);
      const r = await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/cancelar`).set('Authorization', `Bearer ${v.token}`).expect(200);
      expect(r.body).toEqual({ enrolamientoId: v.enrolamientoId, estado: 'CANCELADO' });
      expect(fotos()).toEqual([]);
      expect(await c.prisma.captura_facial.findFirstOrThrow()).toMatchObject({ ruta_imagen: null });
      expect(codigoDeError(await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/cancelar`).set('Authorization', `Bearer ${v.token}`).expect(409))).toBe('TRANSICION_INVALIDA');
      expect(codigoDeError(await enviarFoto(v).expect(409))).toBe('ENROLAMIENTO_FINALIZADO');
    });

    it('no se puede cancelar una solicitud completada', async () => {
      const v = await verificar();
      await enviarFoto(v).expect(200);
      await c.http().post(`/api/enrolamiento/${v.enrolamientoId}/cancelar`).set('Authorization', `Bearer ${v.token}`).expect(409);
      expect(await estado(v.enrolamientoId)).toBe('COMPLETADO');
    });

    describe('tareas periódicas', () => {
      const limpieza = () => c.app.get(LimpiezaService);
      const retencion = () => c.app.get(RetencionService);

      it('elimina las copias que superan el plazo de retención y deja las recientes', async () => {
        c.conector.falla = new ErrorServicioExterno('caído');
        const viejo = await verificar();
        await enviarFoto(viejo).expect(502);
        const reciente = await verificar('luis.soto@ejemplo.cl');
        await enviarFoto(reciente).expect(502);
        expect(fotos()).toHaveLength(2);

        await c.prisma.captura_facial.updateMany({ where: { enrolamiento_id: viejo.enrolamientoId }, data: { capturada_en: new Date(Date.now() - 25 * 3_600_000) } });
        expect(await retencion().purgarVencidas()).toBe(1);
        expect(fotos()).toHaveLength(1);
        const capturas = await c.prisma.captura_facial.findMany({ orderBy: { id: 'asc' } });
        expect(capturas[0]).toMatchObject({ ruta_imagen: null });
        expect(capturas[0].eliminada_en).not.toBeNull();
        expect(capturas[1].ruta_imagen).not.toBeNull();
      });

      it('respeta el plazo configurado', async () => {
        c.conector.falla = new ErrorServicioExterno('caído');
        const v = await verificar();
        await enviarFoto(v).expect(502);
        await c.prisma.captura_facial.updateMany({ data: { capturada_en: new Date(Date.now() - 2 * 3_600_000) } });
        expect(await retencion().purgarVencidas()).toBe(0);
        await c.prisma.configuracion_sistema.create({ data: { clave: 'foto_retencion_horas', valor: '1' } });
        c.refrescar();
        expect(await retencion().purgarVencidas()).toBe(1);
        expect(fotos()).toEqual([]);
      });

      it('elimina archivos sin registro que superan el plazo', async () => {
        c.conector.falla = new ErrorServicioExterno('caído');
        const v = await verificar();
        await enviarFoto(v).expect(502);
        const huerfano = path.join(c.fotosDir, 'enr-99-abandonado.png');
        writeFileSync(huerfano, pngFalso());
        const hace2dias = new Date(Date.now() - 2 * 86_400_000);
        utimesSync(huerfano, hace2dias, hace2dias);
        const registrado = path.join(c.fotosDir, (await c.prisma.captura_facial.findFirstOrThrow()).ruta_imagen as string);
        utimesSync(registrado, hace2dias, hace2dias);
        expect(await retencion().purgarHuerfanas()).toBe(1);
        expect(existsSync(huerfano)).toBe(false);
        expect(existsSync(registrado)).toBe(true); // tiene registro: lo maneja la purga por fecha de captura
      });

      it('cancela las solicitudes que la persona abandonó y borra su foto', async () => {
        c.conector.falla = new ErrorServicioExterno('caído');
        const abandonada = await verificar();
        await enviarFoto(abandonada).expect(502);
        await c.http().post('/api/enrolamiento/autenticar').send({ correo: 'luis.soto@ejemplo.cl' }).expect(201);
        const vigente = await verificar('luis.soto@ejemplo.cl');
        await c.prisma.enrolamiento.update({ where: { id: abandonada.enrolamientoId }, data: { iniciado_en: new Date(Date.now() - 60 * 60_000), estado: 'FOTO_PENDIENTE' } });
        expect(await limpieza().cancelarAbandonadas()).toBe(1);
        expect(await estado(abandonada.enrolamientoId)).toBe('CANCELADO');
        expect(await estado(vigente.enrolamientoId)).toBe('FOTO_PENDIENTE');
        expect(fotos()).toEqual([]);
      });

      it('marca como expirados los códigos que nadie usó', async () => {
        const { intentoId } = await pedirCodigo();
        const vigente = await pedirCodigo('luis.soto@ejemplo.cl');
        await c.prisma.intento_autenticacion.update({ where: { id: intentoId }, data: { expira_en: new Date(Date.now() - 1000) } });
        expect(await limpieza().expirarCodigos()).toBe(1);
        expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: intentoId } })).estado).toBe('EXPIRADA');
        expect((await c.prisma.intento_autenticacion.findUniqueOrThrow({ where: { id: vigente.intentoId } })).estado).toBe('PENDIENTE');
      });

      it('una tarea que falla no impide las demás', async () => {
        jest.spyOn(limpieza(), 'expirarCodigos').mockRejectedValueOnce(new Error('base caída'));
        const purga = jest.spyOn(retencion(), 'purgarVencidas');
        await limpieza().ejecutar();
        expect(purga).toHaveBeenCalled();
      });
    });
  });

  describe('consulta para el panel administrativo', () => {
    it('lista las solicitudes con su estado, los códigos fallidos y el resultado de la foto, sin la imagen', async () => {
      const ok = await verificar(); // completada
      await enviarFoto(ok).expect(200);

      c.vision.respuesta = [];
      const rechazada = await verificar('luis.soto@ejemplo.cl');
      await enviarFoto(rechazada).expect(422);

      const { intentoId: agotado } = await pedirCodigo('eva.diaz@ejemplo.cl');
      for (let i = 0; i < 3; i++) await c.http().post(`/api/enrolamiento/autenticar/${agotado}/codigo`).send({ codigo: '999999' });
      await pedirCodigo('sin.terminar@ejemplo.cl');

      const admin = await crearAdmin(c.prisma, [PERMISOS.ENROLAMIENTO_VER]);
      const r = await c.http().get('/api/enrolamiento/solicitudes').set('Authorization', `Bearer ${admin.token}`).expect(200);
      expect(r.body.total).toBe(4);
      const porCorreo = Object.fromEntries(r.body.items.map((i: { correo: string }) => [i.correo, i]));

      expect(porCorreo[CORREO]).toMatchObject({ estado: 'COMPLETADO', totem: 'Tótem de prueba', verificacion: { estado: 'VERIFICADA', codigosFallidos: 0 }, enrolamiento: { id: ok.enrolamientoId, estado: 'COMPLETADO' } });
      expect(porCorreo[CORREO].enrolamiento.capturas).toEqual([{ capturadaEn: expect.any(String), rostroValido: true, confianza: 0.97, motivoRechazo: null, imagenEliminadaEn: expect.any(String) }]);
      expect(porCorreo['luis.soto@ejemplo.cl']).toMatchObject({ estado: 'FOTO_PENDIENTE', enrolamiento: { capturas: [{ rostroValido: false, motivoRechazo: 'SIN_ROSTRO' }] } });
      expect(porCorreo['eva.diaz@ejemplo.cl']).toMatchObject({ estado: 'VERIFICACION_RECHAZADA', verificacion: { estado: 'RECHAZADA', codigosFallidos: 3 }, enrolamiento: null });
      expect(porCorreo['sin.terminar@ejemplo.cl']).toMatchObject({ estado: 'VERIFICACION_PENDIENTE' });
      expect(JSON.stringify(r.body)).not.toMatch(/ruta_imagen|enr-\d+-|codigo_hash|clave_hash|token/);
      // Orden: la más reciente primero.
      expect(r.body.items[0].correo).toBe('sin.terminar@ejemplo.cl');
    });

    it('filtra por estado, correo y fechas, y pagina', async () => {
      const v1 = await verificar();
      await enviarFoto(v1).expect(200);
      await verificar('luis.soto@ejemplo.cl');
      await pedirCodigo('eva.diaz@ejemplo.cl');
      const admin = await crearAdmin(c.prisma, [PERMISOS.ENROLAMIENTO_VER]);
      const pedir = (q: string) => c.http().get(`/api/enrolamiento/solicitudes${q}`).set('Authorization', `Bearer ${admin.token}`);
      const correos = (r: { body: { items: { correo: string }[] } }) => r.body.items.map((i) => i.correo);

      expect(correos(await pedir('?estado=COMPLETADO').expect(200))).toEqual([CORREO]);
      expect(correos(await pedir('?estado=FOTO_PENDIENTE').expect(200))).toEqual(['luis.soto@ejemplo.cl']);
      expect(correos(await pedir('?estado=VERIFICACION_PENDIENTE').expect(200))).toEqual(['eva.diaz@ejemplo.cl']);
      expect(correos(await pedir('?estado=VERIFICACION_EXPIRADA').expect(200))).toEqual([]);
      expect(correos(await pedir('?correo=LUIS').expect(200))).toEqual(['luis.soto@ejemplo.cl']);
      expect(correos(await pedir('?desde=2999-01-01').expect(200))).toEqual([]);
      expect((await pedir('?hasta=2999-01-01').expect(200)).body.total).toBe(3);
      const p = await pedir('?limite=2&desplazamiento=2').expect(200);
      expect(p.body.total).toBe(3);
      expect(p.body.items).toHaveLength(1);

      await c.prisma.intento_autenticacion.updateMany({ where: { correo_ingresado: 'eva.diaz@ejemplo.cl' }, data: { expira_en: new Date(Date.now() - 1000) } });
      expect(correos(await pedir('?estado=VERIFICACION_EXPIRADA').expect(200))).toEqual(['eva.diaz@ejemplo.cl']);
      expect(correos(await pedir('?estado=VERIFICACION_PENDIENTE').expect(200))).toEqual([]);
    });

    it('valida los filtros', async () => {
      const admin = await crearAdmin(c.prisma, [PERMISOS.ENROLAMIENTO_VER]);
      const pedir = (q: string) => c.http().get(`/api/enrolamiento/solicitudes${q}`).set('Authorization', `Bearer ${admin.token}`);
      expect((await pedir('?estado=OTRO').expect(400)).body.codigo).toBe('VALIDACION');
      expect((await pedir('?limite=1000').expect(400)).body.codigo).toBe('VALIDACION');
      expect((await pedir('?desde=ayer').expect(400)).body.codigo).toBe('VALIDACION');
    });
  });
});
