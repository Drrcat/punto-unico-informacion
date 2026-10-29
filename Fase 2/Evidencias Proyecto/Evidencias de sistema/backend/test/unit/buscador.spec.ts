import { buscar, indexar, puntajeToken, tokenizar } from '../../src/common/util/buscador';

describe('tokenizar', () => {
  it('ignora tildes, mayúsculas y símbolos', () => {
    expect(tokenizar('Pañol  Electrónica')).toEqual(['panol', 'electronica']);
    expect(tokenizar('PA-323')).toEqual(['pa', '323']);
  });
  it('separa letras de números y quita ceros a la izquierda', () => {
    expect(tokenizar('LC07')).toEqual(['lc', '7']);
    expect(tokenizar('Sala 05')).toEqual(['sala', '5']);
    expect(tokenizar('S-10')).toEqual(['s', '10']);
  });
  it('devuelve vacío si no hay nada comparable', () => {
    expect(tokenizar('  --  ')).toEqual([]);
  });
});

describe('puntajeToken', () => {
  it('prefiere igual a prefijo y prefijo a error de una letra', () => {
    expect(puntajeToken('sala', 'sala')).toBe(3);
    expect(puntajeToken('sal', 'sala')).toBe(2);
    expect(puntajeToken('salla', 'sala')).toBe(1);
    expect(puntajeToken('sale', 'sala')).toBe(1);
    expect(puntajeToken('mesa', 'sala')).toBe(0);
  });
  it('no corrige errores en palabras cortas ni en números', () => {
    expect(puntajeToken('ba', 'bo')).toBe(0);
    expect(puntajeToken('323', '322')).toBe(0);
  });
});

describe('buscar', () => {
  type Sala = { id: number; codigo: string; nombre: string; alias?: string };
  const salas: Sala[] = [
    { id: 1, codigo: 'S05', nombre: 'Sala 05' },
    { id: 2, codigo: 'S50', nombre: 'Sala 50' },
    { id: 3, codigo: 'PA-323', nombre: 'PA-323' },
    { id: 4, codigo: 'PANOL-E', nombre: 'Pañol Electrónica', alias: 'Bodega de electrónica' },
    { id: 5, codigo: 'B1', nombre: 'Baño hombres' },
  ];
  const indice = salas.map((s) => indexar(s, [{ texto: s.codigo, peso: 1 }, { texto: s.nombre, peso: 1 }, { texto: s.alias, peso: 0.9 }]));
  const ids = (q: string) => buscar(q, indice, (a, b) => a.id - b.id).map((s) => s.id);

  it('"sala 5" encuentra Sala 05 y no Sala 50', () => {
    expect(ids('sala 5')).toEqual([1]);
  });
  it('un número incompleto solo sirve si no hay coincidencia exacta', () => {
    expect(ids('32')).toEqual([3]);
    expect(ids('sala 3')).toEqual([]);
  });
  it('encuentra por código escrito de distintas maneras', () => {
    expect(ids('pa 323')).toEqual([3]);
    expect(ids('PA323')).toEqual([3]);
    expect(ids('s05')).toEqual([1]);
  });
  it('no distingue tildes ni mayúsculas', () => {
    expect(ids('PANOL')).toEqual([4]);
    expect(ids('bano')).toEqual([5]);
  });
  it('encuentra por alias', () => {
    expect(ids('bodega')).toEqual([4]);
  });
  it('tolera una letra equivocada', () => {
    expect(ids('electronika')).toEqual([4]);
  });
  it('exige que todas las palabras aparezcan', () => {
    expect(ids('sala pañol')).toEqual([]);
  });
  it('una consulta vacía no devuelve nada', () => {
    expect(ids('   ')).toEqual([]);
  });
});
