# -*- coding: utf-8 -*-
"""Prueba el mapa del tótem contra un backend real, con un navegador (Chromium de Playwright).

Comprueba que el mapa tome de la API los nombres, la búsqueda y los planos, que un cambio de nombre o la
desactivación de una sala se vea sin recargar, y que sin API siga funcionando con los datos del archivo.
Cambia datos de la base (renombra y desactiva salas) y los devuelve al terminar.

Requiere:  pip install playwright && playwright install chromium
           un backend en marcha con la carga inicial hecha (npm run seed), servido con PUBLIC_DIR=../frontend-web/front-end

Uso (desde backend/):
    TOKEN=$(npm run -s token:admin admin@ejemplo.cl) python3 herramientas/probar_mapa.py
    BASE_URL=http://localhost:3000 es el valor por defecto; CAPTURAS=carpeta guarda una imagen de cada paso.
"""
import atexit, json, os, sys, urllib.request
from playwright.sync_api import sync_playwright

BASE = os.environ.get('BASE_URL', 'http://localhost:3000').rstrip('/')
TOKEN = os.environ.get('TOKEN')
CAPTURAS = os.environ.get('CAPTURAS')
if not TOKEN:
    sys.exit('Falta TOKEN (npm run -s token:admin correo@del.administrador)')
if CAPTURAS:
    os.makedirs(CAPTURAS, exist_ok=True)

def captura(pg, nombre):
    if CAPTURAS:
        pg.screenshot(path=os.path.join(CAPTURAS, nombre + '.png'))

def api(metodo, ruta, cuerpo=None):
    req = urllib.request.Request(BASE + ruta, method=metodo, data=json.dumps(cuerpo).encode() if cuerpo is not None else None,
                                 headers={'Content-Type': 'application/json', 'Authorization': 'Bearer ' + TOKEN})
    with urllib.request.urlopen(req) as r:
        t = r.read().decode()
        return json.loads(t) if t else None

resultados = []
def ok(nombre, cond, extra=''):
    resultados.append((nombre, bool(cond)))
    print(('OK   ' if cond else 'FALLA'), nombre, extra)

pisos = {x['numero']: x for x in api('GET', '/api/pisos')}
ID2, ID3 = pisos[2]['id'], pisos[3]['id']
sala03 = next(e for e in api('GET', '/api/pisos/%d' % ID2)['espacios'] if e['svgElementId'] == 'P2-T1-S03')
pa326 = next(e for e in api('GET', '/api/pisos/%d' % ID3)['espacios'] if e['svgElementId'] == 'P3-T3-S31')
print('sala 03 -> espacio', sala03['id'], '| PA-326 -> espacio', pa326['id'])

def restaurar():
    """Deja las dos salas como estaban, aunque la prueba falle a la mitad."""
    api('PUT', '/api/salas/%d' % sala03['id'], {'nombre': 'Sala 03', 'alias': []})
    api('PUT', '/api/salas/%d' % pa326['id'], {'activo': True})
atexit.register(restaurar)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 560, 'height': 980})
    pg = ctx.new_page()
    errores, pedidos = [], []
    pg.on('console', lambda m: errores.append(m.text) if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errores.append('pageerror: ' + str(e)))
    pg.on('request', lambda r: pedidos.append(r.url.replace(BASE, '')) if '/api/' in r.url else None)

    # 1) Arranque conectado
    pg.goto(BASE + '/mapa-totem.html?estado=1&actualizar=3')
    pg.wait_for_function("document.body.dataset.api === 'conectada'", timeout=8000)
    pg.wait_for_timeout(500)
    ok('estado conectada', pg.evaluate("document.body.dataset.api") == 'conectada')
    for ruta in ('/api/pisos', '/api/pisos/%d' % ID2, '/api/pisos/%d' % ID3, '/api/pisos/%d/plano' % ID2, '/api/pisos/%d/plano' % ID3):
        ok('pide ' + ruta, ruta in pedidos)
    sin_el = pg.evaluate("OrientaMapa.zonas.filter(z => !document.querySelector('.zona[data-id=\"' + z.id + '\"]')).map(z => z.id)")
    ok('todas las zonas tienen dibujo', not sin_el, str(sin_el))
    n_etq = pg.evaluate("document.querySelectorAll('.etq').length")
    ok('etiquetas presentes', n_etq > 60, str(n_etq))
    ok('el dibujo vino de la API (ids sin duplicar)', pg.evaluate("document.querySelectorAll('[id^=\"P2-\"],[id^=\"P3-\"]').length") == 0)
    ok('sin errores de consola', not errores, str(errores))
    captura(pg, '1_inicio')

    # 2) Búsqueda por la API
    pedidos.clear()
    pg.fill('#buscador', 'PA-326'); pg.wait_for_timeout(700)
    sel = pg.evaluate("[...document.querySelectorAll('.zona.sel')].map(e => e.getAttribute('data-id'))")
    ok('búsqueda PA-326 usa la API', any(u.startswith('/api/salas?') and 'PA-326' in u for u in pedidos), str(pedidos))
    ok('PA-326 selecciona P3-T3-S31', sel == ['P3-T3-S31'], str(sel))
    ok('abre el piso 3', pg.evaluate('OrientaMapa.piso') == 3)
    pg.fill('#buscador', 'wc'); pg.wait_for_timeout(700)
    ok("'wc' se traduce a 'Baño' en la API", any('q=Ba%C3%B1o' in u for u in pedidos), str([u for u in pedidos if 'salas' in u][-1:]))
    ok("'wc' encuentra baños", pg.evaluate("document.querySelectorAll('.zona.bano.sel, .zona.bano.match').length") >= 3)
    pg.fill('#buscador', 'ascensores'); pg.wait_for_timeout(700)
    ok("'ascensores' encuentra ascensores", pg.evaluate("document.querySelectorAll('.zona.ascensor.sel, .zona.ascensor.match').length") >= 3)
    pg.fill('#buscador', 'zzzzqqq'); pg.wait_for_timeout(700)
    ok('sin resultados', 'sin-resultado' in pg.evaluate("document.getElementById('destino').className"))
    pg.fill('#buscador', 'laboratorio'); pg.wait_for_timeout(700)   # alias "Laboratorio de Autotrónica"
    sel = pg.evaluate("[...document.querySelectorAll('.zona.sel')].map(e => e.getAttribute('data-id'))")
    ok("'laboratorio' encuentra PA-LATI por su alias", sel == ['P3-T2-S13'], str(sel))
    pg.click('#borrar'); pg.wait_for_timeout(200)

    # 3) Renombrar por la API y ver el cambio en el mapa
    pg.evaluate("OrientaMapa.setPiso(2)")
    api('PUT', '/api/salas/%d' % sala03['id'], {'nombre': 'Laboratorio de Redes', 'alias': ['Sala 03']})
    pg.wait_for_function("OrientaMapa.zonas.find(z => z.id === 'P2-T1-S03').nombre === 'Laboratorio de Redes'", timeout=9000)
    etiqueta = pg.evaluate("""(() => { const z = [...document.querySelectorAll('.etqs .etq')].find(t => t.textContent === 'Laboratorio de Redes'); return z ? z.textContent : null; })()""")
    ok('el cambio de nombre llega al mapa sin recargar', etiqueta == 'Laboratorio de Redes', str(etiqueta))
    captura(pg, '2_renombrada')
    pg.fill('#buscador', 'sala 03'); pg.wait_for_timeout(700)
    sel = pg.evaluate("[...document.querySelectorAll('.zona.sel')].map(e => e.getAttribute('data-id'))")
    ok("buscar el alias 'Sala 03' encuentra la sala renombrada", sel == ['P2-T1-S03'], str(sel))
    titulo = pg.evaluate("document.querySelector('#destino .d-texto strong').textContent")
    ok('la tarjeta muestra el nombre nuevo', titulo == 'Laboratorio de Redes', titulo)
    api('PUT', '/api/salas/%d' % sala03['id'], {'nombre': 'Sala 03', 'alias': []})
    pg.wait_for_function("OrientaMapa.zonas.find(z => z.id === 'P2-T1-S03').nombre === 'Sala 03'", timeout=9000)
    ok('se restaura el nombre', True)
    pg.click('#borrar')

    # 4) Desactivar un espacio
    api('PUT', '/api/salas/%d' % pa326['id'], {'activo': False})
    pg.wait_for_function("OrientaMapa.zonas.find(z => z.id === 'P3-T3-S31').disponible === false", timeout=9000)
    ok('espacio desactivado: atenuado', pg.evaluate("document.querySelector('.zona[data-id=\"P3-T3-S31\"]').classList.contains('inactiva')"))
    pg.fill('#buscador', 'PA-326'); pg.wait_for_timeout(700)
    ok('espacio desactivado: no aparece en la búsqueda', 'sin-resultado' in pg.evaluate("document.getElementById('destino').className"))
    api('PUT', '/api/salas/%d' % pa326['id'], {'activo': True})
    pg.wait_for_function("OrientaMapa.zonas.find(z => z.id === 'P3-T3-S31').disponible === true", timeout=9000)
    pg.fill('#buscador', 'PA-326'); pg.wait_for_timeout(700)
    sel = pg.evaluate("[...document.querySelectorAll('.zona.sel')].map(e => e.getAttribute('data-id'))")
    ok('espacio reactivado: vuelve a buscarse', sel == ['P3-T3-S31'], str(sel))
    pg.click('#borrar')
    ok('sin errores en toda la sesión', not errores, str(errores))
    pg.close()

    # 5) Sin API (respaldo)
    pg3 = ctx.new_page()
    errs3 = []
    pg3.on('pageerror', lambda e: errs3.append(str(e)))
    pg3.route('**/api/**', lambda r: r.abort())
    pg3.goto(BASE + '/mapa-totem.html?estado=1')
    pg3.wait_for_function("document.body.dataset.api === 'sin-conexion'", timeout=8000)
    pg3.fill('#buscador', 'PA-326'); pg3.wait_for_timeout(600)
    sel = pg3.evaluate("[...document.querySelectorAll('.zona.sel')].map(e => e.getAttribute('data-id'))")
    ok('sin API: la búsqueda del archivo funciona', sel == ['P3-T3-S31'], str(sel))
    ok('sin API: sin errores de página', not errs3, str(errs3))
    captura(pg3, '3_sin_conexion')
    pg3.close()

    # 6) Plano con una zona menos y plano con scripts
    for nombre, f in (
        ('plano sin una zona conocida', lambda t: t.replace('id="P2-T1-S03"', 'id="OTRO"')),
        ('plano con script y enlaces', lambda t: t.replace('<g id="capa-circ">', '<script>window.__x=1</script><g id="capa-circ" onclick="window.__x=2">', 1).replace('<rect', '<a href="javascript:window.__x=3"><rect', 1)),
    ):
        pg4 = ctx.new_page()
        errs4 = []
        pg4.on('pageerror', lambda e: errs4.append(str(e)))
        def hacer(f):
            def modificar(route, request):
                route.fulfill(status=200, content_type='image/svg+xml', body=f(route.fetch().text()))
            return modificar
        pg4.route('**/api/pisos/%d/plano' % ID2, hacer(f))
        pg4.goto(BASE + '/mapa-totem.html')
        pg4.wait_for_function("document.body.dataset.api === 'conectada'", timeout=8000)
        pg4.wait_for_timeout(500)
        x = pg4.evaluate("window.__x || 0")
        sin_el = pg4.evaluate("OrientaMapa.zonas.filter(z => !document.querySelector('.zona[data-id=\"' + z.id + '\"]')).map(z => z.id)")
        ok(nombre + ': no ejecuta nada y el mapa sigue completo', x == 0 and not sin_el and not errs4, f'x={x} sin_el={sin_el} errs={errs4}')
        pg4.close()
    b.close()

malos = [n for n, c in resultados if not c]
print('\n%d comprobaciones, %d fallan' % (len(resultados), len(malos)), malos)
sys.exit(1 if malos else 0)
