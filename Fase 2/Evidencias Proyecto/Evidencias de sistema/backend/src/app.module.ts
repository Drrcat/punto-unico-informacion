import { DynamicModule, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from './common/auth/auth.module';
import { NucleoModule } from './common/prisma/prisma.module';
import { ENTORNO, Entorno } from './config/entorno';
import { EntornoModule } from './config/entorno.module';
import { IntegracionesModule } from './integraciones/integraciones.module';
import { AreasModule } from './modulos/areas/areas.module';
import { EnrolamientoModule } from './modulos/enrolamiento/enrolamiento.module';
import { FaqModule } from './modulos/faq/faq.module';
import { PisosModule } from './modulos/pisos/pisos.module';
import { SalasModule } from './modulos/salas/salas.module';
import { TramitesModule } from './modulos/tramites/tramites.module';

@Module({})
export class AppModule {
  static forRoot(entorno: Entorno): DynamicModule {
    return {
      module: AppModule,
      imports: [
        EntornoModule.forRoot(entorno),
        NucleoModule,
        AuthModule,
        IntegracionesModule,
        ThrottlerModule.forRootAsync({
          inject: [ENTORNO],
          useFactory: (e: Entorno) => ({
            throttlers: [{ name: 'default', ttl: 60_000, limit: e.limitePorMinuto }],
            skipIf: () => !e.limitesActivos,
          }),
        }),
        ...(entorno.tareasActivas ? [ScheduleModule.forRoot()] : []),
        PisosModule,
        SalasModule,
        AreasModule,
        TramitesModule,
        EnrolamientoModule,
        FaqModule,
      ],
      providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
    };
  }
}
