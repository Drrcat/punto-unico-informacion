import { CanActivate, createParamDecorator, ExecutionContext, Injectable, SetMetadata } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import { noAutorizado, prohibido } from '../filtros/errores';
import { AdminActual, SesionAdminService } from './sesion-admin.service';

const CLAVE_PERMISOS = 'permisos_requeridos';

/** Exige una sesión de administrador y, si se indican, todos los permisos listados. */
export const Permisos = (...codigos: string[]) => SetMetadata(CLAVE_PERMISOS, codigos);

type ConAdmin = Request & { admin?: AdminActual };

/** Administrador autenticado de la solicitud (o `undefined` en rutas con sesión opcional). */
export const Admin = createParamDecorator((_: unknown, ctx: ExecutionContext): AdminActual | undefined => ctx.switchToHttp().getRequest<ConAdmin>().admin);

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    private readonly sesiones: SesionAdminService,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ConAdmin>();
    const admin = await this.sesiones.desdeEncabezado(req.headers.authorization);
    if (!admin) throw noAutorizado('NO_AUTENTICADO', 'Esta acción requiere iniciar sesión como administrador.');
    const requeridos = this.reflector.getAllAndOverride<string[]>(CLAVE_PERMISOS, [ctx.getHandler(), ctx.getClass()]) ?? [];
    const faltan = requeridos.filter((p) => !admin.permisos.has(p));
    if (faltan.length) throw prohibido('SIN_PERMISO', `Tu rol no incluye el permiso necesario (${faltan.join(', ')}).`);
    req.admin = admin;
    return true;
  }
}

/** Rutas públicas que muestran más datos a un administrador: sin encabezado pasa, con encabezado inválido responde 401. */
@Injectable()
export class SesionOpcionalGuard implements CanActivate {
  constructor(private readonly sesiones: SesionAdminService) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest<ConAdmin>();
    const admin = await this.sesiones.desdeEncabezado(req.headers.authorization);
    if (admin) req.admin = admin;
    return true;
  }
}
