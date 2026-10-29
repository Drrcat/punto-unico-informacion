import { Inject, Injectable } from '@nestjs/common';
import { ConfiguracionService } from '../../common/configuracion/configuracion.service';
import { noDisponible } from '../../common/filtros/errores';
import { ENTORNO, Entorno } from '../../config/entorno';
import { ConectorEnrolamiento } from './conector-enrolamiento';
import { ConectorClickVisitas } from './click-visitas.conector';
import { ConectorSimulado } from './simulado.conector';

/** Elige el conector de enrolamiento según la configuración de la institución (`conector_enrolamiento`). */
@Injectable()
export class ConectoresService {
  constructor(
    private readonly config: ConfiguracionService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
    private readonly simulado: ConectorSimulado,
    private readonly clickVisitas: ConectorClickVisitas,
  ) {}

  async obtener(): Promise<ConectorEnrolamiento> {
    const nombre = ((await this.config.textoOpcional('conector_enrolamiento')) ?? this.entorno.enrolamiento.conector).toLowerCase();
    switch (nombre) {
      case 'simulado':
        return this.simulado;
      case 'click_visitas':
        return this.clickVisitas;
      default:
        throw noDisponible('SIN_CONECTOR', 'El enrolamiento no está disponible porque no hay un sistema de destino configurado.');
    }
  }
}
