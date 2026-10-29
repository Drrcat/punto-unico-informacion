import { EstadoEnrolamiento } from '@prisma/client';
import { conflicto } from '../../common/filtros/errores';

/**
 * Transiciones válidas del enrolamiento. Un estado final (COMPLETADO, CANCELADO) no vuelve atrás;
 * FALLIDO solo permite reintentar (con la copia de la foto que se conserva) o cancelar.
 */
export const TRANSICIONES: Record<EstadoEnrolamiento, EstadoEnrolamiento[]> = {
  INICIADO: ['FOTO_PENDIENTE', 'FALLIDO', 'CANCELADO'],
  FOTO_PENDIENTE: ['COMPLETADO', 'FALLIDO', 'CANCELADO'],
  FALLIDO: ['FOTO_PENDIENTE', 'CANCELADO'],
  COMPLETADO: [],
  CANCELADO: [],
};

export const puedeTransicionar = (desde: EstadoEnrolamiento, hacia: EstadoEnrolamiento): boolean => TRANSICIONES[desde].includes(hacia);

/** Estados desde los que se puede llegar a `hacia`: sirve para que la base haga el cambio de forma atómica. */
export const origenesPosibles = (hacia: EstadoEnrolamiento): EstadoEnrolamiento[] =>
  (Object.keys(TRANSICIONES) as EstadoEnrolamiento[]).filter((e) => TRANSICIONES[e].includes(hacia));

export function exigirTransicion(desde: EstadoEnrolamiento, hacia: EstadoEnrolamiento): void {
  if (!puedeTransicionar(desde, hacia)) {
    throw conflicto('TRANSICION_INVALIDA', `Una solicitud en estado ${desde} no puede pasar a ${hacia}.`, { desde, hacia });
  }
}
