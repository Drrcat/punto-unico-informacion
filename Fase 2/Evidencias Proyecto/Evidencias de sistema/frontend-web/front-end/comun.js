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
