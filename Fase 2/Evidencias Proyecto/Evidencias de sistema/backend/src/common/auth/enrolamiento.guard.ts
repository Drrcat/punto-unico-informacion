import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { noAutorizado, prohibido } from '../filtros/errores';
import { TokenEnrolamientoService } from './token-enrolamiento.service';

/** Exige el token entregado al verificar el correo y que corresponda al enrolamiento de la ruta (`:id`). */
@Injectable()
export class EnrolamientoGuard implements CanActivate {
  constructor(private readonly tokens: TokenEnrolamientoService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<Request>();
    const [esquema, token] = (req.headers.authorization ?? '').split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) throw noAutorizado('NO_AUTENTICADO', 'Falta verificar el correo institucional.');
    const id = await this.tokens.verificar(token);
    if (String(id) !== String(req.params.id)) throw prohibido('ENROLAMIENTO_AJENO', 'El token no corresponde a esta solicitud.');
    return true;
  }
}
