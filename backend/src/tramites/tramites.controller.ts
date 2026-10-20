import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { TramitesService } from './tramites.service';

@Controller('tramites')
export class TramitesController {
  constructor(private readonly tramitesService: TramitesService) {}

  @Get()
  findAll() {
    return this.tramitesService.findAll();
  }

  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.tramitesService.findOne(id);
  }
}
