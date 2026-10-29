import { Inject, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ENTORNO, Entorno } from '../../config/entorno';
import { noAutorizado } from '../filtros/errores';
import { claveEnrolamiento } from './tokens';

/** Token de corta duración que se entrega al verificar el correo y autoriza `POST /api/enrolamiento/:id/foto`. */
@Injectable()
export class TokenEnrolamientoService {
  private readonly clave: string;

  constructor(
    private readonly jwt: JwtService,
    @Inject(ENTORNO) entorno: Entorno,
  ) {
    this.clave = claveEnrolamiento(entorno.jwtSecret);
  }

  emitir(enrolamientoId: number, vigenciaMin: number): Promise<string> {
    return this.jwt.signAsync({ sub: String(enrolamientoId), scope: 'enrolamiento' }, { secret: this.clave, algorithm: 'HS256', expiresIn: `${vigenciaMin}m` });
  }

  /** Devuelve el id del enrolamiento autorizado por el token. */
  async verificar(token: string): Promise<number> {
    try {
      const p = await this.jwt.verifyAsync<{ sub?: string; scope?: string }>(token, { secret: this.clave, algorithms: ['HS256'] });
      const id = Number(p.sub);
      if (p.scope !== 'enrolamiento' || !Number.isInteger(id)) throw new Error('alcance');
      return id;
    } catch (e) {
      const vencido = (e as Error).name === 'TokenExpiredError';
      throw noAutorizado(vencido ? 'TOKEN_EXPIRADO' : 'TOKEN_INVALIDO', vencido ? 'El tiempo para completar el enrolamiento terminó. Vuelve a empezar.' : 'No tienes autorización para esta solicitud de enrolamiento.');
    }
  }
}
