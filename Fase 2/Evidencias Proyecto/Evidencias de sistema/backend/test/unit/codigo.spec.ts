import { codigoCorrecto, enmascararCorreo, generarCodigo, hashCodigo } from '../../src/modulos/enrolamiento/codigo';
import { nombresDesdeCorreo } from '../../src/modulos/enrolamiento/usuarios.util';

describe('código de verificación', () => {
  it('siempre tiene seis dígitos, con ceros a la izquierda si hace falta', () => {
    for (let i = 0; i < 2000; i++) expect(generarCodigo()).toMatch(/^[0-9]{6}$/);
  });
  it('no repite siempre el mismo valor', () => {
    expect(new Set(Array.from({ length: 200 }, generarCodigo)).size).toBeGreaterThan(150);
  });
  it('se verifica contra el hash, nunca contra el código en claro', () => {
    const h = hashCodigo('clave', 'ana@ejemplo.cl', '123456');
    expect(h).not.toContain('123456');
    expect(h).toHaveLength(64);
    expect(codigoCorrecto('clave', 'ana@ejemplo.cl', '123456', h)).toBe(true);
    expect(codigoCorrecto('clave', 'ana@ejemplo.cl', '123457', h)).toBe(false);
  });
  it('el hash depende del correo y de la clave del servidor', () => {
    const h = hashCodigo('clave', 'ana@ejemplo.cl', '123456');
    expect(codigoCorrecto('clave', 'otra@ejemplo.cl', '123456', h)).toBe(false);
    expect(codigoCorrecto('otra-clave', 'ana@ejemplo.cl', '123456', h)).toBe(false);
  });
  it('el correo se compara sin importar mayúsculas', () => {
    expect(hashCodigo('k', 'ANA@ejemplo.cl', '1')).toBe(hashCodigo('k', 'ana@ejemplo.cl', '1'));
  });
  it('enmascara el correo para mostrarlo en pantalla', () => {
    expect(enmascararCorreo('juan.perez@ejemplo.cl')).toBe('j***@ejemplo.cl');
  });
});

describe('nombresDesdeCorreo', () => {
  it('separa nombre y apellido cuando el correo lo permite', () => {
    expect(nombresDesdeCorreo('juan.perez@ejemplo.cl')).toEqual({ nombres: 'Juan', apellidos: 'Perez' });
    expect(nombresDesdeCorreo('maria_jose.soto.diaz@ejemplo.cl')).toEqual({ nombres: 'Maria', apellidos: 'Jose Soto Diaz' });
  });
  it('si no, deja todo en nombres', () => {
    expect(nombresDesdeCorreo('jperez@ejemplo.cl')).toEqual({ nombres: 'Jperez', apellidos: '' });
    expect(nombresDesdeCorreo('12345@ejemplo.cl')).toEqual({ nombres: 'Usuario', apellidos: '' });
  });
  it('respeta el largo máximo de las columnas', () => {
    const r = nombresDesdeCorreo(`${'a'.repeat(300)}.${'b'.repeat(300)}@ejemplo.cl`);
    expect(r.nombres.length).toBeLessThanOrEqual(100);
    expect(r.apellidos.length).toBeLessThanOrEqual(100);
  });
});
