import { Prisma } from '@prisma/client';

/** Forma en que se consulta un espacio para poder indicar dónde queda. */
export const incluirUbicacion = {
  piso: { include: { edificio: true } },
  tipo_espacio: true,
} satisfies Prisma.espacioInclude;

export type EspacioConUbicacion = Prisma.espacioGetPayload<{ include: typeof incluirUbicacion }>;

export const urlPlano = (pisoId: number, ruta: string | null): string | null => (ruta ? `/api/pisos/${pisoId}/plano` : null);

export interface VistaUbicacion {
  sala: { id: number; codigo: string; nombre: string | null; svgElementId: string | null };
  piso: { id: number; numero: number; nombre: string; planoUrl: string | null };
  edificio: { id: number; nombre: string };
}

export function vistaUbicacion(e: EspacioConUbicacion): VistaUbicacion {
  return {
    sala: { id: e.id, codigo: e.codigo, nombre: e.nombre, svgElementId: e.svg_element_id },
    piso: { id: e.piso.id, numero: e.piso.numero, nombre: e.piso.nombre, planoUrl: urlPlano(e.piso.id, e.piso.plano_svg_ruta) },
    edificio: { id: e.piso.edificio.id, nombre: e.piso.edificio.nombre },
  };
}

/** Compara códigos como una persona lo haría: "S2" antes que "S10". */
export const compararNatural = (a: string, b: string): number => a.localeCompare(b, 'es', { numeric: true, sensitivity: 'base' });
