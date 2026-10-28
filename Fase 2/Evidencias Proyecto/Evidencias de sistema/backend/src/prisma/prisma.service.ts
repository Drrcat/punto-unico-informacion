import { Injectable, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

// Cliente de base de datos (Prisma) disponible para inyectar en cualquier servicio.
// Lee la conexión desde la variable de entorno DATABASE_URL (archivo .env).
@Injectable()
export class PrismaService
  extends PrismaClient
  implements OnModuleInit, OnModuleDestroy
{
  // Se conecta a PostgreSQL cuando arranca la aplicación
  async onModuleInit() {
    await this.$connect();
  }

  // Cierra la conexión cuando la aplicación se detiene
  async onModuleDestroy() {
    await this.$disconnect();
  }
}
