import { Module } from '@nestjs/common';
import { TramitesService } from './tramites.service';
import { TramitesController } from './tramites.controller';

// Módulo de la guía de trámites. Solo lectura para el tótem.
// PrismaService no se declara aquí porque viene del PrismaModule global.
@Module({
  controllers: [TramitesController],
  providers: [TramitesService],
})
export class TramitesModule {}
