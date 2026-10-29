import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENTORNO, Entorno } from '../../config/entorno';
import { noAutorizado } from '../filtros/errores';
import { PrismaService } from '../prisma/prisma.service';
import { hashToken } from './tokens';

export interface AdminActual {
  usuarioId: number;
  correo: string;
  permisos: ReadonlySet<string>;
}

/**
 * Valida la sesión de un administrador. Contrato con el módulo de autenticación (`/api/auth/login`):
 *  - el token es un JWT HS256 firmado con JWT_SECRET, con `sub` = id del usuario y `exp`;
 *  - `sesion_admin.token_hash` guarda el SHA-256 hexadecimal del token completo;
 *  - la sesión es válida si no está revocada ni vencida y el usuario está activo.
 * Los permisos salen de los roles del usuario (`usuario_rol` -> `rol_permiso` -> `permiso`).
 */
@Injectable()
export class SesionAdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  /** Devuelve la sesión si hay encabezado Authorization; `null` si no lo hay; lanza 401 si es inválido. */
  async desdeEncabezado(autorizacion: string | undefined): Promise<AdminActual | null> {
    if (!autorizacion) return null;
    const [esquema, token] = autorizacion.split(' ');
    if (esquema?.toLowerCase() !== 'bearer' || !token) throw noAutorizado('TOKEN_INVALIDO', 'El encabezado Authorization debe ser "Bearer <token>".');

    let payload: { sub?: unknown; scope?: unknown };
    try {
      payload = await this.jwt.verifyAsync(token, { secret: this.entorno.jwtSecret, algorithms: ['HS256'] });
    } catch (e) {
      const vencido = (e as Error).name === 'TokenExpiredError';
      throw noAutorizado(vencido ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO', vencido ? 'La sesión expiró. Inicia sesión de nuevo.' : 'Token inválido.');
    }
    const usuarioId = Number(payload.sub);
    if (!Number.isInteger(usuarioId) || payload.scope === 'enrolamiento') throw noAutorizado('TOKEN_INVALIDO', 'Token inválido.');

    const sesion = await this.prisma.sesion_admin.findUnique({
      where: { token_hash: hashToken(token) },
      include: {
        usuario: {
          include: { usuario_rol_rel: { include: { rol: { include: { rol_permiso_rel: { include: { permiso: true } } } } } } },
        },
      },
    });
    const ahora = new Date();
    if (!sesion || sesion.usuario_id !== usuarioId || sesion.revocada_en || sesion.expira_en <= ahora || !sesion.usuario.activo) {
      throw noAutorizado('SESION_INVALIDA', 'La sesión no es válida o fue cerrada. Inicia sesión de nuevo.');
    }
    const permisos = new Set<string>();
    for (const ur of sesion.usuario.usuario_rol_rel) for (const rp of ur.rol.rol_permiso_rel) permisos.add(rp.permiso.codigo);
    return { usuarioId, correo: sesion.usuario.correo, permisos };
  }
}
