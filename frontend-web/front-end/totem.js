// Modo tótem: comportamiento de pantalla táctil de autoatención.
// - Si nadie toca la pantalla por un rato, muestra un aviso y vuelve al inicio,
//   para que el siguiente estudiante no vea lo que consultó el anterior.
// - Bloquea gestos que en un tótem molestan (menú al mantener presionado, zoom, arrastrar).
// La pantalla completa la da el navegador en modo kiosco (ver README).

// Tiempos en segundos. Se pueden ajustar aquí.
const SEGUNDOS_SIN_USO = 60;   // sin tocar la pantalla antes de mostrar el aviso
const SEGUNDOS_DE_AVISO = 15;  // cuenta regresiva del aviso antes de volver al inicio

const esInicio = !!document.querySelector(".menu");
let temporizadorInactividad = null;
let temporizadorAviso = null;
let aviso = null;

// Vuelve al menú principal (en el inicio solo sube la pantalla)
function volverAlInicio() {
  if (esInicio) {
    cerrarAviso();
    window.scrollTo(0, 0);
    reiniciarTemporizador();
  } else {
    window.location.href = "index.html";
  }
}

// Crea el aviso "¿Sigues ahí?" una sola vez y lo deja oculto
function crearAviso() {
  aviso = document.createElement("div");
  aviso.className = "aviso-inactividad";
  aviso.hidden = true;
  aviso.setAttribute("role", "alertdialog");
  aviso.setAttribute("aria-labelledby", "aviso-titulo");
  aviso.innerHTML = `
    <div class="aviso-caja">
      <h2 id="aviso-titulo">¿Sigues ahí?</h2>
      <p>Volveremos al inicio en <b id="aviso-segundos">${SEGUNDOS_DE_AVISO}</b> segundos.</p>
      <button class="aviso-boton" type="button">Sí, seguir aquí</button>
    </div>
  `;
  document.body.appendChild(aviso);
}

function mostrarAviso() {
  let restantes = SEGUNDOS_DE_AVISO;
  const contador = aviso.querySelector("#aviso-segundos");
  contador.textContent = restantes;
  aviso.hidden = false;

  temporizadorAviso = setInterval(() => {
    restantes--;
    contador.textContent = restantes;
    if (restantes <= 0) {
      clearInterval(temporizadorAviso);
      volverAlInicio();
    }
  }, 1000);
}

function cerrarAviso() {
  clearInterval(temporizadorAviso);
  aviso.hidden = true;
}

// Cada vez que alguien usa la pantalla, el conteo parte de cero
function reiniciarTemporizador() {
  clearTimeout(temporizadorInactividad);
  // En el inicio no hay nada que limpiar, así que no se muestra el aviso
  const alCumplirse = esInicio ? volverAlInicio : mostrarAviso;
  temporizadorInactividad = setTimeout(alCumplirse, SEGUNDOS_SIN_USO * 1000);
}

function registrarActividad() {
  if (!aviso.hidden) cerrarAviso();
  reiniciarTemporizador();
}

crearAviso();
["pointerdown", "keydown", "input", "wheel", "touchmove"].forEach(evento =>
  document.addEventListener(evento, registrarActividad, { passive: true })
);
reiniciarTemporizador();

// Si el navegador muestra la página desde su caché al tocar "atrás", reiniciamos el conteo
window.addEventListener("pageshow", evento => {
  if (evento.persisted) registrarActividad();
});

// Gestos bloqueados en el tótem
document.addEventListener("contextmenu", evento => evento.preventDefault()); // mantener presionado
document.addEventListener("dragstart", evento => evento.preventDefault());   // arrastrar enlaces
document.addEventListener("gesturestart", evento => evento.preventDefault()); // pellizcar (Safari)
