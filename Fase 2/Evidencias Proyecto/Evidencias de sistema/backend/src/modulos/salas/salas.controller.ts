import { Body, Controller, Delete, Get, HttpCode, Param, ParseIntPipe, Post, Put, Query, Req, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';
import { Admin, AdminGuard, Permisos, SesionOpcionalGuard } from '../../common/auth/admin.guard';
import { PERMISOS } from '../../common/auth/permisos';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { noAutorizado } from '../../common/filtros/errores';
import { ConsultaService } from '../../common/registro/consulta.service';
import { ActualizarSalaDto, CrearSalaDto, ListarSalasDto } from './salas.dto';
import { SalasService } from './salas.service';

@ApiTags('Infraestructura: salas')
@Controller('salas')
export class SalasController {
  constructor(
    private readonly salas: SalasService,
    private readonly consultas: ConsultaService,
  ) {}

  @Get('tipos')
  @ApiOperation({ summary: 'Catálogo de tipos de espacio (sala, baño, escalera, etc.).' })
  tipos() {
    return this.salas.tipos();
  }

  @Get()
  @UseGuards(SesionOpcionalGuard)
  @ApiOperation({ summary: 'Busca y lista salas, oficinas y otros espacios con su piso y ubicación.' })
  @ApiBearerAuth()
  async listar(@Query() q: ListarSalasDto, @Admin() admin: AdminActual | undefined) {
    if (q.todas && !admin) throw noAutorizado('NO_AUTENTICADO', 'Ver todas las salas requiere iniciar sesión como administrador.');
    const r = await this.salas.listar({
      q: q.q ?? undefined,
      pisoId: q.pisoId,
      tipoEspacioId: q.tipoEspacioId,
      limite: q.limite ?? 20,
      desplazamiento: q.desplazamiento ?? 0,
      admin: !!q.todas && !!admin,
    });
    // Las búsquedas del tótem quedan registradas; las consultas de un administrador no cuentan como uso.
    if (q.q && !admin) await this.consultas.registrar({ tipo: 'SALA', termino: q.q, huboResultado: r.total > 0, espacioId: r.items[0]?.id ?? null });
    return r;
  }

  @Get(':id')
  @UseGuards(SesionOpcionalGuard)
  @ApiOperation({ summary: 'Detalle de una sala: equipamiento, áreas que funcionan allí, piso y plano.' })
  @ApiBearerAuth()
  obtener(@Param('id', ParseIntPipe) id: number, @Req() req: Request & { admin?: AdminActual }) {
    return this.salas.obtener(id, !!req.admin);
  }

  @Post()
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.SALA_CREAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crea una sala (administrador).' })
  crear(@Body() dto: CrearSalaDto, @Admin() admin: AdminActual) {
    return this.salas.crear(dto, admin);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.SALA_EDITAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edita una sala (administrador). Solo cambia los campos enviados.' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarSalaDto, @Admin() admin: AdminActual) {
    return this.salas.actualizar(id, dto, admin);
  }

  @Delete(':id')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.SALA_ELIMINAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Elimina una sala (administrador). Falla si un área o un tótem la usa.' })
  async eliminar(@Param('id', ParseIntPipe) id: number, @Admin() admin: AdminActual): Promise<void> {
    await this.salas.eliminar(id, admin);
  }
}
