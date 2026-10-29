import { Controller, Get, Param, ParseIntPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiProduces, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import { ListarPisosDto } from './pisos.dto';
import { PisosService } from './pisos.service';

@ApiTags('Infraestructura: pisos')
@Controller('pisos')
export class PisosController {
  constructor(private readonly pisos: PisosService) {}

  @Get()
  @ApiOperation({ summary: 'Lista los pisos con la dirección de su plano SVG.' })
  listar(@Query() q: ListarPisosDto) {
    return this.pisos.listar(q.edificioId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un piso con sus espacios (id del elemento del SVG incluido).' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.pisos.obtener(id);
  }

  @Get(':id/plano')
  @ApiOperation({ summary: 'Plano SVG del piso.' })
  @ApiProduces('image/svg+xml')
  async plano(@Param('id', ParseIntPipe) id: number, @Res({ passthrough: true }) res: Response): Promise<string> {
    const svg = await this.pisos.plano(id);
    // Los encabezados se fijan solo si hay plano: un error debe seguir respondiendo JSON.
    res.type('image/svg+xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=300');
    res.setHeader('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; img-src data:");
    return svg;
  }
}
