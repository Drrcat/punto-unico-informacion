import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Patch, Post, Put, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin, AdminGuard, Permisos } from '../../common/auth/admin.guard';
import { PERMISOS } from '../../common/auth/permisos';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { ConsultaService } from '../../common/registro/consulta.service';
import { ActualizarAreaDto, CrearAreaDto, ListarAreasDto } from './areas.dto';
import { AreasService } from './areas.service';

@ApiTags('Infraestructura: áreas')
@Controller('areas')
export class AreasController {
  constructor(private readonly areas: AreasService, private readonly consultas: ConsultaService) {}

  @Get()
  async listar(@Query() q: ListarAreasDto) {
    const r = await this.areas.listar(q.q ?? undefined);
    if (q.q) await this.consultas.registrar({ tipo: 'DIRECTORIO', termino: q.q, huboResultado: r.length > 0 });
    return r;
  }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) { return this.areas.obtener(id); }

  @Post()
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.AREA_CREAR)
  @ApiBearerAuth()
  crear(@Body() dto: CrearAreaDto, @Admin() admin: AdminActual) { return this.areas.crear(dto, admin); }

  @Put(':id')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.AREA_EDITAR)
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAreaDto, @Admin() admin: AdminActual) {
    return this.areas.actualizar(id, dto, admin);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.AREA_ELIMINAR)
  async eliminar(@Param('id', ParseIntPipe) id: number, @Admin() admin: AdminActual): Promise<void> {
    await this.areas.eliminar(id, admin);
  }
}

/** Compatibilidad sin prefijo /api para la aplicación de escritorio. */
@Controller('areas')
export class AreasEscritorioController {
  constructor(private readonly areas: AreasService) {}

  @Get()
  listar(@Query() q: ListarAreasDto) { return this.areas.listar(q.q ?? undefined); }

  @Get(':id')
  obtener(@Param('id', ParseIntPipe) id: number) { return this.areas.obtener(id); }

  @Post()
  crear(@Body() dto: CrearAreaDto) { return this.areas.crear(dto, undefined); }

  @Put(':id')
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAreaDto) {
    return this.areas.actualizar(id, dto, undefined);
  }

  @Patch(':id')
  actualizarParcial(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarAreaDto) {
    return this.areas.actualizar(id, dto, undefined);
  }

  @Delete(':id')
  @HttpCode(204)
  eliminar(@Param('id', ParseIntPipe) id: number) { return this.areas.eliminar(id, undefined); }
}
