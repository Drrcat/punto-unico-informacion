import { Global, Module } from '@nestjs/common';
import { ENTORNO, Entorno } from '../config/entorno';
import { ConectorClickVisitas } from './conector/click-visitas.conector';
import { ConectoresService } from './conector/conectores.service';
import { ConectorSimulado } from './conector/simulado.conector';
import { ConsolaProvider } from './correo/consola.provider';
import { CorreoProvider } from './correo/correo.provider';
import { ResendProvider } from './correo/resend.provider';
import { GoogleVisionProvider } from './vision/google-vision.provider';
import { SimuladoVisionProvider } from './vision/simulado.provider';
import { ValidadorRostros } from './vision/validador-rostros';

/**
 * Servicios externos detrás de interfaces propias. El proveedor se elige por variables de entorno
 * (CORREO_DRIVER, VISION_DRIVER) y el conector de enrolamiento por la configuración de la institución.
 */
@Global()
@Module({
  providers: [
    ResendProvider,
    ConsolaProvider,
    GoogleVisionProvider,
    SimuladoVisionProvider,
    ConectorSimulado,
    ConectorClickVisitas,
    ConectoresService,
    { provide: CorreoProvider, inject: [ENTORNO, ResendProvider, ConsolaProvider], useFactory: (e: Entorno, r: ResendProvider, c: ConsolaProvider) => (e.correo.driver === 'resend' ? r : c) },
    { provide: ValidadorRostros, inject: [ENTORNO, GoogleVisionProvider, SimuladoVisionProvider], useFactory: (e: Entorno, g: GoogleVisionProvider, s: SimuladoVisionProvider) => (e.vision.driver === 'google' ? g : s) },
  ],
  exports: [CorreoProvider, ValidadorRostros, ConectoresService],
})
export class IntegracionesModule {}
