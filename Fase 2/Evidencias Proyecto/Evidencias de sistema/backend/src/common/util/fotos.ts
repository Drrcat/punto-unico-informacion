/** Utilidades para fotografías: tipo y dimensiones leídas del propio archivo, sin depender de librerías de imágenes. */

export type TipoImagen = 'jpeg' | 'png';

export function detectarTipo(b: Buffer): TipoImagen | null {
  if (b.length > 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg';
  if (b.length > 8 && b.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  return null;
}

/** Ancho y alto en píxeles, o `null` si el archivo está dañado o incompleto. */
export function dimensiones(b: Buffer): { ancho: number; alto: number } | null {
  const tipo = detectarTipo(b);
  if (tipo === 'png') {
    if (b.length < 24) return null;
    return { ancho: b.readUInt32BE(16), alto: b.readUInt32BE(20) };
  }
  if (tipo === 'jpeg') {
    let i = 2;
    while (i + 9 < b.length) {
      if (b[i] !== 0xff) {
        i++;
        continue;
      }
      const marcador = b[i + 1];
      if (marcador === 0xff) {
        i++;
        continue;
      }
      // SOF0..SOF15, salvo DHT (C4), JPG (C8) y DAC (CC).
      if (marcador >= 0xc0 && marcador <= 0xcf && ![0xc4, 0xc8, 0xcc].includes(marcador)) {
        return { alto: b.readUInt16BE(i + 5), ancho: b.readUInt16BE(i + 7) };
      }
      if (marcador === 0xd8 || (marcador >= 0xd0 && marcador <= 0xd7) || marcador === 0x01) {
        i += 2;
        continue;
      }
      i += 2 + b.readUInt16BE(i + 2);
    }
  }
  return null;
}
