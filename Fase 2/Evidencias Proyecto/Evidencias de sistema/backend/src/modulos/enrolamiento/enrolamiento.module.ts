import { Module } from '@nestjs/common';
import { EnrolamientoController } from './enrolamiento.controller';
import { EnrolamientoService } from './enrolamiento.service';
import { FotosStore } from './fotos.store';
import { LimpiezaService } from './limpieza.service';
import { RetencionService } from './retencion.service';

@Module({
  controllers: [EnrolamientoController],
  providers: [EnrolamientoService, FotosStore, RetencionService, LimpiezaService],
  exports: [EnrolamientoService, LimpiezaService],
})
export class EnrolamientoModule {}
