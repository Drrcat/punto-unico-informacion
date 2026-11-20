import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Admin, AdminGuard, Permisos } from '../../common/auth/admin.guard';
import { PERMISOS } from '../../common/auth/permisos';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { ActualizarFaqDto, CrearFaqDto } from './faq.dto';
import { FaqService } from './faq.service';

/**
 * Rutas: /api/faq (oficial) y /faqs (compatibilidad con la aplicación de escritorio, que llama sin el
 * prefijo /api; ver RUTAS_SIN_PREFIJO en app.setup.ts).
 * Lo que muestra el tótem (preguntas publicadas y categorías) es público. Ver borradores, crear, editar y
 * eliminar exigen una sesión de administrador con el permiso correspondiente.
 */
@ApiTags('Preguntas frecuentes')
@Controller(['faq', 'faqs'])
export class FaqController {
  constructor(private readonly faq: FaqService) {}

  @Get()
  @ApiOperation({ summary: 'Preguntas publicadas, para el tótem.' })
  listar() {
    return this.faq.listar();
  }

  @Get('admin')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.FAQ_EDITAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Todas las preguntas, incluidos los borradores (administrador).' })
  listarAdmin() {
    return this.faq.listarAdmin();
  }

  @Get('categorias')
  @ApiOperation({ summary: 'Categorías de preguntas frecuentes.' })
  categorias() {
    return this.faq.categorias();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Una pregunta publicada.' })
  obtener(@Param('id', ParseIntPipe) id: number) {
    return this.faq.obtener(id);
  }

  @Post()
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.FAQ_CREAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Crea una pregunta (queda como borrador si no se envía publicada). El autor es el administrador de la sesión.' })
  crear(@Body() dto: CrearFaqDto, @Admin() admin: AdminActual) {
    return this.faq.crear(dto, admin.usuarioId);
  }

  @Put(':id')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.FAQ_EDITAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Edita una pregunta. Solo cambian los campos enviados.' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarFaqDto) {
    return this.faq.actualizar(id, dto);
  }

  @Patch(':id')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.FAQ_EDITAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Igual que PUT.' })
  actualizarParcial(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarFaqDto) {
    return this.faq.actualizar(id, dto);
  }

  @Delete(':id')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.FAQ_ELIMINAR)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Elimina una pregunta.' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.faq.eliminar(id);
  }
}
