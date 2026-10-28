import { Module } from '@nestjs/common';
import { FaqsService } from './faqs.service';
import { FaqsController } from './faqs.controller';

// Módulo de Preguntas Frecuentes: agrupa su controlador (rutas) y su servicio (lógica).
// PrismaService no se declara aquí porque viene del PrismaModule global.
@Module({
  controllers: [FaqsController],
  providers: [FaqsService],
})
export class FaqsModule {}
