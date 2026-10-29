  // ---------------------------------------------------------------- conexión con la API
  // Lo que cambia con el tiempo se pide al backend: nombres y códigos de los espacios (GET /api/pisos/:id), cuáles
  // siguen activos, el dibujo de cada piso (GET /api/pisos/:id/plano) y la búsqueda (GET /api/salas?q=, que además
  // queda registrada como consulta). Los datos del archivo (la lista ZONAS y el dibujo) son el respaldo: si el
  // backend no responde, el mapa sigue funcionando con ellos y vuelve a intentarlo solo.
  // La dirección del backend es la del servidor que entrega esta página; con otra se usa ?api=http://servidor:3000.
  // La geometría (posición de cada etiqueta, torre) no existe en la base de datos y sale siempre de ZONAS.
  const api = { activa: CONFIG.apiBase !== null, conectada: false, ultima: null, pisos: null, planos: {}, sincronizando: false, ultimoIntento: 0, avisado: false };
  let temporizadorBusqueda = 0, temporizadorSync = 0;

  function baseApi(){ return String(CONFIG.apiBase || '').replace(/\/+$/, ''); }
  async function pedir(ruta, comoTexto){
    const corte = new AbortController();
    const reloj = setTimeout(() => corte.abort(), 4000);
    try {
      const r = await fetch(baseApi() + ruta, { signal: corte.signal, cache: comoTexto ? 'default' : 'no-store' });
      if (!r.ok) throw new Error('La API respondió ' + r.status + ' en ' + ruta);
      return comoTexto ? await r.text() : await r.json();
    } finally { clearTimeout(reloj); }
  }

  // La base de datos distingue "Baño hombres (torre 1)" de "Baño hombres (torre 2)"; en el mapa la torre ya se ve.
  function nombrePublico(n){ return String(n).replace(/\s*\(torre \d+\)\s*$/i, '').trim(); }
  function tipoDeApi(nombre){ const t = normalizar(nombre || ''); return NOMBRE_TIPO[t] ? t : null; }

  // ---- nombres, códigos y espacios activos
  function aplicarEspacios(detalles){
    const vistos = new Set();
    let cambio = false;
    detalles.forEach(d => (d.espacios || []).forEach(e => {
      const z = e.svgElementId ? porId.get(e.svgElementId) : null;
      if (!z || z.piso !== d.numero) return;
      vistos.add(z.id);
      const antes = nombreDe(z), estabaDisponible = z.disponible !== false;
      z.disponible = true; z.espacioId = e.id; z.codigo = e.codigo;
      if (e.nombre || e.codigo) z.nombre = nombrePublico(e.nombre || e.codigo);
      const tipo = tipoDeApi(e.tipo);
      if (tipo && tipo !== z.tipo){ if (z.el) z.el.classList.replace(z.tipo, tipo); z.tipo = tipo; cambio = true; }
      if (nombreDe(z) !== antes || !estabaDisponible){
        cambio = true;
        if (z.el) z.el.classList.remove('inactiva');
        ajustarEtiqueta(z);
        if (resultados.length && resultados[actual].zonas.includes(z) && normalizar(input.value) === normalizar(antes)) input.value = nombreDe(z);
      }
    }));
    // Lo que el piso ya no trae (desactivado o eliminado) deja de buscarse y de mostrar su nombre.
    detalles.forEach(d => ZONAS.filter(z => z.piso === d.numero && !vistos.has(z.id) && z.disponible !== false).forEach(z => {
      z.disponible = false; cambio = true;
      if (z.el) z.el.classList.add('inactiva');
      ajustarEtiqueta(z);
    }));
    if (cambio && resultados.length){
      if (resultados[actual].zonas[0].disponible === false) limpiar(); else pintarDestino('resultado');
    }
  }

  // ---- dibujo de cada piso
  function remarcar(){
    if (!resultados.length) return;
    resultados.forEach(g => g.zonas.forEach(z => { if (z.el) z.el.classList.add('match'); }));
    resultados[actual].zonas.forEach(z => {
      if (z.el){ z.el.classList.remove('match'); z.el.classList.add('sel'); }
      if (z.etq) z.etq.classList.add('sel');
    });
    resultados.forEach(g => g.zonas.forEach(z => { if (z.etq) z.etq.classList.add('vis'); }));
  }
  // Si el dibujo que entrega la API difiere del archivo, la posición de cada zona se toma del dibujo nuevo.
  function ajustarGeometria(n){
    ZONAS.filter(z => z.piso === n && z.el).forEach(z => {
      let b;
      try { b = z.el.getBBox(); } catch (_) { return; }
      if (!b.width || !b.height) return;
      if (Math.abs(b.x - z.x) <= 1.5 && Math.abs(b.y - z.y) <= 1.5 && Math.abs(b.width - z.w) <= 1.5 && Math.abs(b.height - z.h) <= 1.5) return;
      if (z.lw) z.lw *= b.width / z.w;
      if (z.lh) z.lh *= b.height / z.h;
      z.x = b.x; z.y = b.y; z.w = b.width; z.h = b.height;
      z.cx = b.x + b.width / 2; z.cy = b.y + b.height / 2;
    });
  }
  function usarPlano(n, texto){
    const doc = new DOMParser().parseFromString(texto, 'image/svg+xml');
    const raiz = doc.querySelector('#piso-' + n);
    if (doc.querySelector('parsererror') || !raiz || !raiz.querySelector('#capa-zonas')) throw new Error('el archivo no es un plano válido');
    // El plano es un archivo del servidor: solo se toma el dibujo, sin scripts, enlaces ni contenido incrustado.
    raiz.querySelectorAll('script, foreignObject, image, a, use, style, animate, animateTransform, set').forEach(e => e.remove());
    raiz.querySelectorAll('*').forEach(e => Array.from(e.attributes).forEach(a => {
      const nom = a.name.toLowerCase();
      if (nom.startsWith('on') || nom === 'href' || nom === 'xlink:href') e.removeAttribute(a.name);
    }));
    const dibujadas = new Set();
    raiz.querySelectorAll('#capa-zonas > g[id]').forEach(g => { g.setAttribute('data-id', g.id); dibujadas.add(g.id); g.removeAttribute('id'); });
    const faltan = ZONAS.filter(z => z.piso === n && !dibujadas.has(z.id)).map(z => z.id);
    if (faltan.length) throw new Error('le faltan ' + faltan.length + ' zonas conocidas (' + faltan.slice(0, 3).join(', ') + ')');
    const g = gPiso[n], etqs = g.querySelector('.etqs');
    Array.from(g.children).forEach(c => { if (c !== etqs) g.removeChild(c); });
    Array.from(raiz.children).forEach(c => g.insertBefore(document.importNode(c, true), etqs));
    ZONAS.filter(z => z.piso === n).forEach(z => {
      z.el = g.querySelector('.zona[data-id="' + z.id + '"]');
      if (z.disponible === false) z.el.classList.add('inactiva');
    });
    ajustarGeometria(n);
    ajustarTodas();
    remarcar();
  }
  async function cargarPlanos(recargar){
    await Promise.all(api.pisos.map(async p => {
      if (!p.planoUrl || (api.planos[p.numero] && !recargar)) return;
      api.planos[p.numero] = true;
      try { usarPlano(p.numero, await pedir(p.planoUrl, true)); }
      catch (e){ console.warn('OrientaSede: se usa el dibujo del archivo para el piso ' + p.numero + ' (' + e.message + ').'); }
    }));
  }

  // ---- sincronización periódica
  function pintarEstado(){
    if (params.get('estado') !== '1') return;
    let el = document.getElementById('estado-api');
    if (!el){
      el = document.createElement('div'); el.id = 'estado-api';
      el.style.cssText = 'position:fixed;left:10px;bottom:10px;z-index:9999;padding:6px 12px;border-radius:999px;font:600 12px/1.3 system-ui,sans-serif;color:#fff;pointer-events:none';
      document.body.appendChild(el);
    }
    const hora = api.ultima ? api.ultima.toLocaleTimeString('es-CL', { hour12: false }) : '';
    if (!api.activa){ el.style.background = '#667F8D'; el.textContent = 'API desactivada · se usan los datos del archivo'; }
    else if (api.conectada){ el.style.background = '#1F7A4D'; el.textContent = 'API conectada · actualizado ' + hora; }
    else { el.style.background = '#B45309'; el.textContent = 'Sin conexión con la API · se usan los datos del archivo'; }
  }
  function marcarApi(ok, error){
    const cambio = ok !== api.conectada;
    api.conectada = ok;
    if (ok){ api.ultima = new Date(); api.avisado = false; }
    else if (!api.avisado){ api.avisado = true; console.warn('OrientaSede: sin conexión con la API, se usan los datos del archivo.', error); }
    document.body.dataset.api = ok ? 'conectada' : 'sin-conexion';
    if (cambio) document.dispatchEvent(new CustomEvent('orientasede:api', { detail: { conectada: ok } }));
    pintarEstado();
  }
  async function sincronizar(opciones){
    if (!api.activa || api.sincronizando || Date.now() - api.ultimoIntento < 2000) return;
    api.sincronizando = true; api.ultimoIntento = Date.now();
    try {
      if (!api.pisos){
        const lista = await pedir('/api/pisos' + (CONFIG.edificioId ? '?edificioId=' + encodeURIComponent(CONFIG.edificioId) : ''));
        const pisos = PISOS.map(n => lista.find(p => p.numero === n)).filter(Boolean);
        if (!pisos.length) throw new Error('la API no tiene los pisos ' + PISOS.join(' y '));
        api.pisos = pisos;
      }
      const detalles = await Promise.allSettled(api.pisos.map(p => pedir('/api/pisos/' + p.id)));
      const buenos = detalles.filter(d => d.status === 'fulfilled').map(d => d.value);
      if (!buenos.length) throw detalles[0].reason;
      aplicarEspacios(buenos);
      await cargarPlanos(opciones && opciones.planos);
      marcarApi(true);
    } catch (e){
      marcarApi(false, e);
    } finally { api.sincronizando = false; }
  }
  function conectarApi(){
    if (!api.activa){ document.body.dataset.api = 'off'; pintarEstado(); return; }
    const ciclo = () => {
      clearTimeout(temporizadorSync);
      temporizadorSync = setTimeout(async () => { await sincronizar(); ciclo(); }, (api.conectada ? CONFIG.actualizarS : Math.min(CONFIG.actualizarS, 10)) * 1000);
    };
    sincronizar().then(ciclo);
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
  }

  // ---- búsqueda: la hace la API (reconoce alias y áreas, y queda registrada); sin conexión, la del archivo
  function textoParaApi(q, n){
    // La API no conoce estos sinónimos: se le pide el nombre del tipo ("wc" -> "Baño").
    for (const k of ['bano', 'escalera', 'ascensor', 'terraza']){
      if ((SINONIMOS[k] || []).some(s => normalizar(s) === n)) return NOMBRE_TIPO[k];
    }
    return q.trim().slice(0, 100);
  }
  function gruposDeApi(items){
    const vistos = new Set(), lista = [];
    items.forEach(it => {
      const z = it.svgElementId ? porId.get(it.svgElementId) : null;
      if (z && z.disponible !== false && z.piso === it.piso.numero && !vistos.has(z.grupo)){ vistos.add(z.grupo); lista.push(z.grupo); }
    });
    // Igual que la búsqueda del archivo: primero lo del piso que se está viendo, conservando la relevancia.
    const prioridad = g => g.piso === pisoActual ? 0 : g.piso;
    return lista.map((g, i) => ({ g, i })).sort((a, b) => (prioridad(a.g) - prioridad(b.g)) || (a.i - b.i)).map(x => x.g);
  }
  function buscar(q){
    const turno = ++turnoBusqueda;
    clearTimeout(temporizadorBusqueda);
    const n = normalizar(q);
    if (!n){ limpiar(); return; }
    if (!api.conectada){ buscarLocal(q); return; }
    temporizadorBusqueda = setTimeout(async () => {
      try {
        const r = await pedir('/api/salas?limite=100&q=' + encodeURIComponent(textoParaApi(q, n)));
        if (turno !== turnoBusqueda) return;           // ya se escribió otra cosa
        const grupos = gruposDeApi(r.items || []);
        if (grupos.length) seleccionar(grupos, 0, true);
        else buscarLocal(q);                           // sinónimos y detalle del plano; si tampoco hay, "No encontramos ese lugar"
      } catch (e){
        if (turno !== turnoBusqueda) return;
        marcarApi(false, e);
        buscarLocal(q);
      }
    }, 150);
  }

