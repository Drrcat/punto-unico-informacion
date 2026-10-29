import { Module } from '@nestjs/common';
import { SalasController, SalasEscritorioController } from './salas.controller';
import { SalasService } from './salas.service';

@Module({ controllers: [SalasController, SalasEscritorioController], providers: [SalasService], exports: [SalasService] })
export class SalasModule {}
