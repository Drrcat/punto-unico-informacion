import { detectarTipo, dimensiones } from '../../src/common/util/fotos';
import { jpegFalso, pngFalso } from '../soporte/imagenes';

describe('fotos', () => {
  it('reconoce PNG y JPEG por su contenido, no por el nombre', () => {
    expect(detectarTipo(pngFalso())).toBe('png');
    expect(detectarTipo(jpegFalso())).toBe('jpeg');
    expect(detectarTipo(Buffer.from('<?php echo 1; ?>'))).toBeNull();
    expect(detectarTipo(Buffer.from('GIF89a......'))).toBeNull();
    expect(detectarTipo(Buffer.alloc(0))).toBeNull();
  });
  it('lee las dimensiones', () => {
    expect(dimensiones(pngFalso(1280, 720))).toEqual({ ancho: 1280, alto: 720 });
    expect(dimensiones(jpegFalso(800, 600))).toEqual({ ancho: 800, alto: 600 });
  });
  it('devuelve null si el archivo está cortado o no es imagen', () => {
    expect(dimensiones(pngFalso().subarray(0, 20))).toBeNull();
    expect(dimensiones(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00]))).toBeNull();
    expect(dimensiones(Buffer.from('hola'))).toBeNull();
  });
});
