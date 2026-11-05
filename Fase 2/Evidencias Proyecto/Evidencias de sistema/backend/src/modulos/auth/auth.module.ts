import { Module } from '@nestjs/common';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

/** Inicio de sesión del personal. La validación de cada solicitud vive en `common/auth` (AdminGuard). */
@Module({ controllers: [AuthController], providers: [AuthService] })
export class AuthLoginModule {}
