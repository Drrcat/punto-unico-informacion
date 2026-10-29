import { existsSync, mkdtempSync, readdirSync, rmSync, statSync, utimesSync, writeFileSync } from 'fs';
import { tmpdir } from 'os';
import * as path from 'path';
import { sanearMensaje } from '../../src/common/registro/error-externo.service';
import { Entorno } from '../../src/config/entorno';
import { ConectorClickVisitas, selectoresPendientes, SELECTORES } from '../../src/integraciones/conector/click-visitas.conector';
import { ErrorServicioExterno } from '../../src/integraciones/errores';
import { FotosStore } from '../../src/modulos/enrolamiento/fotos.store';
import { pngFalso } from '../soporte/imagenes';

describe('sanearMensaje', () => {
  it('oculta correos y claves antes de guardar el error', () => {
    const m = sanearMensaje('Falló para ana.perez@ejemplo.cl con Bearer abc123 y clave=secreta');
    expect(m).not.toMatch(/ana\.perez|abc123|secreta/);
    expect(m).toContain('[correo]');
  });
  it('limita el largo a lo que cabe en la columna', () => {
    expect(sanearMensaje('x'.repeat(1000))).toHaveLength(300);
  });
});

describe('FotosStore', () => {
  let dir: string;
  let store: FotosStore;
  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'fotos-'));
    store = new FotosStore({ fotosDir: dir } as Entorno);
  });
  afterEach(() => rmSync(dir, { recursive: true, force: true }));

  it('guarda con permisos solo para el propietario y nombre impredecible', async () => {
    const a = await store.guardar(5, pngFalso(), 'png');
    const b = await store.guardar(5, pngFalso(), 'png');
    expect(a).toMatch(/^enr-5-[0-9a-f]{16}\.png$/);
    expect(a).not.toBe(b);
    expect(statSync(store.ruta(a)).mode & 0o777).toBe(0o600);
  });
  it('lee lo guardado y devuelve null si no existe', async () => {
    const n = await store.guardar(1, pngFalso(), 'png');
    expect((await store.leer(n))?.equals(pngFalso())).toBe(true);
    expect(await store.leer('enr-9-inexistente.png')).toBeNull();
  });
  it('eliminar es idempotente', async () => {
    const n = await store.guardar(1, pngFalso(), 'png');
    await store.eliminar(n);
    await store.eliminar(n);
    expect(existsSync(path.join(dir, n))).toBe(false);
  });
  it('rechaza nombres que intentan salir de la carpeta', async () => {
    expect(() => store.ruta('../secreto.txt')).toThrow();
    expect(() => store.ruta('/etc/passwd')).toThrow();
    await expect(store.leer('../x')).resolves.toBeNull();
  });
  it('lista solo los archivos más antiguos que el límite', async () => {
    const viejo = await store.guardar(1, pngFalso(), 'png');
    const nuevo = await store.guardar(2, pngFalso(), 'png');
    const hace2dias = new Date(Date.now() - 2 * 86_400_000);
    utimesSync(path.join(dir, viejo), hace2dias, hace2dias);
    writeFileSync(path.join(dir, 'x.txt'), 'x');
    expect(await store.listarAntiguos(new Date(Date.now() - 86_400_000))).toEqual([viejo]);
    expect(readdirSync(dir)).toContain(nuevo);
  });
});

describe('conector Click Visitas sin configurar', () => {
  const datos = { enrolamientoId: 1, usuario: { correo: 'a@b.cl', nombres: 'A', apellidos: 'B' }, rutaFoto: '/tmp/x.png' };
  const entorno = (e: Partial<Entorno['enrolamiento']>) => ({ enrolamiento: { conector: 'click_visitas', url: 'https://ejemplo.cl', usuario: 'u', clave: 'c', ...e } }) as Entorno;

  const fallo = (c: ConectorClickVisitas) => c.enviar(datos).then(() => { throw new Error('debía fallar'); }, (e: ErrorServicioExterno) => e);

  it('informa qué selectores faltan en vez de abrir el navegador', async () => {
    expect(selectoresPendientes().length).toBe(Object.keys(SELECTORES).length);
    const err = await fallo(new ConectorClickVisitas(entorno({})));
    expect(err).toBeInstanceOf(ErrorServicioExterno);
    expect(err.reintentable).toBe(false);
    expect(err.message).toContain('selectores');
  });
  it('exige las credenciales y la dirección', async () => {
    const err = await fallo(new ConectorClickVisitas(entorno({ clave: '' })));
    expect(err.message).toContain('ENROLAMIENTO_CLAVE');
    expect(err.reintentable).toBe(false);
  });
  it('detecta cuándo ya no quedan marcadores', () => {
    const listos = Object.fromEntries(Object.keys(SELECTORES).map((k) => [k, '#algo']));
    expect(selectoresPendientes(listos)).toEqual([]);
  });
});
