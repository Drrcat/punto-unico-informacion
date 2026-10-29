# -*- coding: utf-8 -*-
"""Exporta un SVG independiente por piso (piso-2.svg, piso-3.svg) a partir del mapa HTML del edificio.

Cada espacio queda como un <g id="..."> con el mismo id que el campo "id" de zonas.json, que es el que
la base de datos guarda en espacio.svg_element_id. Las entradas de zonas.json con la misma "clave" son un
solo espacio y quedan agrupadas bajo el id de la primera.

Como el mapa HTML conserva los ids con que se dibujó, el script necesita saber a qué id nuevo corresponde cada
pieza. Lo resuelve por "clave" (piso + clave). Cuando una fila del dibujo se rehace (por ejemplo, porque tiene
más o menos salas que cuadros) se declara en FILAS: sus cuadros se reparten en partes iguales entre los mismos
límites y se asignan, de izquierda a derecha, a los ids nuevos indicados.

Requiere:  pip install playwright lxml  &&  playwright install chromium

Uso:
    python3 exportar_planos.py MAPA.html ZONAS_ORIGINALES.json ZONAS_NUEVAS.json CARPETA_SALIDA
      MAPA.html             mapa del edificio generado a partir de los SVG de Figma
      ZONAS_ORIGINALES.json zonas con los ids con que se dibujó el mapa (incluye x, y, w, h)
      ZONAS_NUEVAS.json     database/prisma/seed/zonas.json, con los ids definitivos
      CARPETA_SALIDA        por ejemplo frontend-web/assets/planos
"""
import json
import os
import re
import sys

from lxml import etree
from playwright.sync_api import sync_playwright

NS = 'http://www.w3.org/2000/svg'
VIEWBOX = '0 0 1589 444'

# Filas del dibujo que se rehacen. "viejos": cuadros dibujados, en cualquier orden. "nuevos": ids definitivos,
# de izquierda a derecha. Torre 3, fila inferior del piso 3: el dibujo tenía 7 cuadros y la fila tiene 8 salas.
FILAS = [
    {
        'piso': 3,
        'viejos': ['P3-PA-LMPE', 'P3-PA-LIE', 'P3-PA-324', 'P3-PA-323', 'P3-PA-323-2', 'P3-PA-321', 'P3-PA-321-2'],
        'nuevos': ['P3-T3-S29', 'P3-T3-S30', 'P3-T3-S31', 'P3-T3-S32', 'P3-T3-S33', 'P3-T3-S34', 'P3-T3-S35', 'P3-T3-S36'],
    },
]

ESTILO = """
.plano-piso{background:transparent}
.plano-piso .circulacion{fill:#FAFBFC}
.plano-piso .borde,.plano-piso .borde *{opacity:.45;vector-effect:non-scaling-stroke}
.plano-piso .vidrio{fill:#6DBAD0;stroke:#6DBAD0;stroke-width:1px;vector-effect:non-scaling-stroke;opacity:.7}
.plano-piso .deco{fill:#9AA9B3;opacity:.6}
.plano-piso .zona *{vector-effect:non-scaling-stroke}
.plano-piso .zona.sala .base{fill:#D6E1E7;stroke:#667F8D;stroke-width:1px}
.plano-piso .zona.bano .base{fill:#CDE9E0;stroke:#2F8F78;stroke-width:1px}
.plano-piso .zona.escalera *,.plano-piso .zona.ascensor *{fill:none;stroke:#5E67A8;stroke-width:.6px}
.plano-piso .zona.escalera .base,.plano-piso .zona.ascensor .base{fill:#E3E6F4;stroke-width:1px}
.plano-piso .zona .rel{stroke:none}
.plano-piso .zona.ascensor .rel{fill:#5E67A8}
.plano-piso .zona.terraza *{fill:none;stroke:none}
.plano-piso .zona.terraza line{stroke:#B98A3C;stroke-width:.6px;opacity:.45}
.plano-piso .zona.terraza .rel{fill:#B98A3C;opacity:.45}
.plano-piso .zona.terraza .base{fill:#F4E9D6;stroke:#B98A3C;stroke-width:1px}
.plano-piso .zona.destacada .base{fill:#FFE1D2 !important;stroke:#D9430E !important}
.plano-piso .zona.seleccionada .base{fill:#D9430E !important;stroke:#7A2205 !important;stroke-width:2.2px !important}
""".strip()


def emparejar(viejas, nuevas):
    """Devuelve {id_nuevo: [ids_viejos]} por clave, descontando las filas que se rehacen."""
    consumidos_viejos = {v for f in FILAS for v in f['viejos']}
    en_filas_nuevas = {n for f in FILAS for n in f['nuevos']}
    mapa = {}
    usados = set()
    for z in nuevas:
        if z['id'] in en_filas_nuevas:
            continue
        candidatas = [o for o in viejas if o['piso'] == z['piso'] and o['clave'] == z['clave'] and o['id'] not in consumidos_viejos]
        if len(candidatas) != 1:
            raise SystemExit('%s (clave %r): se esperaba 1 pieza dibujada y hay %d. Si cambiaste la clave, '
                             'agrega esa fila a FILAS.' % (z['id'], z['clave'], len(candidatas)))
        mapa[z['id']] = [candidatas[0]['id']]
        usados.add(candidatas[0]['id'])
    sobran = [o['id'] for o in viejas if o['id'] not in usados and o['id'] not in consumidos_viejos]
    if sobran:
        raise SystemExit('Piezas dibujadas que ninguna entrada de zonas.json usa: %s' % sobran)
    return mapa


def cuadros_de_fila(fila, piezas_html):
    """Reparte en partes iguales el tramo que ocupaban los cuadros viejos.
    Devuelve ({id_nuevo: [elementos]}, {id_nuevo: caja}) con la caja como dict x, y, w, h."""
    xs, y_arriba, y_abajo = [], None, None
    for vid in fila['viejos']:
        d = piezas_html[vid][0].get('d')
        nums = [float(n) for n in re.findall(r'-?\d+(?:\.\d+)?', d)]
        # Cuadros dibujados como "M x1 y2 H x0 V y1 H x1 V y2 Z"
        x0, x1 = min(nums[0], nums[2]), max(nums[0], nums[2])
        xs += [x0, x1]
        y_abajo, y_arriba = max(nums[1], nums[3]), min(nums[1], nums[3])
    izq, der, n = min(xs), max(xs), len(fila['nuevos'])
    ancho = (der - izq) / n
    cuadros, cajas = {}, {}
    f = lambda v: ('%.3f' % v).rstrip('0').rstrip('.')
    for i, nid in enumerate(fila['nuevos']):
        a, b = izq + i * ancho, izq + (i + 1) * ancho
        d = 'M%s %sH%sV%sH%sV%sZ' % (f(b), f(y_abajo), f(a), f(y_arriba), f(b), f(y_abajo))
        cuadros[nid] = [etree.fromstring('<path xmlns="%s" class="base" d="%s"/>' % (NS, d))]
        cajas[nid] = {'x': round(a, 2), 'y': round(y_arriba, 2), 'w': round(ancho, 2), 'h': round(y_abajo - y_arriba, 2)}
    return cuadros, cajas


def asignar_piezas(piezas_html, n, nuevas, mapa):
    """{id_nuevo: [elementos]} de todas las entradas del piso n. Consume piezas_html (id viejo -> elementos)
    y devuelve además las cajas de los cuadros que se rehicieron."""
    piezas = {nid: [e for vid in vids for e in piezas_html.pop(vid)] for nid, vids in mapa.items()
              if any(z['id'] == nid and z['piso'] == n for z in nuevas)}
    cajas = {}
    for fila in [f for f in FILAS if f['piso'] == n]:
        cuadros, cj = cuadros_de_fila(fila, piezas_html)
        piezas.update(cuadros)
        cajas.update(cj)
        for vid in fila['viejos']:
            piezas_html.pop(vid)
    assert not piezas_html, 'Quedaron piezas sin id nuevo: %s' % list(piezas_html)
    return piezas, cajas


def cargar_pisos_html(html, numeros):
    """Marcado de cada piso (#piso-N) del mapa HTML, sin las etiquetas de texto."""
    with sync_playwright() as p:
        b = p.chromium.launch()
        pg = b.new_page()
        pg.goto('file://' + os.path.abspath(html))
        pisos = {n: pg.evaluate("""n => { const g = document.querySelector('#piso-' + n).cloneNode(true);
            g.querySelectorAll('.etqs').forEach(e => e.remove()); return g.outerHTML; }""", n) for n in numeros}
        b.close()
    return pisos


def main():
    html, ruta_viejas, ruta_nuevas, salida = sys.argv[1:5]
    viejas = json.load(open(ruta_viejas, encoding='utf-8'))
    nuevas = json.load(open(ruta_nuevas, encoding='utf-8'))
    mapa = emparejar(viejas, nuevas)
    os.makedirs(salida, exist_ok=True)
    pisos = cargar_pisos_html(html, sorted({z['piso'] for z in nuevas}))

    for n, markup in pisos.items():
        g = etree.fromstring(markup.replace('<g ', '<g xmlns="%s" ' % NS, 1))
        capas = {c.get('id'): c for c in g if isinstance(c.tag, str)}
        capa_zonas = capas['capa-zonas']
        piezas, _ = asignar_piezas({pz.get('data-id'): list(pz) for pz in capa_zonas}, n, nuevas, mapa)

        # Un grupo por clave, bajo el id de la primera entrada (igual que la carga inicial)
        grupos = {}
        for z in [z for z in nuevas if z['piso'] == n]:
            grupos.setdefault(z['clave'], []).append(z)
        for e in list(capa_zonas):
            capa_zonas.remove(e)
        for zs in grupos.values():
            tipo = zs[0]['tipo']
            assert all(z['tipo'] == tipo for z in zs), zs[0]['clave']
            nuevo = etree.SubElement(capa_zonas, '{%s}g' % NS, id=zs[0]['id'])
            nuevo.set('class', 'zona ' + tipo)
            if len(zs) > 1:
                nuevo.set('data-piezas', ' '.join(z['id'] for z in zs))
            for z in zs:
                for e in piezas[z['id']]:
                    nuevo.append(e)

        raiz = etree.Element('{%s}svg' % NS, nsmap={None: NS})
        raiz.set('viewBox', VIEWBOX)
        raiz.set('class', 'plano-piso')
        raiz.set('role', 'img')
        raiz.set('aria-label', 'Plano del piso %d' % n)
        est = etree.SubElement(raiz, '{%s}style' % NS)
        est.text = '\n' + ESTILO + '\n'
        g.attrib.pop('class', None)
        g.attrib.pop('data-piso', None)
        raiz.append(g)

        ids = [e.get('id') for e in raiz.iter() if e.get('id')]
        assert len(ids) == len(set(ids)), [i for i in ids if ids.count(i) > 1]
        destino = os.path.join(salida, 'piso-%d.svg' % n)
        with open(destino, 'w', encoding='utf-8') as f:
            f.write('<?xml version="1.0" encoding="UTF-8"?>\n' + etree.tostring(raiz, encoding='unicode') + '\n')
        print('piso %d -> %s (%d bytes, %d espacios)' % (n, destino, os.path.getsize(destino), len(grupos)))


if __name__ == '__main__':
    main()
