import { readFileSync } from 'fs';
import * as path from 'path';

/**
 * El mapa del tótem lleva el dibujo de los pisos dentro del propio archivo (es el respaldo si la API no responde)
 * y los planos SVG que entrega la API salen de la misma exportación. Este test verifica que sigan siendo el mismo
 * dibujo y que la lista de zonas del mapa sea la de `zonas.json`.
 * Si falla, hay que volver a generar el mapa y los planos con `herramientas/construir_mapa.py` y `exportar_planos.py`.
 */
const RAIZ = path.resolve(__dirname, '../../..');
interface Zona { piso: number; id: string; tipo: string; nombre: string }
const zonas: Zona[] = JSON.parse(readFileSync(path.join(RAIZ, 'database/prisma/seed/zonas.json'), 'utf8'));
const html = readFileSync(path.join(RAIZ, 'frontend-web/front-end/mapa-totem.html'), 'utf8');
const zonasDelMapa: Zona[] = JSON.parse(/const ZONAS = (\[.*?\]);\n/s.exec(html)?.[1] ?? '[]');

const normalizar = (s: string) => s.replace(/\s+/g, ' ').trim();

describe('mapa del tótem', () => {
  it('lista las mismas zonas que zonas.json, con sus nombres y tipos', () => {
    expect(zonasDelMapa.map((z) => [z.piso, z.id, z.nombre, z.tipo])).toEqual(zonas.map((z) => [z.piso, z.id, z.nombre, z.tipo]));
  });

  it('dibuja una forma por cada zona, con su tipo', () => {
    const dibujadas = [...html.matchAll(/<g class="zona (\w+)" data-id="([^"]+)">/g)].map((m) => [m[2], m[1]]);
    expect(dibujadas.sort()).toEqual(zonas.map((z) => [z.id, z.tipo]).sort());
  });

  it('incluye la conexión con la API y conserva los datos del archivo como respaldo', () => {
    for (const ruta of ['/api/pisos', '/api/salas?limite=100&q=']) expect(html).toContain(ruta);
    expect(html).toContain('conectarApi();');
    expect(html).toContain('function buscarLocal(q)');
  });

  describe.each([2, 3])('piso %i', (piso) => {
    const svg = readFileSync(path.join(RAIZ, `frontend-web/front-end/assets/planos/piso-${piso}.svg`), 'utf8');
    const delSvg = new Map([...svg.matchAll(/<g id="([^"]+)" class="zona (\w+)"[^>]*>(.*?)<\/g>/gs)].map((m) => [m[1], { tipo: m[2], dibujo: normalizar(m[3]) }]));
    const delMapa = new Map([...html.matchAll(/<g class="zona (\w+)" data-id="([^"]+)">(.*?)<\/g>/gs)].map((m) => [m[2], { tipo: m[1], dibujo: normalizar(m[3]) }]));

    it('el plano que entrega la API dibuja las mismas formas que el mapa', () => {
      for (const z of zonas.filter((x) => x.piso === piso)) {
        expect(delSvg.get(z.id)?.dibujo).toBeTruthy();
        expect({ id: z.id, ...delSvg.get(z.id) }).toEqual({ id: z.id, ...delMapa.get(z.id) });
      }
    });
  });
});
