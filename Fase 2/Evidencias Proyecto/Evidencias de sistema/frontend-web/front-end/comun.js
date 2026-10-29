// Funciones que comparten todas las pantallas del tótem.

// Dirección de la API del backend. Si cambia (por ejemplo con Docker), se cambia solo aquí.
// Sirve igual si la web la entrega el backend (localhost:3000) o un servidor aparte (localhost:5500).
const API_URL = "http://localhost:3000/api";

// Pide datos a la API y devuelve el JSON. Lanza un error si la respuesta no es OK.
async function pedirApi(ruta) {
  const respuesta = await fetch(API_URL + ruta);
  if (!respuesta.ok) throw new Error(`La API respondió ${respuesta.status}`);
  return respuesta.json();
}

// Envía datos a la API (POST). Acepta JSON o un FormData (para la foto) y un token opcional.
// Si la API responde con error, lanza un Error con su "mensaje" y su "codigo" (ver FiltroErrores del backend).
async function enviarApi(ruta, cuerpo, token) {
  const esFormulario = cuerpo instanceof FormData;
  const encabezados = {};
  if (!esFormulario) encabezados["Content-Type"] = "application/json";
  if (token) encabezados["Authorization"] = `Bearer ${token}`;

  const respuesta = await fetch(API_URL + ruta, {
    method: "POST",
    headers: encabezados,
    body: esFormulario ? cuerpo : JSON.stringify(cuerpo ?? {}),
  });
  const datos = await respuesta.json().catch(() => ({}));
  if (!respuesta.ok) {
    const error = new Error(datos.mensaje || "No pudimos completar la operación. Intenta nuevamente.");
    error.codigo = datos.codigo;
    error.datos = datos;
    throw error;
  }
  return datos;
}

// Dirección del mapa con un espacio marcado. La ubicación viene de la API: { sala: { svgElementId }, piso: { numero } }
function urlMapa(svgElementId, pisoNumero) {
  const parametros = new URLSearchParams();
  if (svgElementId) parametros.set("sala", svgElementId);
  if (pisoNumero) parametros.set("piso", pisoNumero);
  return `mapa.html?${parametros}`;
}

// Botón "Ver en el mapa" para un área con ubicación. Si el espacio no está dibujado en el plano, no se muestra.
function botonMapa(ubicacion) {
  if (!ubicacion?.sala?.svgElementId) return "";
  return `<a class="boton-mapa" href="${urlMapa(ubicacion.sala.svgElementId, ubicacion.piso?.numero)}">🗺️ Ver en el mapa</a>`;
}

// Evita que el texto que viene de la base se interprete como HTML
function escapar(texto) {
  const div = document.createElement("div");
  div.textContent = texto ?? "";
  return div.innerHTML;
}

// Deja el texto en minúsculas y sin tildes, para que "matricula" encuentre "Matrícula"
function normalizar(texto) {
  return (texto ?? "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}

// Muestra un mensaje en el contenedor (cargando, error o sin resultados)
function mostrarMensaje(contenedor, texto, esError = false) {
  contenedor.innerHTML = `<p class="mensaje${esError ? " error" : ""}">${escapar(texto)}</p>`;
}

// Activa el abrir/cerrar de las tarjetas: al tocar una se abre y se cierran las demás
function activarTarjetas(contenedor) {
  contenedor.addEventListener("click", evento => {
    const boton = evento.target.closest(".tarjeta-boton");
    if (!boton) return;
    const tarjeta = boton.parentElement;
    if (tarjeta.classList.contains("navega")) return;

    const estabaAbierta = tarjeta.classList.contains("abierta");
    contenedor.querySelectorAll(".tarjeta.abierta").forEach(t => t.classList.remove("abierta"));
    if (!estabaAbierta) tarjeta.classList.add("abierta");
    boton.setAttribute("aria-expanded", String(!estabaAbierta));
  });
}

// Actualiza el texto "N resultados"
function mostrarContador(elemento, cantidad) {
  elemento.textContent = cantidad === 1 ? "1 resultado" : `${cantidad} resultados`;
}
