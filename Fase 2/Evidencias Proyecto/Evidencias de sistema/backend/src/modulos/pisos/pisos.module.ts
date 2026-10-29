import { Module } from '@nestjs/common';
import { PisosController } from './pisos.controller';
import { PisosService } from './pisos.service';

@Module({ controllers: [PisosController], providers: [PisosService], exports: [PisosService] })
export class PisosModule {}
