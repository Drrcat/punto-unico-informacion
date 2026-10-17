'use strict';

const STORAGE_KEY = 'pui-desktop-demo-v1';
const DEMO_EMAIL = 'admin@demo.local';
const DEMO_PASSWORD = 'demo1234';

const SECTION_META = {
  overview: { title: 'Resumen', breadcrumb: 'PANEL ADMINISTRATIVO' },
  rooms: { title: 'Gestión de salas', breadcrumb: 'CONTENIDOS DEL TÓTEM' },
  coordinators: { title: 'Coordinadores', breadcrumb: 'DIRECTORIO ACADÉMICO' },
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
  coordinators: {
    singular: 'coordinador', plural: 'coordinadores', title: 'coordinadores',
    description: 'Administra el directorio de coordinadores de carrera y sus medios de contacto.',
    emptyTitle: 'Todavía no hay coordinadores', emptyText: 'Agrega un contacto para completar el directorio académico.',
    fields: [
      { name: 'name', label: 'Nombre completo', placeholder: 'Ej. Camila González', required: true, full: true },
      { name: 'career', label: 'Carrera', placeholder: 'Ej. Ingeniería en Informática', required: true, full: true },
      { name: 'email', label: 'Correo institucional', placeholder: 'nombre@duocuc.cl', type: 'email', required: true },
      { name: 'phone', label: 'Teléfono o anexo', placeholder: 'Ej. 225555555', required: false }
    ],
    columns: [
      { label: 'Coordinador', key: 'name', primary: true, sub: 'career' },
      { label: 'Correo', key: 'email' },
      { label: 'Teléfono / anexo', key: 'phone' }
    ]
  },
  faqs: {
    singular: 'pregunta frecuente', plural: 'preguntas frecuentes', title: 'preguntas frecuentes',
    description: 'Publica respuestas claras a las consultas habituales de los estudiantes.',
    emptyTitle: 'Todavía no hay preguntas', emptyText: 'Agrega una pregunta y su respuesta para el tótem.',
    fields: [
      { name: 'question', label: 'Pregunta', placeholder: 'Ej. ¿Dónde solicito un certificado?', required: true, full: true },
      { name: 'category', label: 'Categoría', placeholder: 'Ej. Trámites', required: true },
      { name: 'answer', label: 'Respuesta', placeholder: 'Describe los pasos que debe seguir el estudiante…', required: true, full: true, textarea: true }
    ],
    columns: [
      { label: 'Pregunta', key: 'question', primary: true, sub: 'category' },
      { label: 'Respuesta', key: 'answer', truncate: 105 }
    ]
  }
};

const DEMO_DATA = {
  rooms: [
    { id: 'room-1', name: 'Laboratorio de informática 1', code: 'LAB-101', floor: '1', location: 'Edificio principal, ala norte' },
    { id: 'room-2', name: 'Sala de clases 204', code: 'S-204', floor: '2', location: 'Edificio principal, pasillo central' },
    { id: 'room-3', name: 'Biblioteca', code: 'BIB-01', floor: '1', location: 'Acceso central, junto al patio' }
  ],
  coordinators: [
    { id: 'coord-1', name: 'Coordinación de Informática', career: 'Ingeniería en Informática', email: 'coordinacion.informatica@demo.local', phone: 'Anexo 210' },
    { id: 'coord-2', name: 'Coordinación de Administración', career: 'Administración de Empresas', email: 'coordinacion.administracion@demo.local', phone: 'Anexo 215' }
  ],
  faqs: [
    { id: 'faq-1', question: '¿Dónde puedo consultar por financiamiento?', category: 'Financiamiento', answer: 'Dirígete al área de Financiamiento o consulta los canales oficiales de atención de la sede.' },
    { id: 'faq-2', question: '¿Cómo contacto a mi coordinador de carrera?', category: 'Vida académica', answer: 'Consulta el Directorio Académico del tótem para encontrar los datos de contacto de tu carrera.' },
    { id: 'faq-3', question: '¿Dónde encuentro mis salas de clases?', category: 'Infraestructura', answer: 'Abre el mapa interactivo del tótem y busca el código o nombre de tu sala.' }
  ]
};

let data = loadData();
let activeSection = 'overview';
let searchQuery = '';
let editingId = null;
let toastTimer = null;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && Array.isArray(parsed.rooms) && Array.isArray(parsed.coordinators) && Array.isArray(parsed.faqs)) return parsed;
    }
  } catch (error) {
    console.warn('No fue posible leer los datos locales de demostración.', error);
  }
  return JSON.parse(JSON.stringify(DEMO_DATA));
}

function saveData() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    return true;
  } catch (error) {
    console.error('No fue posible guardar los datos locales.', error);
    showToast('No se pudieron guardar los cambios en este equipo.', true);
    return false;
  }
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
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
}

function renderApp() {
  const meta = SECTION_META[activeSection];
  $('#topbarTitle').textContent = meta.title;
  $('#breadcrumb').textContent = meta.breadcrumb;
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === activeSection));
  $('#roomNavCount').textContent = data.rooms.length;
  $('#coordinatorNavCount').textContent = data.coordinators.length;
  $('#faqNavCount').textContent = data.faqs.length;
  if (activeSection === 'overview') renderOverview();
  else renderEntitySection(activeSection);
}

function renderOverview() {
  const modules = [
    { section: 'rooms', icon: '⌂', title: 'Gestión de salas', subtitle: 'Espacios y ubicaciones del campus', count: data.rooms.length },
    { section: 'coordinators', icon: '♙', title: 'Coordinadores', subtitle: 'Directorio académico y contacto', count: data.coordinators.length },
    { section: 'faqs', icon: '?', title: 'Preguntas frecuentes', subtitle: 'Respuestas para consultas habituales', count: data.faqs.length }
  ];
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">VISTA GENERAL</p><h1>¡Bienvenido al panel!</h1><p>Administra los contenidos que verá la comunidad estudiantil en el tótem.</p></div><div class="heading-actions"><button class="button primary" data-action="create" data-entity="rooms">＋ Agregar sala</button></div></div>
    <div class="kpi-grid">
      ${kpiCard('Salas registradas', data.rooms.length, '⌂', 'Espacios del campus')}
      ${kpiCard('Coordinadores', data.coordinators.length, '♙', 'Contactos académicos')}
      ${kpiCard('Preguntas frecuentes', data.faqs.length, '?', 'Respuestas disponibles')}
      ${kpiCard('Módulos', '3', '▦', 'Secciones administrables')}
    </div>
    <div class="dashboard-grid">
      <section class="panel"><div class="panel-header"><div><h2>Contenidos administrables</h2><p>Accede rápidamente a cada módulo del sistema.</p></div></div><div class="module-list">
        ${modules.map(module => `<button class="module-row" style="width:100%;background:transparent;border:0;text-align:left;cursor:pointer" data-action="navigate" data-section="${module.section}"><span class="module-icon">${module.icon}</span><span><strong>${module.title}</strong><small>${module.subtitle}</small></span><span class="row-count">${module.count}</span></button>`).join('')}
      </div></section>
      <section class="panel"><div class="panel-header"><div><h2>Accesos rápidos</h2><p>Agrega información al panel local.</p></div></div><div class="quick-actions">
        ${quickAction('＋', 'Registrar una sala', 'Agregar ubicación del campus', 'rooms')}
        ${quickAction('＋', 'Añadir coordinador', 'Completar el directorio académico', 'coordinators')}
        ${quickAction('＋', 'Crear pregunta frecuente', 'Incorporar una respuesta útil', 'faqs')}
      </div></section>
    </div>
    <div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Prototipo de demostración</strong>Los registros que ves son datos ficticios de ejemplo y se guardan localmente en este equipo. La conexión con las API del proyecto y la autenticación institucional deberán integrarse cuando estén disponibles sus contratos y endpoints.</div></div>
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
  const filtered = list.filter(item => Object.values(item).some(value => String(value ?? '').toLowerCase().includes(normalizedQuery)));
  const headerActions = `<button class="button primary" data-action="create" data-entity="${entity}">＋ Agregar ${config.singular}</button>`;
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">GESTIÓN DE CONTENIDO</p><h1>${config.title.charAt(0).toUpperCase()}${config.title.slice(1)}</h1><p>${config.description}</p></div><div class="heading-actions">${headerActions}</div></div>
    <div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="searchInput" type="search" value="${escapeHTML(searchQuery)}" placeholder="Buscar ${config.plural}…" aria-label="Buscar ${config.plural}"></label><span class="result-count">${filtered.length} de ${list.length} registros</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr>${config.columns.map(column => `<th>${column.label}</th>`).join('')}<th style="text-align:right">ACCIONES</th></tr></thead><tbody>${renderTableRows(entity, filtered, config)}</tbody></table></div>
    <div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Datos locales de demostración</strong>Los cambios se almacenan en este equipo. Aún no se envían a la API ni son visibles en el tótem.</div></div>
  `;
}

function renderTableRows(entity, rows, config) {
  if (rows.length === 0) {
    const searching = searchQuery.trim().length > 0;
    return `<tr><td class="empty-state" colspan="${config.columns.length + 1}"><strong>${searching ? 'No se encontraron resultados' : config.emptyTitle}</strong><span>${searching ? 'Prueba con otro término de búsqueda.' : config.emptyText}</span></td></tr>`;
  }
  return rows.map(item => `<tr>${config.columns.map(column => {
    let content = escapeHTML(item[column.key] || '—');
    if (column.truncate && String(item[column.key] || '').length > column.truncate) content = `${escapeHTML(String(item[column.key]).slice(0, column.truncate))}…`;
    if (column.primary) {
      const subValue = column.sub ? item[column.sub] : '';
      const sub = subValue ? `<span class="cell-sub">${column.subPrefix || ''}${escapeHTML(subValue)}</span>` : '';
      content = `<span class="primary-cell">${content}</span>${sub}`;
    } else if (entity === 'faqs' && column.key === 'answer') {
      content = `<span title="${escapeHTML(item.answer)}">${content}</span>`;
    }
    if (column.key === 'floor') content = `<span class="tag">Piso ${escapeHTML(item.floor)}</span>`;
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
  editingId = id;
  const existing = id ? data[entity].find(item => item.id === id) : null;
  if (id && !existing) return;
  const title = existing ? `Editar ${config.singular}` : `Agregar ${config.singular}`;
  const fields = config.fields.map(field => {
    const value = existing?.[field.name] ?? '';
    const required = field.required ? 'required' : '';
    const placeholder = escapeHTML(field.placeholder || '');
    const control = field.textarea
      ? `<textarea class="field-control textarea" id="field-${field.name}" name="${field.name}" placeholder="${placeholder}" ${required}>${escapeHTML(value)}</textarea>`
      : `<input class="field-control" id="field-${field.name}" name="${field.name}" type="${field.type || 'text'}" value="${escapeHTML(value)}" placeholder="${placeholder}" ${required}>`;
    return `<div class="form-field ${field.full ? 'full' : ''}"><label for="field-${field.name}">${field.label}${field.required ? ' *' : ''}</label>${control}</div>`;
  }).join('');
  $('#modalRoot').innerHTML = `<div class="modal-backdrop" role="presentation"><section class="modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle"><div class="modal-header"><div><h2 id="modalTitle">${title}</h2><p>Completa los campos para actualizar los datos de demostración.</p></div><button type="button" class="modal-close" data-modal-action="close" aria-label="Cerrar ventana">×</button></div><form id="entityForm" class="modal-form" data-entity="${entity}"><div class="form-grid">${fields}</div><div class="modal-actions"><button type="button" class="button secondary" data-modal-action="close">Cancelar</button><button type="submit" class="button primary">${existing ? 'Guardar cambios' : 'Crear registro'}</button></div></form></section></div>`;
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

function handleModalSubmit(event) {
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
  if (entity === 'coordinators' && record.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(record.email)) {
    $('#field-email', form).focus();
    showToast('Ingresa un correo con un formato válido.', true);
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
  const record = data[entity]?.find(item => item.id === id);
  if (!config || !record) return;
  const label = record.name || record.question || config.singular;
  if (!window.confirm(`¿Seguro que quieres eliminar «${label}» de los datos de demostración?`)) return;
  data[entity] = data[entity].filter(item => item.id !== id);
  const saved = saveData();
  renderApp();
  if (saved) showToast('Registro eliminado de los datos locales.');
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
