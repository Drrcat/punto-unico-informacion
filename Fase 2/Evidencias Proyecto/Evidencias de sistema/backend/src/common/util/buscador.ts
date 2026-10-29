/**
 * Búsqueda de texto en memoria, sin acentos ni mayúsculas, pensada para pocos cientos de registros
 * (salas y áreas de una sede). Evita depender de extensiones de PostgreSQL y permite ordenar por relevancia.
 */

export function sinAcentos(s: string): string {
  return s.normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/**
 * Divide un texto en palabras comparables: minúsculas, sin acentos, separadas por cualquier símbolo
 * y también entre letras y números ("LC07" -> ["lc", "7"]); a los números se les quitan los ceros a la izquierda
 * para que "sala 5" encuentre "Sala 05".
 */
export function tokenizar(texto: string): string[] {
  const limpio = sinAcentos(texto).toLowerCase();
  const partes = limpio.match(/[a-z]+|[0-9]+/g) ?? [];
  return partes.map((p) => (/^[0-9]+$/.test(p) ? String(Number(p)) : p));
}

const esNumero = (t: string) => /^[0-9]+$/.test(t);

/** ¿Difieren en una sola letra (cambio, falta o sobra)? Solo se usa con palabras de 4 letras o más. */
function aDistanciaUno(a: string, b: string): boolean {
  if (Math.abs(a.length - b.length) > 1) return false;
  let i = 0;
  while (i < a.length && i < b.length && a[i] === b[i]) i++;
  if (i === a.length || i === b.length) return Math.abs(a.length - b.length) <= 1;
  if (a.length === b.length) return a.slice(i + 1) === b.slice(i + 1);
  const [corta, larga] = a.length < b.length ? [a, b] : [b, a];
  return corta.slice(i) === larga.slice(i + 1);
}

/**
 * 3 = igual, 2 = empieza con, 1 = casi igual (una letra de diferencia), 0 = no coincide.
 * Un número que es solo el comienzo de otro ("5" en "50") cuenta únicamente si `prefijoNumerico` es verdadero.
 */
export function puntajeToken(consulta: string, token: string, prefijoNumerico = true): number {
  if (consulta === token) return 3;
  if (token.startsWith(consulta)) return esNumero(consulta) ? (prefijoNumerico ? 1.5 : 0) : 2;
  if (consulta.length >= 4 && token.length >= 4 && !esNumero(consulta) && aDistanciaUno(consulta, token)) return 1;
  return 0;
}

export interface CampoIndexado {
  tokens: string[];
  peso: number;
}

export interface Indexado<T> {
  item: T;
  campos: CampoIndexado[];
}

export function indexar<T>(item: T, campos: { texto: string | null | undefined; peso: number }[]): Indexado<T> {
  return {
    item,
    campos: campos.filter((c) => c.texto).map((c) => ({ tokens: tokenizar(c.texto as string), peso: c.peso })),
  };
}

/** Puntaje de un documento para la consulta; 0 si alguna palabra de la consulta no aparece en él. */
export function puntuar(consulta: string[], doc: Indexado<unknown>, prefijoNumerico = true): number {
  let total = 0;
  for (const q of consulta) {
    let mejor = 0;
    for (const campo of doc.campos) {
      for (const t of campo.tokens) mejor = Math.max(mejor, puntajeToken(q, t, prefijoNumerico) * campo.peso);
    }
    if (mejor === 0) return 0;
    total += mejor;
  }
  // Un campo que coincide completo con la consulta ("PA-323" al escribir "pa 323") va primero.
  const exacto = doc.campos.some((c) => c.tokens.length === consulta.length && c.tokens.every((t, i) => t === consulta[i]));
  return total + (exacto ? 10 : 0);
}

/**
 * Devuelve los elementos que coinciden con el texto, de mayor a menor relevancia.
 * Primero se buscan coincidencias con los números completos ("s05" no trae "S50"); solo si no hay ninguna
 * se aceptan números incompletos ("32" trae "323").
 */
export function buscar<T>(texto: string, indice: Indexado<T>[], desempate: (a: T, b: T) => number): T[] {
  const q = tokenizar(texto);
  if (!q.length) return [];
  const evaluar = (prefijoNumerico: boolean) =>
    indice
      .map((d) => ({ item: d.item, p: puntuar(q, d, prefijoNumerico) }))
      .filter((x) => x.p > 0)
      .sort((a, b) => b.p - a.p || desempate(a.item, b.item))
      .map((x) => x.item);
  const estricto = evaluar(false);
  return estricto.length || !q.some(esNumero) ? estricto : evaluar(true);
}
