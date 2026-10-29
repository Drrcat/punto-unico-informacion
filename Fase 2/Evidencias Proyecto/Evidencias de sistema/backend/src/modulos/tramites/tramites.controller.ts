import { Controller, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ConsultaService } from '../../common/registro/consulta.service';
import { ListarTramitesDto } from './tramites.dto';
import { TramitesService } from './tramites.service';

@ApiTags('Trámites')
@Controller('tramites')
export class TramitesController {
  constructor(
    private readonly tramites: TramitesService,
    private readonly consultas: ConsultaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista los trámites activos con el área que los resuelve.' })
  async listar(@Query() q: ListarTramitesDto) {
    const r = await this.tramites.listar(q.q ?? undefined, q.areaId);
    if (q.q) await this.consultas.registrar({ tipo: 'TRAMITE', termino: q.q, huboResultado: r.length > 0 });
    return r;
  }

  @Get(':id')
  @ApiOperation({ summary: 'Detalle de un trámite: pasos, requisitos y área responsable con su ubicación.' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.tramites.obtener(id);
  }
}
