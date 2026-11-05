'use strict';

// Clave de los antiguos datos de demostración: se borra al iniciar para no dejar restos en el equipo.
const LEGACY_DEMO_KEY = 'pui-desktop-demo-v1';
const API_BASE_URL = 'http://localhost:3000';

const SECTION_META = {
  overview: { title: 'Resumen', breadcrumb: 'PANEL ADMINISTRATIVO' },
  rooms: { title: 'Gestión de salas', breadcrumb: 'CONTENIDOS DEL TÓTEM' },
  areas: { title: 'Áreas', breadcrumb: 'DIRECTORIO INSTITUCIONAL' },
  faqs: { title: 'Preguntas frecuentes', breadcrumb: 'CENTRO DE AYUDA' },
  enrollments: { title: 'Solicitudes de enrolamiento', breadcrumb: 'SEGUIMIENTO' }
};

const ENTITY_CONFIG = {
  rooms: {
    singular: 'sala', plural: 'salas', title: 'salas',
    description: 'Mantén actualizada la información de las salas y espacios del campus.',
    emptyTitle: 'Todavía no hay salas', emptyText: 'Agrega una sala para comenzar a organizar los espacios.',
    fields: [
      { name: 'name', label: 'Nombre de la sala', placeholder: 'Ej. Laboratorio de informática 1', required: true, full: true },
      { name: 'code', label: 'Código o número', placeholder: 'Ej. LAB-101', required: true },
      { name: 'floor', label: 'Piso', required: true, select: true },
      { name: 'typeId', label: 'Tipo de espacio', required: true, select: true },
      { name: 'location', label: 'Referencia / ubicación', placeholder: 'Ej. Ala norte, junto a biblioteca', full: true }
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

// Estados que entrega GET /api/enrolamiento/solicitudes. `css` reutiliza las clases de enrollments.css.
const ENROLLMENT_STATUS = {
  VERIFICACION_PENDIENTE: { label: 'Verificando correo', css: 'started' },
  VERIFICACION_EXPIRADA: { label: 'Código vencido', css: 'cancelled' },
  VERIFICACION_RECHAZADA: { label: 'Código rechazado', css: 'failed' },
  INICIADO: { label: 'Iniciado', css: 'started' },
  FOTO_PENDIENTE: { label: 'Foto pendiente', css: 'photo_pending' },
  COMPLETADO: { label: 'Completado', css: 'completed' },
  FALLIDO: { label: 'Fallido', css: 'failed' },
  CANCELADO: { label: 'Cancelado', css: 'cancelled' }
};

const ENROLLMENT_ERROR_SOURCE = {
  CORREO: 'Envío del código por correo',
  GOOGLE_VISION: 'Validación de la fotografía',
  ENROLAMIENTO: 'Sistema de enrolamiento'
};

// Sesión del administrador: token entregado por POST /api/auth/login. Se borra al cerrar sesión o al vencer.
const ADMIN_TOKEN_KEY = 'pui-desktop-admin-token';
let sessionExpiredNotified = false;

function getAdminToken() {
  try { return localStorage.getItem(ADMIN_TOKEN_KEY) || ''; } catch (_) { return ''; }
}

function setAdminToken(token) {
  try {
    if (token) localStorage.setItem(ADMIN_TOKEN_KEY, token);
    else localStorage.removeItem(ADMIN_TOKEN_KEY);
  } catch (error) {
    console.warn('No fue posible guardar el token de administrador en este equipo.', error);
  }
}

// Todo sale de la API: hasta que responde, las listas quedan vacías y se muestra "Cargando…".
let data = { rooms: [], areas: [], faqs: [] };
let activeSection = 'overview';
let searchQuery = '';
let editingId = null;
let toastTimer = null;
let faqCategories = [];
let faqLoading = false;
let faqLoaded = false;
let faqError = '';
let roomsLoaded = false;
let areasLoaded = false;
let infrastructureLoading = false;
let infrastructureError = '';
let roomFloors = [];
let roomTypes = [];
let roomSpaces = [];
let enrollmentStatusFilter = 'all';
let enrollmentDateFilter = '7';
let selectedEnrollmentId = null;
let enrollments = [];
let enrollmentsTotal = 0;
let enrollmentsLoading = false;
let enrollmentsLoaded = false;
let enrollmentsError = '';
let enrollmentsRequest = 0;
const ENROLLMENT_PAGE_SIZE = 100;

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

async function apiRequest(path, options = {}) {
  const { skipSessionCheck = false, ...fetchOptions } = options;
  const token = getAdminToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...fetchOptions,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...fetchOptions.headers
    }
  });
  let result = null;
  if (response.status !== 204) {
    const text = await response.text();
    try { result = text ? JSON.parse(text) : null; } catch (_) { result = null; }
  }
  if (!response.ok) {
    // El backend responde { statusCode, codigo, mensaje }; `message` queda por compatibilidad con Nest.
    const raw = result?.mensaje ?? result?.message;
    const message = Array.isArray(raw) ? raw.join('. ') : raw;
    const error = new Error(message || `La API respondió con el estado ${response.status}.`);
    error.status = response.status;
    error.code = result?.codigo;
    // Con una sesión abierta, un 401 significa que venció o fue cerrada: se vuelve al inicio de sesión.
    if (response.status === 401 && token && !skipSessionCheck) handleSessionExpired();
    throw error;
  }
  return result;
}

/**
 * Todas las salas, incluidas las inactivas (`todas=true`, solo administradores). La API entrega como
 * máximo 100 por página, así que se recorren las páginas hasta completar el total.
 */
async function fetchAllRooms() {
  const PAGE = 100;
  const rooms = [];
  for (let offset = 0; ; offset += PAGE) {
    const page = await apiRequest(`/api/salas?todas=true&limite=${PAGE}&desplazamiento=${offset}`);
    if (!page || !Array.isArray(page.items)) throw new Error('La API devolvió las salas con un formato inesperado.');
    rooms.push(...page.items);
    if (page.items.length < PAGE || rooms.length >= Number(page.total)) return rooms;
  }
}

async function loadInfrastructure() {
    if (infrastructureLoading) return;
    infrastructureLoading = true;
    infrastructureError = '';
    roomsLoaded = false;
    areasLoaded = false;
    $('#apiStatus').textContent = 'Conectando…';
    if (activeSection === 'rooms' || activeSection === 'areas') renderEntitySection(activeSection);
    try {
      const [rooms, areasResponse, floors, types] = await Promise.all([
        fetchAllRooms(),
        apiRequest('/api/areas'),
        apiRequest('/api/pisos'),
        apiRequest('/api/salas/tipos')
      ]);
      if (!Array.isArray(rooms) || !Array.isArray(areasResponse) || !Array.isArray(floors) || !Array.isArray(types)) {
        throw new Error('La API devolvió datos de Planos Sede con un formato inesperado.');
      }
      roomFloors = floors;
      roomTypes = types;
      roomSpaces = rooms;
      data.rooms = rooms.map(room => ({
        id: room.id,
        name: room.nombre || room.codigo,
        code: room.codigo,
        floor: String(room.piso?.numero ?? room.piso?.id ?? ''),
        pisoId: room.piso?.id,
        typeId: room.tipo?.id,
        active: room.activo !== false,
        location: [room.piso?.nombre, room.activo === false ? 'Inactiva' : ''].filter(Boolean).join(' · ')
      }));
      data.areas = areasResponse.map(area => {
        const ubicacion = area.ubicacion;
        const location = ubicacion
          ? [ubicacion.edificio?.nombre, ubicacion.piso ? `Piso ${ubicacion.piso.numero ?? ubicacion.piso}` : '', ubicacion.sala?.codigo ? `Sala ${ubicacion.sala.codigo}` : '']
            .filter(Boolean).join(', ')
          : '';
        return {
          id: area.id,
          name: area.nombre,
          description: area.descripcion || '',
          location,
          espacioId: ubicacion?.sala?.id ?? null,
          phone: area.contacto?.anexo || '',
          email: area.contacto?.correo || '',
          schedule: area.horarioAtencion || ''
        };
      });
      roomsLoaded = true;
      areasLoaded = true;
      $('#apiStatus').textContent = 'Conectada';
    } catch (error) {
      console.error('No fue posible cargar salas y áreas desde la API.', error);
      // No se dejan datos anteriores a la vista: la lista queda vacía con el error y un botón para reintentar.
      data.rooms = [];
      data.areas = [];
      infrastructureError = error instanceof TypeError
        ? 'No fue posible conectar con el servidor. Verifica que el backend esté en ejecución.'
        : (error instanceof Error && error.message) || 'No fue posible cargar los datos.';
      $('#apiStatus').textContent = 'Desconectada';
    } finally {
      infrastructureLoading = false;
      renderApp();
    }
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

async function loadEnrollments() {
  if (!getAdminToken()) return false;
  const request = ++enrollmentsRequest;
  enrollmentsLoading = true;
  enrollmentsError = '';
  if (activeSection === 'enrollments') renderEnrollmentSection();

  const params = new URLSearchParams({ limite: String(ENROLLMENT_PAGE_SIZE) });
  if (enrollmentStatusFilter !== 'all') params.set('estado', enrollmentStatusFilter);
  if (enrollmentDateFilter !== 'all') {
    params.set('desde', new Date(Date.now() - Number(enrollmentDateFilter) * 24 * 60 * 60 * 1000).toISOString());
  }

  try {
    const response = await apiRequest(`/api/enrolamiento/solicitudes?${params}`);
    if (request !== enrollmentsRequest) return false; // Llegó una consulta más nueva (cambio de filtro).
    if (!response || !Array.isArray(response.items)) {
      throw new Error('La API devolvió las solicitudes de enrolamiento con un formato inesperado.');
    }
    enrollments = response.items.map(toEnrollmentView);
    enrollmentsTotal = Number(response.total) || enrollments.length;
    enrollmentsLoaded = true;
    if (!enrollments.some(item => item.id === selectedEnrollmentId)) selectedEnrollmentId = enrollments[0]?.id ?? null;
    return true;
  } catch (error) {
    if (request !== enrollmentsRequest) return false;
    enrollments = [];
    enrollmentsTotal = 0;
    enrollmentsLoaded = false;
    if (error.status === 403) {
      enrollmentsError = error.message || 'Tu rol no tiene permiso para consultar las solicitudes de enrolamiento.';
    } else {
      enrollmentsError = error instanceof Error ? error.message : 'No fue posible conectar con la API.';
    }
    console.error('No fue posible cargar las solicitudes de enrolamiento desde la API.', error);
    return false;
  } finally {
    if (request === enrollmentsRequest) {
      enrollmentsLoading = false;
      $('#enrollmentNavCount').textContent = enrollmentsLoaded ? enrollmentsTotal : '—';
      if (activeSection === 'enrollments') renderEnrollmentSection();
    }
  }
}

function toEnrollmentView(item) {
  const verification = item.verificacion || {};
  const enrollment = item.enrolamiento || null;
  const captures = enrollment?.capturas || [];
  const errors = enrollment?.errores || [];
  const lastCapture = captures[captures.length - 1];
  const lastError = errors[errors.length - 1];
  const failedCodes = Number(verification.codigosFallidos) || 0;

  const emailVerification = ({
    VERIFICADA: verification.resueltoEn ? `Verificado el ${formatEnrollmentDate(new Date(verification.resueltoEn))}` : 'Verificado',
    PENDIENTE: item.estado === 'VERIFICACION_EXPIRADA' ? 'El código venció sin usarse' : 'Esperando el código de verificación',
    EXPIRADA: 'El código venció sin usarse',
    RECHAZADA: 'Rechazada por demasiados códigos incorrectos'
  })[verification.estado] || '—';

  let photoValidation = enrollment ? 'Fotografía pendiente' : 'No iniciada';
  if (lastCapture) {
    const confidence = lastCapture.confianza === null || lastCapture.confianza === undefined
      ? ''
      : ` (confianza ${Math.round(Number(lastCapture.confianza) * 100)} %)`;
    photoValidation = lastCapture.rostroValido
      ? `Rostro válido${confidence}`
      : `Rechazada: ${lastCapture.motivoRechazo || 'sin motivo registrado'}`;
    if (captures.length > 1) photoValidation += ` · ${captures.length} fotografías`;
  }

  const error = lastError
    ? `${ENROLLMENT_ERROR_SOURCE[lastError.servicio] || lastError.servicio}: ${lastError.mensaje}${lastError.codigoHttp ? ` [HTTP ${lastError.codigoHttp}]` : ''} (${formatEnrollmentTime(lastError.creadoEn)})`
    : '—';

  const detail = ({
    VERIFICACION_PENDIENTE: 'Esperando que ingrese el código enviado al correo',
    VERIFICACION_EXPIRADA: 'El código venció antes de ser ingresado',
    VERIFICACION_RECHAZADA: 'Demasiados códigos incorrectos',
    INICIADO: 'Correo verificado, enrolamiento iniciado',
    FOTO_PENDIENTE: 'Correo verificado, falta una fotografía válida',
    COMPLETADO: 'Fotografía enviada al sistema de enrolamiento',
    FALLIDO: lastError ? ENROLLMENT_ERROR_SOURCE[lastError.servicio] || 'Falló un servicio externo' : 'No fue posible completar el enrolamiento',
    CANCELADO: 'Solicitud cancelada o abandonada'
  })[item.estado] || '—';

  return {
    id: String(item.id),
    createdAt: new Date(item.solicitadoEn),
    email: item.correo,
    status: item.estado,
    totem: item.totem || '',
    failedCodes,
    detail,
    emailVerification,
    photoValidation,
    imageDeleted: captures.length > 0 && captures.every(capture => capture.imagenEliminadaEn),
    error
  };
}

function formatEnrollmentTime(iso) {
  if (!iso) return '';
  return new Intl.DateTimeFormat('es-CL', { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

function escapeHTML(value) {
  return String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function getAreaLocation(area) {
  return area.location || '';
}

function init() {
  if (window.desktopApp?.runtime) $('#runtimeLabel').textContent = window.desktopApp.runtime;
  try { localStorage.removeItem(LEGACY_DEMO_KEY); } catch (_) { /* Sin acceso al almacenamiento: no hay nada que limpiar. */ }
  $('#loginForm').addEventListener('submit', handleLogin);
  $('#logoutButton').addEventListener('click', logout);
  $$('.nav-item').forEach(button => button.addEventListener('click', () => navigate(button.dataset.section)));
  $('#appContent').addEventListener('click', handleContentClick);
  $('#appContent').addEventListener('input', handleSearchInput);
  $('#appContent').addEventListener('change', handleContentChange);
  $('#modalRoot').addEventListener('click', handleModalClick);
  $('#modalRoot').addEventListener('submit', handleModalSubmit);
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape') closeModal();
  });
  void restoreSession();
}

/** Si quedó un token guardado y sigue vigente, entra directo al panel. */
async function restoreSession() {
  if (!getAdminToken()) return;
  try {
    const user = await apiRequest('/api/auth/sesion', { skipSessionCheck: true });
    enterApp(user);
  } catch (error) {
    // Solo se descarta el token si la API lo rechazó; si el backend no responde se puede reintentar al ingresar.
    if (error.status === 401) setAdminToken('');
    else console.warn('No fue posible comprobar la sesión guardada.', error);
  }
}

async function handleLogin(event) {
  event.preventDefault();
  const email = $('#loginEmail').value.trim().toLowerCase();
  const password = $('#loginPassword').value;
  const errorBox = $('#loginError');
  const submit = $('#loginSubmit');
  errorBox.hidden = true;
  submit.disabled = true;
  setAdminToken('');
  try {
    const session = await apiRequest('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ correo: email, clave: password }),
      skipSessionCheck: true
    });
    setAdminToken(session.token);
    $('#loginPassword').value = '';
    enterApp(session.usuario);
  } catch (error) {
    errorBox.textContent = error instanceof TypeError
      ? 'No fue posible conectar con el servidor. Verifica que el backend esté en ejecución.'
      : error.message || 'No fue posible iniciar sesión.';
    errorBox.hidden = false;
  } finally {
    submit.disabled = false;
  }
}

function enterApp(user) {
  sessionExpiredNotified = false;
  const fullName = [user?.nombres, user?.apellidos].filter(Boolean).join(' ') || 'Administrador';
  const initials = fullName.split(/\s+/).map(part => part[0]).join('').slice(0, 2).toUpperCase();
  $('#userName').textContent = fullName;
  $('#userEmail').textContent = user?.correo || 'Personal autorizado';
  $('#userInitials').textContent = initials || 'AD';
  $('#loginError').hidden = true;
  $('#loginScreen').hidden = true;
  $('#appScreen').hidden = false;
  activeSection = 'overview';
  renderApp();
  if (!faqLoaded && !faqLoading) void loadFaqs();
  if (!roomsLoaded && !infrastructureLoading) void loadInfrastructure();
}

function handleSessionExpired() {
  if (sessionExpiredNotified || $('#appScreen').hidden) return;
  sessionExpiredNotified = true;
  resetSession();
  const errorBox = $('#loginError');
  errorBox.textContent = 'Tu sesión expiró o fue cerrada. Ingresa nuevamente.';
  errorBox.hidden = false;
}

async function logout() {
  if (getAdminToken()) {
    try {
      await apiRequest('/api/auth/logout', { method: 'POST', skipSessionCheck: true });
    } catch (error) {
      console.warn('No fue posible cerrar la sesión en el servidor; se cierra solo en este equipo.', error);
    }
  }
  resetSession();
  $('#loginError').hidden = true;
}

/** Olvida la sesión y los datos cargados con ella, y vuelve a la pantalla de ingreso. */
function resetSession() {
  closeModal();
  setAdminToken('');
  enrollments = [];
  enrollmentsTotal = 0;
  enrollmentsLoaded = false;
  enrollmentsError = '';
  selectedEnrollmentId = null;
  faqLoaded = false;
  roomsLoaded = false;
  areasLoaded = false;
  infrastructureError = '';
  data = { rooms: [], areas: [], faqs: [] };
  $('#appScreen').hidden = true;
  $('#loginScreen').hidden = false;
  $('#loginPassword').value = '';
}

function navigate(section) {
  if (!SECTION_META[section]) return;
  activeSection = section;
  searchQuery = '';
  renderApp();
  if (section === 'faqs' && !faqLoaded && !faqLoading) void loadFaqs();
  if ((section === 'rooms' || section === 'areas') && !roomsLoaded && !infrastructureLoading) void loadInfrastructure();
  if (section === 'enrollments' && !enrollmentsLoaded && !enrollmentsLoading) void loadEnrollments();
}

function renderApp() {
  const meta = SECTION_META[activeSection];
  $('#topbarTitle').textContent = meta.title;
  $('#breadcrumb').textContent = meta.breadcrumb;
  $$('.nav-item').forEach(button => button.classList.toggle('active', button.dataset.section === activeSection));
  $('#roomNavCount').textContent = roomsLoaded ? data.rooms.length : '—';
  $('#areaNavCount').textContent = areasLoaded ? data.areas.length : '—';
  $('#faqNavCount').textContent = faqLoaded ? data.faqs.length : '—';
  $('#enrollmentNavCount').textContent = enrollmentsLoaded ? enrollmentsTotal : '—';
  if (activeSection === 'overview') renderOverview();
  else if (activeSection === 'enrollments') renderEnrollmentSection();
  else renderEntitySection(activeSection);
}

function renderEnrollmentSection() {
  const heading = (actions) => `
    <div class="page-heading enrollment-heading">
      <div><p class="eyebrow">SEGUIMIENTO</p><h1>Solicitudes de enrolamiento</h1><p>Consulta el estado de cada enrolamiento y detecta fallas. Esta vista es de solo lectura.</p></div>
      <div class="heading-actions">${actions}</div>
    </div>`;

  const selected = enrollments.find(enrollment => enrollment.id === selectedEnrollmentId) || enrollments[0];
  const rows = enrollments.map(enrollment => {
    const status = ENROLLMENT_STATUS[enrollment.status] || { label: enrollment.status, css: 'started' };
    return `
    <tr class="enrollment-row ${selected?.id === enrollment.id ? 'selected' : ''}" tabindex="0" role="button" aria-pressed="${selected?.id === enrollment.id}" data-enrollment-id="${escapeHTML(enrollment.id)}">
      <td>${formatEnrollmentDate(enrollment.createdAt)}</td>
      <td>${escapeHTML(enrollment.email)}</td>
      <td><span class="enrollment-status ${status.css}">${escapeHTML(status.label)}</span></td>
      <td>${enrollment.failedCodes}</td>
      <td>${escapeHTML(enrollment.detail)}</td>
    </tr>`;
  }).join('');
  const detail = selected ? `
    <section class="enrollment-detail" aria-label="Detalle de la solicitud seleccionada">
      <h2>Detalle de la solicitud seleccionada</h2>
      <p class="enrollment-detail-meta">${escapeHTML(selected.email)} · ${formatEnrollmentDate(selected.createdAt)}${selected.totem ? ` · ${escapeHTML(selected.totem)}` : ''}</p>
      <div class="enrollment-detail-grid">
        <div><strong>Verificación del correo</strong><span>${escapeHTML(selected.emailVerification)}</span></div>
        <div><strong>Validación de la fotografía</strong><span>${escapeHTML(selected.photoValidation)}${selected.imageDeleted ? '<br>Imagen ya eliminada del equipo' : ''}</span></div>
        <div class="${selected.error === '—' ? '' : 'has-error'}"><strong>Error registrado</strong><span>${escapeHTML(selected.error)}</span></div>
      </div>
    </section>
  ` : '';

  let emptyRow = '<tr><td class="empty-state" colspan="5"><strong>No hay solicitudes para mostrar</strong><span>Prueba con otros filtros.</span></td></tr>';
  if (enrollmentsLoading) emptyRow = '<tr><td class="empty-state" colspan="5"><strong>Cargando solicitudes…</strong><span>Consultando la base de datos.</span></td></tr>';
  else if (enrollmentsError) emptyRow = `<tr><td class="empty-state" colspan="5"><strong>No se pudieron cargar las solicitudes</strong><span>${escapeHTML(enrollmentsError)}</span></td></tr>`;

  const statusOptions = Object.entries(ENROLLMENT_STATUS)
    .map(([value, status]) => `<option value="${value}">Estado: ${escapeHTML(status.label)}</option>`).join('');
  const count = enrollmentsLoading
    ? 'Cargando…'
    : enrollmentsTotal > enrollments.length
      ? `Mostrando ${enrollments.length} de ${enrollmentsTotal} registros`
      : `${enrollments.length} registros`;

  $('#appContent').innerHTML = `
    ${heading('<button class="button primary" data-action="refresh-enrollments">Actualizar</button>')}
    <div class="enrollment-toolbar">
      <label class="enrollment-filter"><span class="visually-hidden">Filtrar por estado</span><select id="enrollmentStatusFilter" class="field-control"><option value="all">Estado: Todos</option>${statusOptions}</select></label>
      <label class="enrollment-filter"><span class="visually-hidden">Filtrar por fecha</span><select id="enrollmentDateFilter" class="field-control"><option value="7">Fecha: últimos 7 días</option><option value="30">Fecha: últimos 30 días</option><option value="90">Fecha: últimos 90 días</option><option value="all">Fecha: todas</option></select></label>
      <span class="result-count">${count}</span>
    </div>
    <div class="table-wrap enrollment-table-wrap"><table class="data-table enrollment-table"><thead><tr><th>Fecha y hora</th><th>Usuario</th><th>Estado</th><th>Códigos fallidos</th><th>Detalle</th></tr></thead><tbody>${rows || emptyRow}</tbody></table></div>
    ${detail}
    <p class="enrollment-demo-note">Datos de la base de datos. Las fotografías no se muestran ni se conservan: solo queda el resultado de su validación.</p>
  `;
  $('#enrollmentStatusFilter').value = enrollmentStatusFilter;
  $('#enrollmentDateFilter').value = enrollmentDateFilter;
}


function formatEnrollmentDate(date) {
  return new Intl.DateTimeFormat('es-CL', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: false
  }).format(date).replace(/\./g, '');
}

function handleContentChange(event) {
  if (event.target.matches('#enrollmentStatusFilter')) {
    enrollmentStatusFilter = event.target.value;
    void loadEnrollments();
  } else if (event.target.matches('#enrollmentDateFilter')) {
    enrollmentDateFilter = event.target.value;
    void loadEnrollments();
  }
}

function renderOverview() {
  const modules = [
    { section: 'rooms', icon: '⌂', title: 'Gestión de salas', subtitle: 'Espacios y ubicaciones del campus', count: roomsLoaded ? data.rooms.length : '—' },
    { section: 'areas', icon: '⌖', title: 'Áreas', subtitle: 'Directorio y ubicación de atención', count: areasLoaded ? data.areas.length : '—' },
    { section: 'faqs', icon: '?', title: 'Preguntas frecuentes', subtitle: 'Respuestas para consultas habituales', count: faqLoaded ? data.faqs.length : '—' }
  ];
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">VISTA GENERAL</p><h1>¡Bienvenido al panel!</h1><p>Administra los contenidos que verá la comunidad estudiantil en el tótem.</p></div><div class="heading-actions"><button class="button primary" data-action="create" data-entity="rooms">＋ Agregar sala</button></div></div>
    <div class="kpi-grid">
      ${kpiCard('Salas registradas', roomsLoaded ? data.rooms.length : '—', '⌂', 'Espacios del campus')}
      ${kpiCard('Áreas', areasLoaded ? data.areas.length : '—', '⌖', 'Puntos de atención')}
      ${kpiCard('Preguntas frecuentes', faqLoaded ? data.faqs.length : '—', '?', 'Respuestas disponibles')}
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
    <div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Conectado a la API</strong>Los cambios se guardan en la base de datos con tu sesión de administrador y quedan visibles en el tótem.</div></div>
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
      ? `<div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Áreas conectadas a la API</strong>Los cambios se guardan en la base de datos y el directorio del tótem se actualiza de inmediato. La ubicación se elige entre los espacios del plano.</div></div>`
      : `<div class="callout"><span class="callout-icon">ⓘ</span><div><strong>Salas conectadas a la API</strong>Los cambios se guardan en la base de datos y son visibles en el buscador y el mapa del tótem. Se listan también las salas inactivas.</div></div>`;
  $('#appContent').innerHTML = `
    <div class="page-heading"><div><p class="eyebrow">GESTIÓN DE CONTENIDO</p><h1>${config.title.charAt(0).toUpperCase()}${config.title.slice(1)}</h1><p>${config.description}</p></div><div class="heading-actions">${headerActions}</div></div>
    <div class="toolbar"><label class="search-box"><span aria-hidden="true">⌕</span><input id="searchInput" type="search" value="${escapeHTML(searchQuery)}" placeholder="Buscar ${config.plural}…" aria-label="Buscar ${config.plural}"></label><span class="result-count">${filtered.length} de ${list.length} registros</span></div>
    <div class="table-wrap"><table class="data-table"><thead><tr>${config.columns.map(column => `<th>${column.label}</th>`).join('')}<th style="text-align:right">ACCIONES</th></tr></thead><tbody>${renderTableRows(entity, filtered, config)}</tbody></table></div>
    ${callout}
  `;
}

function renderTableRows(entity, rows, config) {
  const colspan = config.columns.length + 1;
  const isInfrastructure = entity === 'rooms' || entity === 'areas';
  const loading = isInfrastructure ? infrastructureLoading : faqLoading;
  const loadError = isInfrastructure ? infrastructureError : faqError;
  if (rows.length === 0 && loading) {
    return `<tr><td class="empty-state" colspan="${colspan}"><strong>Cargando ${config.plural}…</strong><span>Consultando la base de datos.</span></td></tr>`;
  }
  if (rows.length === 0 && loadError) {
    const retry = isInfrastructure ? 'retry-infrastructure' : 'retry-faqs';
    return `<tr><td class="empty-state" colspan="${colspan}"><strong>No se pudieron cargar las ${config.plural}</strong><span>${escapeHTML(loadError)}</span><br><br><button class="button primary" data-action="${retry}">Reintentar</button></td></tr>`;
  }
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
  const enrollmentRow = event.target.closest('[data-enrollment-id]');
  if (enrollmentRow) {
    selectedEnrollmentId = enrollmentRow.dataset.enrollmentId;
    renderEnrollmentSection();
    return;
  }
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const { action, entity, id, section } = button.dataset;
  if (action === 'navigate') navigate(section);
  if (action === 'retry-infrastructure') void loadInfrastructure();
  if (action === 'retry-faqs') void loadFaqs();
  if (action === 'refresh-enrollments') {
    void loadEnrollments().then(loaded => { if (loaded) showToast('Solicitudes actualizadas desde la base de datos.'); });
  }
  if (action === 'create') openModal(entity);
  if (action === 'edit') openModal(entity, id);
  if (action === 'delete') deleteRecord(entity, id);
}

document.addEventListener('keydown', event => {
  const row = event.target.closest?.('[data-enrollment-id]');
  if (!row || (event.key !== 'Enter' && event.key !== ' ')) return;
  event.preventDefault();
  selectedEnrollmentId = row.dataset.enrollmentId;
  renderEnrollmentSection();
});

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
  if ((entity === 'rooms' && !roomsLoaded) || (entity === 'areas' && !areasLoaded)) {
    showToast('La conexión con Planos Sede todavía está cargando.', true);
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
        : field.name === 'floor'
          ? existing?.pisoId ?? ''
          : field.name === 'typeId'
            ? existing?.typeId ?? ''
          : field.name === 'location' && entity === 'areas'
            ? existing?.espacioId ?? ''
        : existing?.[field.name] ?? '';
    const required = field.required ? 'required' : '';
    const placeholder = escapeHTML(field.placeholder || '');
    const options = field.name === 'category_id'
      ? faqCategories.map(category => ({ value: String(category.id), label: category.nombre }))
      : field.name === 'location'
        ? roomSpaces.map(room => ({ value: String(room.id), label: `${room.codigo}${room.nombre ? ` - ${room.nombre}` : ''}` }))
        : field.name === 'floor'
          ? roomFloors.map(floor => ({ value: String(floor.id), label: `Piso ${floor.numero} - ${floor.nombre}` }))
          : field.name === 'typeId'
            ? roomTypes.map(type => ({ value: String(type.id), label: type.nombre }))
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
    : entity === 'rooms'
      ? 'Los cambios se guardarán en la base de datos de Planos Sede.'
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
        method: editingId ? 'PUT' : 'POST',
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
  if (entity === 'rooms') {
    const wasEditing = editingId !== null;
    const payload = {
      pisoId: Number(record.floor),
      tipoEspacioId: Number(record.typeId),
      codigo: record.code,
      // `activo` no se envía: al editar se conserva el estado actual (antes toda edición reactivaba la sala).
      nombre: record.name || null
    };
    const submitButton = $('button[type="submit"]', form);
    submitButton.disabled = true;
    try {
      await apiRequest(editingId ? `/api/salas/${editingId}` : '/api/salas', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      closeModal();
      roomsLoaded = false;
      await loadInfrastructure();
      showToast(wasEditing ? 'Sala actualizada en Planos Sede.' : 'Sala creada en Planos Sede.');
    } catch (error) {
      console.error('No fue posible guardar la sala en la API.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible guardar la sala.', true);
      submitButton.disabled = false;
    }
    return;
  }
  if (entity === 'areas') {
    const wasEditing = editingId !== null;
    const payload = {
      nombre: record.name,
      descripcion: record.description || null,
      espacioId: record.location ? Number(record.location) : null,
      correoContacto: record.email || null,
      anexo: record.phone || null,
      horarioAtencion: record.schedule || null
    };
    const submitButton = $('button[type="submit"]', form);
    submitButton.disabled = true;
    try {
      await apiRequest(editingId ? `/api/areas/${editingId}` : '/api/areas', {
        method: editingId ? 'PUT' : 'POST',
        body: JSON.stringify(payload)
      });
      closeModal();
      areasLoaded = false;
      await loadInfrastructure();
      showToast(wasEditing ? 'Área actualizada en Planos Sede.' : 'Área creada en Planos Sede.');
    } catch (error) {
      console.error('No fue posible guardar el área en la API.', error);
      showToast(error instanceof Error ? error.message : 'No fue posible guardar el área.', true);
      submitButton.disabled = false;
    }
    return;
  }
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
  if (entity === 'rooms') {
    if (!window.confirm(`¿Seguro que quieres eliminar «${label}» de la base de datos?`)) return;
    void deleteInfrastructureRecord('salas', id, 'Sala');
    return;
  }
  if (entity === 'areas') {
    if (!window.confirm(`¿Seguro que quieres eliminar «${label}» de la base de datos?`)) return;
    void deleteInfrastructureRecord('areas', id, 'Área');
  }
}

async function deleteInfrastructureRecord(resource, id, singular) {
  try {
    await apiRequest(`/api/${resource}/${id}`, { method: 'DELETE' });
    roomsLoaded = false;
    areasLoaded = false;
    await loadInfrastructure();
    showToast(`${singular} eliminada en Planos Sede.`);
  } catch (error) {
    console.error(`No fue posible eliminar ${singular.toLowerCase()} desde la API.`, error);
    showToast(error instanceof Error ? error.message : `No fue posible eliminar ${singular.toLowerCase()}.`, true);
  }
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
