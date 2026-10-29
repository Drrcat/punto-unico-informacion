# -*- coding: utf-8 -*-
"""Genera el mapa del tótem (un solo HTML con búsqueda, pisos y zoom) con los ids y nombres de zonas.json.

Parte de un mapa HTML ya construido (el de los SVG de Figma) y le cambia tres cosas: las zonas del dibujo, que
pasan a llamarse como las entradas de zonas.json, la lista ZONAS con los nombres y la geometría, y la conexión con
la API (conexion_api.js): nombres, búsqueda y planos se piden al backend y los datos del archivo quedan de respaldo.
Usa la misma lógica que exportar_planos.py, incluida la lista FILAS para las filas que se rehacen.

Requiere:  pip install playwright lxml   (no abre el navegador: solo lee archivos)

Uso:
    python3 construir_mapa.py MAPA_ORIGINAL.html ZONAS_ORIGINALES.json ZONAS_NUEVAS.json SALIDA.html
"""
import json
import os
import re
import sys

from lxml import etree

import exportar_planos as ep

CAMPOS = ('id', 'piso', 'nombre', 'detalle', 'tipo', 'torre', 'clave')
GEOMETRIA = ('x', 'y', 'w', 'h', 'cx', 'cy', 'ang', 'lw', 'lh')

# Cambios al código del mapa original para conectarlo con la API. Cada texto debe aparecer exactamente una vez.
PARCHES = [
    # Configuración
    ("    inactividadS: 60,                 // en producción viene de configuracion_sistema\n",
     "    inactividadS: 60,                 // en producción viene de configuracion_sistema\n"
     "    apiBase: '',                      // dirección del backend; vacío = el servidor que entrega esta página\n"
     "    edificioId: '',                   // solo si el backend tiene más de un edificio\n"
     "    actualizarS: 30,                  // cada cuántos segundos se vuelven a pedir los nombres a la API\n"),
    ("  if (params.get('sede')) CONFIG.sede = params.get('sede');\n",
     "  if (params.get('sede')) CONFIG.sede = params.get('sede');\n"
     "  // Útiles en demostraciones: ?api=http://servidor:3000   ?api=off   ?actualizar=5   ?estado=1\n"
     "  if (params.get('api') === 'off') CONFIG.apiBase = null;\n"
     "  else if (params.get('api')) CONFIG.apiBase = params.get('api');\n"
     "  else if (location.protocol === 'file:' && !CONFIG.apiBase) CONFIG.apiBase = 'http://localhost:3000';\n"
     "  if (Number(params.get('actualizar')) >= 2) CONFIG.actualizarS = Number(params.get('actualizar'));\n"
     "  if (params.get('edificio')) CONFIG.edificioId = params.get('edificio');\n"),
    ("  // Cada zona sale de los SVG exportados desde Figma. En producción esta lista y\n"
     "  // los nombres vendrán de la API de Infraestructura y Salas (GET /api/salas?piso=N).\n"
     "  // Para renombrar una zona sin tocar el SVG:\n"
     "  //   OrientaMapa.setNombres({ 'P2-S01': 'Sala 201' })\n",
     "  // Cada zona sale de los SVG exportados desde Figma. Esta lista es el respaldo y la fuente de la geometría;\n"
     "  // los nombres, los códigos, los espacios activos, la búsqueda y el dibujo se piden a la API (más abajo, en\n"
     "  // \"conexión con la API\") y reemplazan estos datos en cuanto el backend responde.\n"
     "  // Para renombrar una zona a mano, sin API:  OrientaMapa.setNombres({ 'P2-T1-S01': 'Sala 201' })\n"),
    # Zonas que la API desactiva: se ven atenuadas
    ("  .etq.sel{fill:#fff}\n", "  .etq.sel{fill:#fff}\n  .zona.inactiva{opacity:.45;pointer-events:none}\n"),
    # Etiquetas: sin nombre cuando la zona está desactivada
    ("    t.textContent = nombreDe(z);\n    let size = 9.5;\n",
     "    t.textContent = z.disponible === false ? '' : nombreDe(z);\n    if (z.disponible === false) return;\n    let size = 9.5;\n"),
    # Búsqueda: el turno evita que una respuesta tardía pise una selección más nueva
    ("  let resultados = [], actual = 0;\n", "  let resultados = [], actual = 0, turnoBusqueda = 0;\n"),
    ("    limpiarMarcas(); resultados = []; actual = 0; input.value = '';\n",
     "    turnoBusqueda++;\n    limpiarMarcas(); resultados = []; actual = 0; input.value = '';\n"),
    ("  function seleccionar(lista, idx, mantenerTexto){\n    limpiarMarcas();\n",
     "  function seleccionar(lista, idx, mantenerTexto){\n    turnoBusqueda++;\n    limpiarMarcas();\n"),
    ("    if (g.zonas.some(q => normalizar(q.id).includes(n))) return 3;\n",
     "    if (g.zonas.some(q => normalizar(q.id).includes(n) || (q.codigo && normalizar(q.codigo).includes(n)))) return 3;\n"),
    # La búsqueda del archivo pasa a ser el respaldo de la de la API (buscar está en conexion_api.js)
    ("  function buscar(q){\n    const n = normalizar(q);\n    if (!n){ limpiar(); return; }\n    const hit = GRUPOS.map(g => ({ g, s: puntaje(g, n) })).filter(h => h.s < 9);\n",
     "  function buscarLocal(q){\n    const n = normalizar(q);\n    if (!n){ limpiar(); return; }\n    const hit = GRUPOS.filter(g => g.zonas[0].disponible !== false).map(g => ({ g, s: puntaje(g, n) })).filter(h => h.s < 9);\n"),
    # Tocar una zona desactivada no hace nada
    ("      if (g){ const z = porId.get(g.dataset.id); input.value = nombreDe(z); seleccionar([z.grupo], 0, true); }\n",
     "      const z = g ? porId.get(g.dataset.id) : null;\n      if (z && z.disponible !== false){ input.value = nombreDe(z); seleccionar([z.grupo], 0, true); }\n"),
    # Al volver a la pantalla de inicio se refrescan los datos
    ("    reloj = setTimeout(() => { limpiar(); mostrarPiso(PISO_INICIAL); irA(vistaTodo(), 400); marcarTorre(0); }, CONFIG.inactividadS * 1000);\n",
     "    reloj = setTimeout(() => { limpiar(); mostrarPiso(PISO_INICIAL); irA(vistaTodo(), 400); marcarTorre(0); sincronizar(); }, CONFIG.inactividadS * 1000);\n"),
    # API pública del mapa
    ("    const z = porId.get(id);\n    if (z) return z.grupo;\n    const n = normalizar(id);\n    const cand = GRUPOS.filter(g => normalizar(nombreDe(g.zonas[0])) === n);\n",
     "    const z = porId.get(id);\n    if (z) return z.disponible === false ? null : z.grupo;\n    const n = normalizar(id);\n    const cand = GRUPOS.filter(g => g.zonas[0].disponible !== false && normalizar(nombreDe(g.zonas[0])) === n);\n"),
    ("    zonas: ZONAS.map(z => ({ id: z.id, piso: z.piso, nombre: nombreDe(z), tipo: z.tipo, torre: z.torre })),\n",
     "    get zonas(){ return ZONAS.map(z => ({ id: z.id, piso: z.piso, nombre: nombreDe(z), codigo: z.codigo || null, tipo: z.tipo, torre: z.torre, disponible: z.disponible !== false })); },\n"),
    ("    setNombres: obj => { Object.assign(NOMBRES, obj); ajustarTodas(); }\n  };\n",
     "    setNombres: obj => { Object.assign(NOMBRES, obj); ajustarTodas(); },\n"
     "    actualizar: opciones => { api.ultimoIntento = 0; return sincronizar(opciones); },\n"
     "    get api(){ return { activa: api.activa, conectada: api.conectada, ultima: api.ultima }; }\n  };\n"),
    # Arranque
    ("  ajustarTodas();\n  actividad();\n  const pre = params.get('sala');\n",
     "  ajustarTodas();\n"
     "  if (document.fonts && document.fonts.ready) document.fonts.ready.then(ajustarTodas);   // el texto se mide con la tipografía ya cargada\n"
     "  actividad();\n  conectarApi();\n  const pre = params.get('sala');\n"),
]
MARCA_ARRANQUE = '  // ---------------------------------------------------------------- arranque\n'


def conectar_api(texto):
    """Aplica PARCHES y agrega el bloque de conexion_api.js justo antes del arranque."""
    for viejo, nuevo in PARCHES:
        if texto.count(viejo) != 1:
            raise SystemExit('El mapa original no tiene (o repite) este fragmento, no se puede conectar a la API:\n%s' % viejo)
        texto = texto.replace(viejo, nuevo)
    bloque = open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'conexion_api.js'), encoding='utf-8').read()
    if texto.count(MARCA_ARRANQUE) != 1:
        raise SystemExit('No se encontró el bloque de arranque del mapa original')
    return texto.replace(MARCA_ARRANQUE, bloque + MARCA_ARRANQUE)



def main():
    ruta_html, ruta_viejas, ruta_nuevas, salida = sys.argv[1:5]
    viejas = json.load(open(ruta_viejas, encoding='utf-8'))
    nuevas = json.load(open(ruta_nuevas, encoding='utf-8'))
    viejas_por_id = {o['id']: o for o in viejas}
    mapa = ep.emparejar(viejas, nuevas)
    texto = open(ruta_html, encoding='utf-8').read()

    # Dibujo: las formas de cada zona pasan a colgar del id nuevo
    ini = texto.index('>', texto.index('<svg id="plano"')) + 1
    fin = texto.index('</svg>', ini)
    raiz = etree.fromstring('<root xmlns="%s">%s</root>' % (ep.NS, texto[ini:fin]))
    cajas = {}
    for g_piso in raiz[0]:
        n = int(g_piso.get('data-piso'))
        capa = next(c for c in g_piso if c.get('id') == 'capa-zonas')
        piezas, cajas_piso = ep.asignar_piezas({z.get('data-id'): list(z) for z in capa}, n, nuevas, mapa)
        cajas.update(cajas_piso)
        for e in list(capa):
            capa.remove(e)
        for z in [z for z in nuevas if z['piso'] == n]:
            g = etree.SubElement(capa, '{%s}g' % ep.NS)
            g.set('class', 'zona ' + z['tipo'])
            g.set('data-id', z['id'])
            for e in piezas[z['id']]:
                g.append(e)
    interior = ''.join(etree.tostring(c, encoding='unicode') for c in raiz).replace(' xmlns="%s"' % ep.NS, '')
    texto = texto[:ini] + '\n          ' + interior + '\n        ' + texto[fin:]

    # Lista de zonas: nombres de zonas.json y geometría de las piezas dibujadas
    zonas = []
    for z in nuevas:
        d = {k: z[k] for k in CAMPOS}
        if z['id'] in cajas:
            c = cajas[z['id']]
            d.update(c, cx=round(c['x'] + c['w'] / 2, 2), cy=round(c['y'] + c['h'] / 2, 2), ang=0)
        else:
            o = viejas_por_id[mapa[z['id']][0]]
            d.update({k: o[k] for k in GEOMETRIA if k in o})
        zonas.append(d)
    json_zonas = json.dumps(zonas, ensure_ascii=False, separators=(',', ':'))
    texto, k = re.subn(r'const ZONAS = \[.*?\];\n', lambda _: 'const ZONAS = %s;\n' % json_zonas, texto, count=1, flags=re.S)
    assert k == 1, 'No se encontró la lista ZONAS en el mapa original'

    texto = conectar_api(texto)
    open(salida, 'w', encoding='utf-8').write(texto)
    print('%s: %d zonas, %d bytes' % (salida, len(zonas), len(texto.encode('utf-8'))))


if __name__ == '__main__':
    main()
