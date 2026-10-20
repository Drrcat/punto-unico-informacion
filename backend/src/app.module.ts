import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FaqsModule } from './faqs/faqs.module';
import { AreasModule } from './areas/areas.module';
import { TramitesModule } from './tramites/tramites.module';

// Módulo raíz: junta la conexión a la base (PrismaModule) y los módulos del tótem
@Module({
  imports: [PrismaModule, FaqsModule, AreasModule, TramitesModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
