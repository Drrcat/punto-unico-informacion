import { DynamicModule, Global, Module } from '@nestjs/common';
import { ENTORNO, Entorno } from './entorno';

@Global()
@Module({})
export class EntornoModule {
  static forRoot(entorno: Entorno): DynamicModule {
    return { module: EntornoModule, providers: [{ provide: ENTORNO, useValue: entorno }], exports: [ENTORNO] };
  }
}
