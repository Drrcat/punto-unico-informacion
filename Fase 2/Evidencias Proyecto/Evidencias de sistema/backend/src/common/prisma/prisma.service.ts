import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { Prisma, PrismaClient } from '@prisma/client';
import { ENTORNO, Entorno } from '../../config/entorno';

/** Cliente de Prisma sobre `pg`. La conexión se abre en la primera consulta, no al construir el servicio. */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(ENTORNO) entorno: Entorno) {
    super({ adapter: new PrismaPg({ connectionString: entorno.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}

/** Cliente o transacción: los servicios de registro aceptan cualquiera de los dos. */
export type Cliente = PrismaService | Prisma.TransactionClient;
