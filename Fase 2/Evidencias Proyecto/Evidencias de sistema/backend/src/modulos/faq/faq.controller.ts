import { Body, Controller, Delete, Get, Param, ParseIntPipe, Patch, Post, Put } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { ActualizarFaqDto, CrearFaqDto } from './faq.dto';
import { FaqService } from './faq.service';

/**
 * Rutas: /api/faq (oficial) y /faqs (compatibilidad con la aplicación de escritorio, que todavía llama sin el
 * prefijo /api; ver RUTAS_SIN_PREFIJO en app.setup.ts). Sin guardia de administrador, igual que antes: la
 * aplicación de escritorio aún no envía token.
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
  @ApiOperation({ summary: 'Todas las preguntas, incluidos los borradores (aplicación de escritorio).' })
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
  @ApiOperation({ summary: 'Crea una pregunta (queda como borrador si no se envía publicada).' })
  crear(@Body() dto: CrearFaqDto) {
    return this.faq.crear(dto);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Edita una pregunta. Solo cambian los campos enviados.' })
  actualizar(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarFaqDto) {
    return this.faq.actualizar(id, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Igual que PUT; lo usa la aplicación de escritorio.' })
  actualizarParcial(@Param('id', ParseIntPipe) id: number, @Body() dto: ActualizarFaqDto) {
    return this.faq.actualizar(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Elimina una pregunta.' })
  eliminar(@Param('id', ParseIntPipe) id: number) {
    return this.faq.eliminar(id);
  }
}
