import { Injectable, Logger } from '@nestjs/common';
import { CorreoProvider, MensajeCodigo } from './correo.provider';

/** Para desarrollo y demostraciones sin proveedor de correo: imprime el código en el log. */
@Injectable()
export class ConsolaProvider extends CorreoProvider {
  private readonly log = new Logger('CorreoConsola');

  async enviarCodigo(m: MensajeCodigo): Promise<void> {
    this.log.warn(`[SIMULADO] Código para ${m.para}: ${m.codigo} (vence en ${m.vigenciaMin} min)`);
  }
}
