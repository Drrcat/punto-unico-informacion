import { createHash, createHmac, timingSafeEqual } from 'crypto';

/** Hash con que se guarda un token de sesión en `sesion_admin.token_hash`: SHA-256 en hexadecimal. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

/** Clave propia para los tokens de enrolamiento, derivada de JWT_SECRET: un token de administrador no sirve aquí ni al revés. */
export function claveEnrolamiento(jwtSecret: string): string {
  return createHmac('sha256', jwtSecret).update('orientasede:enrolamiento').digest('hex');
}

/** Clave para el hash de los códigos de verificación. */
export function claveCodigos(jwtSecret: string): string {
  return createHmac('sha256', jwtSecret).update('orientasede:codigos').digest('hex');
}

export function igualesSeguro(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  return ba.length === bb.length && timingSafeEqual(ba, bb);
}
