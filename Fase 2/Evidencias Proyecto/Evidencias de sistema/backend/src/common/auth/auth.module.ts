import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AdminGuard, SesionOpcionalGuard } from './admin.guard';
import { EnrolamientoGuard } from './enrolamiento.guard';
import { SesionAdminService } from './sesion-admin.service';
import { TokenEnrolamientoService } from './token-enrolamiento.service';

@Global()
@Module({
  imports: [JwtModule.register({})],
  providers: [SesionAdminService, TokenEnrolamientoService, AdminGuard, SesionOpcionalGuard, EnrolamientoGuard],
  exports: [JwtModule, SesionAdminService, TokenEnrolamientoService, AdminGuard, SesionOpcionalGuard, EnrolamientoGuard],
})
export class AuthModule {}
