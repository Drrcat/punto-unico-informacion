import { readFileSync } from 'fs';
import * as path from 'path';

/**
 * Los planos SVG y la carga inicial se generan por separado: este test verifica que sigan coincidiendo.
 * Si falla, hay que volver a exportar los planos o ajustar `database/prisma/seed/zonas.json`.
 */
const RAIZ = path.resolve(__dirname, '../../..');
interface Zona { piso: number; id: string; clave: string; tipo: string }
const zonas: Zona[] = JSON.parse(readFileSync(path.join(RAIZ, 'database/prisma/seed/zonas.json'), 'utf8'));

/** Un espacio por (piso, clave); su `svg_element_id` es el id de la primera pieza. */
function espaciosDelPiso(piso: number): string[] {
  const vistos = new Map<string, string>();
  for (const z of zonas.filter((x) => x.piso === piso)) if (!vistos.has(z.clave)) vistos.set(z.clave, z.id);
  return [...vistos.values()];
}

describe.each([2, 3])('plano del piso %i', (piso) => {
  const svg = readFileSync(path.join(RAIZ, `frontend-web/front-end/assets/planos/piso-${piso}.svg`), 'utf8');
  const ids = [...svg.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);

  it('contiene un elemento con el id de cada espacio de la carga inicial', () => {
    const faltan = espaciosDelPiso(piso).filter((id) => !ids.includes(id));
    expect(faltan).toEqual([]);
  });

  it('no repite ids y cada espacio es un solo grupo', () => {
    expect(new Set(ids).size).toBe(ids.length);
    const grupos = [...svg.matchAll(/<g id="([^"]+)" class="zona /g)].map((m) => m[1]);
    expect(grupos.sort()).toEqual(espaciosDelPiso(piso).sort());
  });

  it('es un SVG autónomo y sin código activo', () => {
    expect(svg).toContain('viewBox="0 0 1589 444"');
    expect(svg).not.toMatch(/<script|\son[a-z]+=|href=|<image|<foreignObject/i);
  });
});
