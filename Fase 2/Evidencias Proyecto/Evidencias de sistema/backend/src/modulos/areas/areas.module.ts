import { Module } from '@nestjs/common';
import { AreasController, AreasEscritorioController } from './areas.controller';
import { AreasService } from './areas.service';

@Module({ controllers: [AreasController, AreasEscritorioController], providers: [AreasService], exports: [AreasService] })
export class AreasModule {}
