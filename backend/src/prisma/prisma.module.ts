import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

// Módulo global: registra UNA sola instancia de PrismaService para toda la app.
// Antes cada módulo declaraba su propio PrismaService y se abrían varias conexiones.
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
