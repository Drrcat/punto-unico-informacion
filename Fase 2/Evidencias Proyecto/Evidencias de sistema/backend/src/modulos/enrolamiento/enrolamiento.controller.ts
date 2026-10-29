import { Body, Controller, Get, HttpCode, Param, ParseIntPipe, Post, Query, UploadedFile, UseGuards, UseInterceptors } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { memoryStorage } from 'multer';
import { AdminGuard, Permisos } from '../../common/auth/admin.guard';
import { EnrolamientoGuard } from '../../common/auth/enrolamiento.guard';
import { PERMISOS } from '../../common/auth/permisos';
import { IniciarVerificacionDto, ListarSolicitudesDto, ValidarCodigoDto } from './enrolamiento.dto';
import { EnrolamientoService } from './enrolamiento.service';

/** Tamaño máximo de la fotografía. Una captura de cámara web pesa mucho menos. */
export const FOTO_MAX_BYTES = 5 * 1024 * 1024;

@ApiTags('Enrolamiento')
@Controller('enrolamiento')
export class EnrolamientoController {
  constructor(private readonly enrolamiento: EnrolamientoService) {}

  @Get('estado')
  @ApiOperation({ summary: 'Indica si el módulo está activo y qué parámetros usa (dominios aceptados, intentos).' })
  estado() {
    return this.enrolamiento.estadoModulo();
  }

  @Post('autenticar')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia la verificación: envía un código de un solo uso al correo institucional.' })
  autenticar(@Body() dto: IniciarVerificacionDto) {
    return this.enrolamiento.iniciarVerificacion(dto.correo);
  }

  @Post('autenticar/:id/codigo')
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @ApiOperation({ summary: 'Valida el código ingresado. Si es correcto, crea la solicitud y entrega el token para enviar la foto.' })
  validarCodigo(@Param('id', ParseIntPipe) id: number, @Body() dto: ValidarCodigoDto) {
    return this.enrolamiento.validarCodigo(id, dto.codigo);
  }

  @Post(':id/foto')
  @HttpCode(200)
  @UseGuards(EnrolamientoGuard)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseInterceptors(FileInterceptor('foto', { storage: memoryStorage(), limits: { fileSize: FOTO_MAX_BYTES, files: 1 } }))
  @ApiBearerAuth()
  @ApiConsumes('multipart/form-data')
  @ApiBody({ schema: { type: 'object', properties: { foto: { type: 'string', format: 'binary', description: 'JPG o PNG. Se puede omitir para reintentar con la copia conservada tras una falla técnica.' } } } })
  @ApiOperation({ summary: 'Valida la fotografía con Google Vision AI y la envía al sistema de enrolamiento.' })
  foto(@Param('id', ParseIntPipe) id: number, @UploadedFile() foto?: Express.Multer.File) {
    return this.enrolamiento.procesarFoto(id, foto?.buffer ?? null);
  }

  @Post(':id/cancelar')
  @HttpCode(200)
  @UseGuards(EnrolamientoGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cancela la solicitud y elimina cualquier fotografía pendiente (por ejemplo, por inactividad).' })
  cancelar(@Param('id', ParseIntPipe) id: number) {
    return this.enrolamiento.cancelar(id);
  }

  @Get('solicitudes')
  @UseGuards(AdminGuard)
  @Permisos(PERMISOS.ENROLAMIENTO_VER)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Consulta el estado de las solicitudes de enrolamiento (administrador).' })
  solicitudes(@Query() q: ListarSolicitudesDto) {
    return this.enrolamiento.solicitudes(q);
  }
}
