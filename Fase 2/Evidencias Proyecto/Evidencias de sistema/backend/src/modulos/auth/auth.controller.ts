import { Body, Controller, Get, Headers, HttpCode, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { Admin, AdminGuard } from '../../common/auth/admin.guard';
import { AdminActual } from '../../common/auth/sesion-admin.service';
import { LoginDto } from './auth.dto';
import { AuthService } from './auth.service';

@ApiTags('Autenticación')
@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('login')
  @HttpCode(200)
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Inicia sesión del personal administrativo y entrega el token de la sesión.' })
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto.correo, dto.clave);
  }

  @Post('logout')
  @HttpCode(204)
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Cierra la sesión: el token deja de ser válido.' })
  async logout(@Headers('authorization') autorizacion: string): Promise<void> {
    await this.auth.logout(autorizacion);
  }

  @Get('sesion')
  @UseGuards(AdminGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Datos del administrador de la sesión actual. Sirve para comprobar si un token guardado sigue vigente.' })
  sesion(@Admin() admin: AdminActual) {
    return this.auth.perfil(admin.usuarioId, admin.permisos);
  }
}
