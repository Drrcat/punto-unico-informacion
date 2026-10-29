import { Injectable } from '@nestjs/common';
import { dimensiones } from '../../common/util/fotos';
import { RostroDetectado, ValidadorRostros } from './validador-rostros';

/** Para desarrollo y demostraciones sin credenciales de Google: da por bueno un rostro centrado en cualquier imagen válida. */
@Injectable()
export class SimuladoVisionProvider extends ValidadorRostros {
  async analizar(imagen: Buffer): Promise<RostroDetectado[]> {
    const d = dimensiones(imagen) ?? { ancho: 640, alto: 480 };
    const w = d.ancho * 0.4;
    const h = d.alto * 0.55;
    const x = (d.ancho - w) / 2;
    const y = (d.alto - h) / 2;
    return [
      {
        confianza: 0.97,
        caja: [
          { x, y },
          { x: x + w, y },
          { x: x + w, y: y + h },
          { x, y: y + h },
        ],
        giro: 0,
        cabeceo: 0,
        ladeo: 0,
        subexpuesta: 'VERY_UNLIKELY',
        borrosa: 'VERY_UNLIKELY',
      },
    ];
  }
}
