import { Module } from '@nestjs/common';
import { AreasService } from './areas.service';
import { AreasController } from './areas.controller';

// Módulo del directorio de áreas ("¿dónde debo ir?"). Solo lectura para el tótem.
// PrismaService no se declara aquí porque viene del PrismaModule global.
@Module({
  controllers: [AreasController],
  providers: [AreasService],
})
export class AreasModule {}
