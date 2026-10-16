import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { FaqsModule } from './faqs/faqs.module';

// Módulo raíz: junta la conexión a la base (PrismaModule) y el módulo de FAQ
@Module({
  imports: [PrismaModule, FaqsModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
