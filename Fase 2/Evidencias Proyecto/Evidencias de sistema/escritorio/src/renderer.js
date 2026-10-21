'use strict';

const STORAGE_KEY = 'pui-desktop-demo-v1';
const API_BASE_URL = 'http://localhost:3000';
const DEMO_EMAIL = 'admin@demo.local';
const DEMO_PASSWORD = 'demo1234';

const SECTION_META = {
  overview: { title: 'Resumen', breadcrumb: 'PANEL ADMINISTRATIVO' },
  rooms: { title: 'Gestión de salas', breadcrumb: 'CONTENIDOS DEL TÓTEM' },
  areas: { title: 'Áreas', breadcrumb: 'DIRECTORIO INSTITUCIONAL' },
  faqs: { title: 'Preguntas frecuentes', breadcrumb: 'CENTRO DE AYUDA' }
};

const ENTITY_CONFIG = {
  rooms: {
    singular: 'sala', plural: 'salas', title: 'salas',
    description: 'Mantén actualizada la información de las salas y espacios del campus.',
    emptyTitle: 'Todavía no hay salas', emptyText: 'Agrega una sala para comenzar a organizar los espacios.',
    fields: [
      { name: 'name', label: 'Nombre de la sala', placeholder: 'Ej. Laboratorio de informática 1', required: true, full: true },
      { name: 'code', label: 'Código o número', placeholder: 'Ej. LAB-101', required: true },
      { name: 'floor', label: 'Piso', placeholder: 'Ej. 1', required: true },
      { name: 'location', label: 'Referencia / ubicación', placeholder: 'Ej. Ala norte, junto a biblioteca', required: true, full: true }
    ],
    columns: [
      { label: 'Sala', key: 'name', primary: true, sub: 'code', subPrefix: 'Código: ' },
      { label: 'Piso', key: 'floor' },
      { label: 'Ubicación', key: 'location' }
    ]
  },
  areas: {
    singular: 'área', plural: 'áreas', title: 'áreas',
    description: 'Administra las áreas a las que el tótem dirige a la comunidad y sus medios de contacto.',
    emptyTitle: 'Todavía no hay áreas', emptyText: 'Agrega un área para orientar a las personas dentro de la sede.',
    fields: [
      { name: 'name', label: 'Nombre del área', placeholder: 'Ej. Financiamiento', required: true, full: true },
      { name: 'description', label: 'Descripción', placeholder: 'Ej. Becas, créditos y pagos de aranceles', required: true, full: true },
      { name: 'location', label: 'Ubicación (espacio del mapa)', select: true, emptyOption: 'Seleccionar espacio' },
      { name: 'phone', label: 'Anexo', placeholder: 'Ej. 210' },
      { name: 'email', label: 'Correo de contacto', placeholder: 'Ej. financiamiento@ejemplo.cl', type: 'email', required: true, full: true },
      { name: 'schedule', label: 'Horario de atención', placeholder: 'Ej. Lunes a viernes, 9:00 a 17:00', full: true }
    ],
    columns: [
      { label: 'Área y ubicación', key: 'name', primary: true, sub: 'location' },
      { label: 'Contacto', key: 'email', primary: true, sub: 'phone', subPrefix: 'Anexo ' },
      { label: 'Horario de atención', key: 'schedule' }
    ]
  },
  faqs: {
    singular: 'pregunta frecuente', plural: 'preguntas frecuentes', title: 'preguntas frecuentes',
    description: 'Publica respuestas claras a las consultas habituales de los estudiantes.',
    emptyTitle: 'Todavía no hay preguntas', emptyText: 'Agrega una pregunta y su respuesta para el tótem.',
    fields: [
      { name: 'question', label: 'Pregunta', placeholder: 'Ej. ¿Dónde solicito un certificado?', required: true, full: true },
      { name: 'category_id', label: 'Categoría', required: true, full: true, select: true },
      { name: 'answer', label: 'Respuesta', placeholder: 'Describe los pasos que debe seguir el estudiante…', required: true, full: true, textarea: true },
      { name: 'published', label: 'Estado', required: true, select: true, options: [{ value: 'false', label: 'Borrador' }, { value: 'true', label: 'Publicada' }] }
    ],
    columns: [
      { label: 'Pregunta', key: 'question', primary: true, sub: 'category' },
      { label: 'Respuesta', key: 'answer', truncate: 105 },
      { label: 'Estado', key: 'published' }
    ]
  }
};

const DEMO_DATA = {
  rooms: [
    { id: 'room-1', name: 'Laboratorio de informática 1', code: 'LAB-101', floor: '1', location: 'Edificio principal, ala norte' },
    { id: 'room-2', name: 'Sala de clases 204', code: 'S-204', floor: '2', location: 'Edificio principal, pasillo central' },
    { id: 'room-3', name: 'Biblioteca', code: 'BIB-01', floor: '1', location: 'Acceso central, junto al patio' }
  ],
  areas: [
    { id: 'area-1', name: 'Financiamiento', description: 'Becas, créditos y pagos de aranceles', location: 'Piso 1, oficina 105', email: 'financiamiento@ejemplo.cl', phone: '210', schedule: 'Lunes a viernes, 9:00 a 17:00' },
    { id: 'area-2', name: 'Servicios Digitales', description: 'Soporte y servicios digitales', location: 'Piso 2, oficina 210', email: 'soporte@ejemplo.cl', phone: '215', schedule: 'Lunes a viernes, 8:30 a 18:00' },
    { id: 'area-3', name: 'CASE', description: 'Centro de apoyo y servicios estudiantiles', location: 'Piso 1, oficina 112', email: 'case@ejemplo.cl', phone: '220', schedule: 'Lunes a viernes, 9:00 a 17:00' },
    { id: 'area-4', name: 'Dirección de Carrera', description: 'Orientación académica y de carrera', location: 'Piso 3, oficina 301', email: 'direccion.carrera@ejemplo.cl', phone: '230', schedule: 'Lunes a jueves, 10:00 a 16:00' }
  ],
  faqs: []
};

const DEMO_AREA_SPACES = [
  { value: 'Piso 1, oficina 105', label: 'Piso 1, oficina 105' },
  { value: 'Piso 2, oficina 210', label: 'Piso 2, oficina 210' },
  { value: 'Piso 1, oficina 112', label: 'Piso 1, oficina 112' },
  { value: 'Piso 3, oficina 301', label: 'Piso 3, oficina 301' }
];

let data = loadData();
let activeSection = 'overview';
let searchQuery = '';
let editingId = null;
let toastTimer = null;
let faqCategories = [];
let faqLoading = false;
let faqLoaded = false;
let faqError = '';

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.rooms)) {
        return {
          rooms: parsed.rooms,
          areas: Array.isArray(parsed.areas) ? parsed.areas : JSON.parse(JSON.stringify(DEMO_DATA.areas)),
          faqs: []
        };
      }
    }
  } catch (error) {
    console.warn('No fue posible leer los datos locales de demostración.', error);
  }
  return JSON.parse(JSON.stringify(DEMO_DATA));
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      rooms: data.rooms,
      areas: data.areas
    }));
    return true;
  } catch (error) {
    console.error('No fue posible guardar los datos locales.', error);
    showToast('No se pudieron guardar los cambios en este equipo.', true);
    return false;
  }
}

async function apiRequest(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers
    }
  });
  const result = await response.json();
  if (!response.ok) {
    const message = Array.isArray(result.message) ? result.message.join('. ') : result.message;
    throw new Error(message || `La API respondió con el estado ${response.status}.`);
  }
  return result;
}

async function loadFaqs() {
  faqLoading = true;
  faqError = '';
  data.faqs = [];
  $('#apiStatus').textContent = 'Conectando…';
  if (activeSection === 'faqs') renderEntitySection('faqs');

  try {
    const [faqs, categories] = await Promise.all([
      apiRequest('/faqs/admin'),
      apiRequest('/faqs/categorias')
    ]);
    if (!Array.isArray(faqs) || !Array.isArray(categories)) {
      throw new Error('La API devolvió datos de preguntas frecuentes con un formato inesperado.');
    }
    data.faqs = faqs.map(faq => ({
      id: faq.id,
      question: faq.pregunta,
      answer: faq.respuesta,
      categoryId: faq.categoria_id,
      category: faq.categoria?.nombre || '',
      published: faq.publicada
    }));
    faqCategories = categories;
    faqLoaded = true;
    $('#apiStatus').textContent = 'Conectada';
    return true;
  } catch (error) {
    faqError = error instanceof Error ? error.message : 'No fue posible conectar con la API.';
    console.error('No fue posible cargar las preguntas frecuentes desde la API.', error);
    $('#apiStatus').textContent = 'Desconectada';
    showToast(`No se pudieron cargar las preguntas: ${faqError}`, true);
    return false;
  } finally {
    faqLoading = false;
    if (activeSection === 'faqs') renderEntitySection('faqs');
    else if (activeSection === 'overview') renderOverview();
  }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getAreaLocation(area) {
  return area.location || '';
}

function makeId(prefix) {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') return `${prefix}-${window.crypto.randomUUID()}`;
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function init() {
  if (window.desktopApp?.runtime) $('#runtimeLabel').textContent = window.desktopApp.runtime;
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#logoutButton').addEventListener('click', logout);
  $$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
  $('#appContent').addEventListener('click', handleContentClick);
  $('#appContent').addEventListener('input', handleSearchInput);
  $('#modalRoot').addEventListener('click', handleModalClick);
  $('#modalRoot').addEventListener('submit', handleModalSubmit);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
}

function handleLogin(event) {
  event.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const password = $('#loginPassword').value;
  const error = $('#loginError');
  if (email !== DEMO_EMAIL || password !== DEMO_PASSWORD) {
    error.textContent = 'Credenciales incorrectas. Usa los datos de demostración indicados abajo.';
    error.hidden = false;
    return;
  }
  error.hidden = true;
  $('#loginScreen').hidden = true;
  $('#appScreen').hidden = false;
  activeSection = 'overview';
  renderApp();
  if (!faqLoaded && !faqLoading) void loadFaqs();
}

function logout() {
  closeModal();
  $('#appScreen').hidden = true;
  $('#loginScreen').hidden = false;
  $('#loginPassword').value = '';
  $('#loginError').hidden = true;
}

function navigate(section) {
  if (!SECTION_META[section]) return;
  activeSection = section;
  searchQuery = '';
  renderApp();
  if (section === 'faqs' && !faqLoaded && !faqLoading) void loadFaqs();
}

function renderApp() {
  const meta = SECTION_META[activeSection];
  $('#topbarTitle').textContent = meta.title;
  $('#breadcrumb').textContent = meta.breadcrumb;
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === activeSection));
  $('#roomNavCount').textContent = data.rooms.length;
  $('#areaNavCount').textContent = data.areas.length;
  $('#faqNavCount').textContent = data.faqs.length;
  if (activeSection === 'overview') renderOverview();
  else renderEntitySection(activeSection);
}

function renderOverview() {
  const modules = [
    { section: 'rooms', icon: '⌂', title: 'Gestión de salas', subtitle: 'Espacios y ubicaciones del campus', count: data.rooms.length },
    { section: 'areas', icon: '⌖', title: 'Áreas', subtitle: 'Directorio y ubicación de atención', count: data.areas.length },
    { section: 'faqs', icon: '?', title: 'Preguntas frecuentes', subtitle: 'Respuestas para consultas habituales', count: data.faqs.length }
  ];
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">VISTA GENERAL</p><h1>¡Bienvenido al panel!</h1><p>Administra los contenidos que verá la comunidad estudiantil en el tótem.</p></div><div class="heading-actions"><button class="button primary" data-action="create" data-entity="rooms">＋ Agregar sala</button></div></div>
    <div class="kpi-grid">
      ${kpiCard('Salas registradas', data.rooms.length, '⌂', 'Espacios del campus')}
      ${kpiCard('Áreas', data.areas.length, '⌖', 'Puntos de atención')}
      ${kpiCard('Preguntas frecuentes', data.faqs.length, '?', 'Respuestas disponibles')}
      ${kpiCard('Módulos', '3', '▦', 'Secciones administrables')}
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h2>Contenidos administrables</h2><p>Accede rápidamente a cada módulo del sistema.</p></div></div><div class="module-list">
        ${modules.map(module => `<button class="module-row" style="width:100%;background:transparent;border:0;text-align:left;cursor:pointer" data-action="navigate" data-section="${module.section}"><span class="module-icon">${module.icon}</span><span><strong>${module.title}</strong><small>${module.subtitle}</small></span><span class="row-count">${module.count}</span></button>`).join('')}
      </div></section>
      <section class="panel"><div class="panel-header"><div><h2>Accesos rápidos</h2><p>Administra la información desde sus módulos.</p></div></div><div class="quick-actions">
        ${quickAction('＋', 'Registrar una sala', 'Agregar ubicación del campus', 'rooms')}
        ${quickAction('＋', 'Agregar área', 'Indicar dónde recibir orientación', 'areas')}
        ${quickAction('＋', 'Crear pregunta frecuente', 'Incorporar una respuesta útil', 'faqs')}
      </div></section>
    </div>
    <div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Integración en desarrollo</strong>Las preguntas frecuentes se consultan y guardan en la API. Salas y áreas permanecen como datos locales de demostración; el acceso institucional todavía no está integrado.</div></div>
  `;
}

function kpiCard(label, value, icon, foot) {
  return `<article class="kpi-card"><div class="kpi-top"><span>${label}</span><span class="kpi-icon">${icon}</span></div><div class="kpi-value">${value}</div><div class="kpi-foot">${foot}</div></article>`;
}

function quickAction(icon, title, subtitle, entity) {
  return `<button class="quick-action" data-action="create" data-entity="${entity}"><span class="module-icon">${icon}</span><span><strong>${title}</strong><small>${subtitle}</small></span><span class="action-plus">›</span></button>`;
}

function renderEntitySection(entity) {
  const config = ENTITY_CONFIG[entity];
  const list = data[entity];
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filtered = list.filter(item => [
    ...Object.values(item),
    ...(entity === 'areas' ? [getAreaLocation(item)] : [])
  ].some(value => String(value ?? '').toLowerCase().includes(normalizedQuery)));
  const headerActions = `<button class="button primary" data-action="create" data-entity="${entity}">＋ Agregar ${config.singular}</button>`;
  const callout = entity === 'faqs'
    ? `<div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Preguntas frecuentes conectadas a la API</strong>Los cambios se guardan en la base de datos y las preguntas publicadas aparecen en el tótem.</div></div>`
    : entity === 'areas'
      ? `<div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Áreas en modo de demostración</strong>Las ubicaciones son ejemplos locales del mockup. Los cambios se guardan en este equipo, pero aún no se envían a la API ni son visibles en el tótem.</div></div>`
      : `<div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Datos locales de demostración</strong>Los cambios se almacenan en este equipo. Aún no se envían a la API ni son visibles en el tótem.</div></div>`;
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">GESTIÓN DE CONTENIDO</p><h1>${config.title.charAt(0).toUpperCase()}${config.title.slice(1)}</h1><p>${config.description}</p></div><div class="heading-actions">${headerActions}</div></div>
    <div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="searchInput" type="search" value="${escapeHTML(searchQuery)}" placeholder="Buscar ${config.plural}…" aria-label="Buscar ${config.plural}"></label><span class="result-count">${filtered.length} de ${list.length} registros</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr>${config.columns.map(column => `<th>${column.label}</th>`).join('')}<th style="text-align:right">ACCIONES</th></tr></thead><tbody>${renderTableRows(entity, filtered, config)}</tbody></table></div>
    ${faqLoading ? '<p class="muted" role="status">Cargando preguntas frecuentes…</p>' : ''}
    ${faqError ? `<p class="form-error" role="alert">${escapeHTML(faqError)}</p>` : ''}
    ${callout}
  `;
}

function renderTableRows(entity, rows, config) {
  if (rows.length === 0) {
    const searching = searchQuery.trim().length > 0;
    return `<tr><td class="empty-state" colspan="${config.columns.length + 1}"><strong>${searching ? 'No se encontraron resultados' : config.emptyTitle}</strong><span>${searching ? 'Prueba con otro término de búsqueda.' : config.emptyText}</span></td></tr>`;
  }
  return rows.map(item => `<tr>${config.columns.map(column => {
    const value = entity === 'areas' && column.key === 'location'
      ? getAreaLocation(item)
      : item[column.key];
    let content = escapeHTML(value || '—');
    if (column.truncate && String(item[column.key] || '').length > column.truncate) content = `${escapeHTML(String(item[column.key]).slice(0, column.truncate))}…`;
    if (column.primary) {
      const subValue = column.sub ? item[column.sub] : '';
      const sub = subValue ? `<span class="cell-sub">${column.subPrefix || ''}${escapeHTML(subValue)}</span>` : '';
      content = `<span class="primary-cell">${content}</span>${sub}`;
    } else if (entity === 'faqs' && column.key === 'answer') {
      content = `<span title="${escapeHTML(item.answer)}">${content}</span>`;
    }
    if (column.key === 'floor') content = `<span class="tag">Piso ${escapeHTML(item.floor)}</span>`;
    if (entity === 'faqs' && column.key === 'published') content = `<span class="tag">${item.published ? 'Publicada' : 'Borrador'}</span>`;
    return `<td>${content}</td>`;
  }).join('')}<td><div class="table-actions"><button class="icon-button" title="Editar" aria-label="Editar" data-action="edit" data-entity="${entity}" data-id="${escapeHTML(item.id)}">✎</button><button class="icon-button delete" title="Eliminar" aria-label="Eliminar" data-action="delete" data-entity="${entity}" data-id="${escapeHTML(item.id)}">×</button></div></td></tr>`).join('');
}

function handleContentClick(event) {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, entity, id, section } = button.dataset;
  if (action === 'navigate') navigate(section);
  if (action === 'create') openModal(entity);
  if (action === 'edit') openModal(entity, id);
  if (action === 'delete') deleteRecord(entity, id);
}

function handleSearchInput(event) {
  if (!event.target.matches('#searchInput')) return;
  const input = event.target;
  const start = input.selectionStart;
  const end = input.selectionEnd;
  searchQuery = input.value;
  renderEntitySection(activeSection);
  const replacement = $('#searchInput');
  replacement.focus();
  try { replacement.setSelectionRange(start, end); } catch (_) { /* Algunos motores no permiten posición en input search. */ }
}

function openModal(entity, id = null) {
  const config = ENTITY_CONFIG[entity];
  if (!config) return;
  if (entity === 'faqs' && !faqLoaded) {
    showToast(faqError || 'La conexión con la API todavía está cargando.', true);
    return;
  }
  if (entity === 'faqs' && faqCategories.length === 0) {
    showToast('La API no tiene categorías disponibles para asociar a una pregunta.', true);
    return;
  }
  editingId = id;
  const existing = id ? data[entity].find(item => String(item.id) === String(id)) : null;
  if (id && !existing) return;
  const title = existing ? `Editar ${config.singular}` : `Agregar ${config.singular}`;
  const fields = config.fields.map(field => {
    const value = field.name === 'category_id'
      ? existing?.categoryId ?? ''
      : field.name === 'published'
        ? existing?.published ?? false
        : existing?.[field.name] ?? '';
    const required = field.required ? 'required' : '';
    const placeholder = escapeHTML(field.placeholder || '');
    const options = field.name === 'category_id'
      ? faqCategories.map(category => ({ value: String(category.id), label: category.nombre }))
      : field.name === 'location'
        ? DEMO_AREA_SPACES
      : field.options;
    const control = field.select
      ? `<select class="field-control" id="field-${field.name}" name="${field.name}" ${required}><option value="">${escapeHTML(field.emptyOption || 'Selecciona una opción')}</option>${(options || []).map(option => `<option value="${escapeHTML(option.value)}" ${String(value) === String(option.value) ? 'selected' : ''}>${escapeHTML(option.label)}</option>`).join('')}</select>`
      : field.textarea
      ? `<textarea class="field-control textarea" id="field-${field.name}" name="${field.name}" placeholder="${placeholder}" ${required}>${escapeHTML(value)}</textarea>`
      : `<input class="field-control" id="field-${field.name}" name="${field.name}" type="${field.type || 'text'}" value="${escapeHTML(value)}" placeholder="${placeholder}" ${required}>`;
    return `<div class="form-field ${field.full ? 'full' : ''}"><label for="field-${field.name}">${field.label}${field.required ? ' *' : ''}</label>${control}</div>`;
  }).join('');
  const description = entity === 'faqs'
    ? 'Los cambios se guardarán en la base de datos.'
    : entity === 'areas'
      ? 'Completa los campos para actualizar el directorio de áreas del tótem.'
    : 'Completa los campos para actualizar los datos de demostración.';
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><h2 id="modalTitle">${title}</h2><p>${description}</p></div><button type="button" class="modal-close" data-modal-action="close" aria-label="Cerrar ventana">×</button></div><form id="entityForm" class="modal-form" data-entity="${entity}"><div class="form-grid">${fields}</div><div class="modal-actions"><button type="button" class="button secondary" data-modal-action="close">Cancelar</button><button type="submit" class="button primary">${existing ? 'Guardar cambios' : 'Crear registro'}</button></div></form></section></div>`;
  const firstInput = $('.field-control', $('#modalRoot'));
  if (firstInput) firstInput.focus();
}

function handleModalClick(event) {
  const actionButton = event.target.closest('[data-modal-action]');
  if (actionButton) {
    closeModal();
    return;
  }
  if (event.target.classList.contains('modal-backdrop')) closeModal();
}

async function handleModalSubmit(event) {
  if (event.target.id !== 'entityForm') return;
  event.preventDefault();
  const form = event.target;
  const entity = form.dataset.entity;
  const config = ENTITY_CONFIG[entity];
  if (!config) return;
  const formData = new FormData(form);
  const record = {};
  for (const field of config.fields) record[field.name] = String(formData.get(field.name) ?? '').trim();
  for (const field of config.fields.filter(item => item.required)) {
    if (!record[field.name]) {
      $(`#field-${field.name}`, form)?.focus();
      showToast(`Completa el campo «${field.label}».`, true);
      return;
    }
  }
  if (entity === 'areas' && record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    $('#field-email', form).focus();
    showToast('Ingresa un correo con un formato válido.', true);
    return;
  }
  if (entity === 'areas' && data.areas.some(area =>
    area.name.trim().toLowerCase() === record.name.toLowerCase() && String(area.id) !== String(editingId)
  )) {
    $('#field-name', form).focus();
    showToast('Ya existe un área con ese nombre.', true);
    return;
  }
  if (entity === 'faqs') {
    const wasEditing = editingId !== null;
    const payload = {
      pregunta: record.question,
      respuesta: record.answer,
      categoria_id: Number(record.category_id),
      publicada: record.published === 'true'
    };
    const submitButton = $('button[type="submit"]', form);
    submitButton.disabled = true;
    try {
      await apiRequest(editingId ? `/faqs/${editingId}` : '/faqs', {
        method: editingId ? 'PATCH' : 'POST',
        body: JSON.stringify(payload)
      });
      closeModal();
      faqLoaded = false;
      const loaded = await loadFaqs();
      if (loaded) showToast(wasEditing ? 'Pregunta frecuente actualizada en la base de datos.' : 'Pregunta frecuente creada en la base de datos.');
    } catch (error) {
      console.error('No fue posible guardar la pregunta frecuente en la API.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible guardar la pregunta frecuente.', true);
      submitButton.disabled = false;
    }
    return;
  }
  const existingIndex = data[entity].findIndex(item => item.id === editingId);
  const wasEditing = existingIndex >= 0;
  if (wasEditing) data[entity][existingIndex] = { ...data[entity][existingIndex], ...record };
  else data[entity].unshift({ id: makeId(entity.slice(0, -1)), ...record });
  const saved = saveData();
  closeModal();
  renderApp();
  if (saved) showToast(wasEditing ? 'Cambios guardados en este equipo.' : 'Registro agregado correctamente.');
}

function deleteRecord(entity, id) {
  const config = ENTITY_CONFIG[entity];
  const record = data[entity]?.find(item => String(item.id) === String(id));
  if (!config || !record) return;
  const label = record.name || record.question || config.singular;
  if (entity === 'faqs') {
    if (window.confirm(`¿Seguro que quieres eliminar «${label}» de la base de datos?`)) void deleteFaq(id);
    return;
  }
  if (!window.confirm(`¿Seguro que quieres eliminar «${label}» de los datos de demostración?`)) return;
  data[entity] = data[entity].filter(item => item.id !== id);
  const saved = saveData();
  renderApp();
  if (saved) showToast('Registro eliminado de los datos locales.');
}

async function deleteFaq(id) {
  try {
    await apiRequest(`/faqs/${id}`, { method: 'DELETE' });
    faqLoaded = false;
    const loaded = await loadFaqs();
    if (loaded) showToast('Pregunta frecuente eliminada de la base de datos.');
  } catch (error) {
    console.error('No fue posible eliminar la pregunta frecuente desde la API.', error);
    showToast(error instanceof Error ? error.message : 'No fue posible eliminar la pregunta frecuente.', true);
  }
}

function closeModal() {
  $('#modalRoot').innerHTML = '';
  editingId = null;
}

function showToast(message, warning = false) {
  const root = $('#toastRoot');
  if (toastTimer) clearTimeout(toastTimer);
  root.innerHTML = `<div class="toast ${warning ? 'warning' : ''}" role="status">${escapeHTML(message)}</div>`;
  toastTimer = setTimeout(() => { root.innerHTML = ''; toastTimer = null; }, 3200);
}

init();
