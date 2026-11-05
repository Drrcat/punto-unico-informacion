import { HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { hashToken } from '../../common/auth/tokens';
import { ConfiguracionService } from '../../common/configuracion/configuracion.service';
import { ErrorNegocio, noAutorizado, prohibido } from '../../common/filtros/errores';
import { PrismaService } from '../../common/prisma/prisma.service';
import { ENTORNO, Entorno } from '../../config/entorno';

const CREDENCIALES_INVALIDAS = () => noAutorizado('CREDENCIALES_INVALIDAS', 'Correo o contraseña incorrectos.');

export interface SesionIniciada {
  token: string;
  expiraEn: string;
  usuario: { id: number; correo: string; nombres: string; apellidos: string; permisos: string[] };
}

/**
 * Inicio y cierre de sesión del personal administrativo. Emite el token que valida `SesionAdminService`:
 * JWT HS256 con `sub` = id del usuario, y una fila en `sesion_admin` con el SHA-256 del token.
 * Tras `login_max_intentos` contraseñas incorrectas seguidas, la cuenta se bloquea `login_bloqueo_min` minutos.
 */
@Injectable()
export class AuthService {
  private readonly log = new Logger('Auth');
  /** Hash de relleno: cuando el correo no existe se compara igual, para no revelar por el tiempo de respuesta qué correos existen. */
  private hashRelleno?: Promise<string>;

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfiguracionService,
    @Inject(ENTORNO) private readonly entorno: Entorno,
  ) {}

  async login(correoIngresado: string, clave: string): Promise<SesionIniciada> {
    const correo = correoIngresado.trim().toLowerCase();
    const usuario = await this.prisma.usuario.findUnique({
      where: { correo },
      include: { usuario_rol_rel: { include: { rol: { include: { rol_permiso_rel: { include: { permiso: true } } } } } } },
    });

    if (!usuario || !usuario.activo || !usuario.clave_hash) {
      await bcrypt.compare(clave, await this.relleno());
      throw CREDENCIALES_INVALIDAS();
    }

    const ahora = new Date();
    if (usuario.bloqueado_hasta && usuario.bloqueado_hasta > ahora) throw this.bloqueada(usuario.bloqueado_hasta);

    if (!(await bcrypt.compare(clave, usuario.clave_hash))) {
      const [maxIntentos, bloqueoMin] = await Promise.all([this.config.entero('login_max_intentos'), this.config.entero('login_bloqueo_min')]);
      const { intentos_fallidos } = await this.prisma.usuario.update({
        where: { id: usuario.id },
        data: { intentos_fallidos: { increment: 1 } },
        select: { intentos_fallidos: true },
      });
      if (maxIntentos > 0 && intentos_fallidos >= maxIntentos) {
        const hasta = new Date(ahora.getTime() + Math.max(bloqueoMin, 1) * 60_000);
        await this.prisma.usuario.update({ where: { id: usuario.id }, data: { intentos_fallidos: 0, bloqueado_hasta: hasta } });
        this.log.warn(`Cuenta ${usuario.id} bloqueada hasta ${hasta.toISOString()} por ${intentos_fallidos} contraseñas incorrectas.`);
        throw this.bloqueada(hasta);
      }
      throw CREDENCIALES_INVALIDAS();
    }

    const permisos = new Set<string>();
    for (const ur of usuario.usuario_rol_rel) for (const rp of ur.rol.rol_permiso_rel) permisos.add(rp.permiso.codigo);
    if (permisos.size === 0) throw prohibido('SIN_PERMISO', 'Tu cuenta no tiene permisos para usar el panel de administración.');

    const horas = Math.max(await this.config.entero('sesion_admin_horas'), 1);
    const expira = new Date(ahora.getTime() + horas * 3_600_000);
    const token = await this.jwt.signAsync({ sub: String(usuario.id) }, { secret: this.entorno.jwtSecret, algorithm: 'HS256', expiresIn: horas * 3600 });
    await this.prisma.$transaction([
      this.prisma.sesion_admin.create({ data: { usuario_id: usuario.id, token_hash: hashToken(token), expira_en: expira } }),
      this.prisma.usuario.update({ where: { id: usuario.id }, data: { intentos_fallidos: 0, bloqueado_hasta: null } }),
    ]);

    return {
      token,
      expiraEn: expira.toISOString(),
      usuario: { id: usuario.id, correo: usuario.correo, nombres: usuario.nombres, apellidos: usuario.apellidos, permisos: [...permisos].sort() },
    };
  }

  /** Revoca la sesión del token. El guard ya comprobó que es válida. */
  async logout(autorizacion: string): Promise<void> {
    const token = autorizacion.split(' ')[1] ?? '';
    await this.prisma.sesion_admin.updateMany({ where: { token_hash: hashToken(token), revocada_en: null }, data: { revocada_en: new Date() } });
  }

  async perfil(usuarioId: number, permisos: ReadonlySet<string>) {
    const u = await this.prisma.usuario.findUniqueOrThrow({ where: { id: usuarioId }, select: { id: true, correo: true, nombres: true, apellidos: true } });
    return { ...u, permisos: [...permisos].sort() };
  }

  private bloqueada(hasta: Date): ErrorNegocio {
    const minutos = Math.max(1, Math.ceil((hasta.getTime() - Date.now()) / 60_000));
    return new ErrorNegocio(HttpStatus.TOO_MANY_REQUESTS, 'CUENTA_BLOQUEADA', `Demasiados intentos fallidos. Intenta de nuevo en ${minutos} minuto${minutos === 1 ? '' : 's'}.`, {
      bloqueadaHasta: hasta.toISOString(),
    });
  }

  private relleno(): Promise<string> {
    this.hashRelleno ??= bcrypt.hash('relleno-sin-uso', 12);
    return this.hashRelleno;
  }
}
