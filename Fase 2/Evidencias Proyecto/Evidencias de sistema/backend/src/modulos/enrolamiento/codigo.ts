import { createHmac, randomInt } from 'crypto';
import { igualesSeguro } from '../../common/auth/tokens';

/** Código de seis dígitos, generado con una fuente criptográficamente segura. */
export const generarCodigo = (): string => String(randomInt(0, 1_000_000)).padStart(6, '0');

/**
 * Hash con que se guarda el código. Es un HMAC con una clave que solo existe en el servidor y que incluye
 * el correo, así una copia de la base de datos no permite deducir los códigos probando las 1.000.000 de combinaciones.
 */
export function hashCodigo(clave: string, correo: string, codigo: string): string {
  return createHmac('sha256', clave).update(`${correo.toLowerCase()}:${codigo}`).digest('hex');
}

export function codigoCorrecto(clave: string, correo: string, codigo: string, hashGuardado: string): boolean {
  return igualesSeguro(hashCodigo(clave, correo, codigo), hashGuardado);
}

/** "juan.perez@ejemplo.cl" -> "j***@ejemplo.cl" */
export function enmascararCorreo(correo: string): string {
  const [local, dominio] = correo.split('@');
  return `${local.slice(0, 1)}***@${dominio}`;
}
