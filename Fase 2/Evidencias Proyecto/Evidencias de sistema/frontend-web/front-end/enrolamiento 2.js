// Enrolamiento facial (módulo de Patricia en el backend: /api/enrolamiento).
// 1. La persona escribe su correo institucional y el backend le envía un código.
// 2. Escribe el código; si es correcto, el backend entrega un token para enviar la foto.
// 3. Se toma la foto con la cámara del tótem y se envía; el backend la revisa y la registra.

// 1. Ubicamos los elementos de la pantalla
const pasos = {
  correo: document.getElementById("paso-correo"),
  codigo: document.getElementById("paso-codigo"),
  foto: document.getElementById("paso-foto"),
  listo: document.getElementById("paso-listo"),
};
const etapas = document.getElementById("etapas");
const avisoPantalla = document.getElementById("aviso");
const campoCorreo = document.getElementById("correo");
const campoCodigo = document.getElementById("codigo");
const video = document.getElementById("video");
const vistaPrevia = document.getElementById("vista-previa");
const lienzo = document.getElementById("lienzo");
const botones = {
  tomar: document.getElementById("tomar-foto"),
  enviar: document.getElementById("enviar-foto"),
  repetir: document.getElementById("repetir-foto"),
  subir: document.getElementById("subir-foto"),
};

// 2. Lo que vamos sabiendo de la solicitud en curso
const solicitud = { intentoId: null, enrolamientoId: null, token: null, completada: false };
let camara = null;   // la transmisión de la cámara, para apagarla al salir
let foto = null;     // la foto tomada (Blob) que se enviará

// 3. Al abrir la pantalla, preguntamos si el enrolamiento está habilitado en esta sede
pedirApi("/enrolamiento/estado")
  .then(estado => {
    if (!estado.activo) {
      avisar("El enrolamiento facial no está habilitado en esta sede.", true);
      return;
    }
    const dominios = estado.dominiosAceptados.map(d => `@${d}`).join(" o ");
    document.getElementById("dominios").textContent = `Debe terminar en ${dominios}. Te enviaremos un código para confirmar que es tuyo.`;
    etapas.hidden = false;
    irA("correo");
  })
  .catch(error => {
    console.error("Error al consultar el enrolamiento:", error);
    avisar("No pudimos conectarnos. Intenta nuevamente en un momento.", true);
  });

// Muestra un solo paso y marca la etapa en la que vamos
function irA(paso) {
  Object.entries(pasos).forEach(([nombre, elemento]) => (elemento.hidden = nombre !== paso));
  etapas.querySelectorAll("li").forEach(li => li.classList.toggle("activa", li.dataset.paso === paso));
  if (paso === "listo") etapas.hidden = true;
  if (paso === "foto") encenderCamara();
  else apagarCamara();
  quitarAviso();
  window.scrollTo(0, 0);
}

function avisar(texto, esError = false) {
  avisoPantalla.textContent = texto;
  avisoPantalla.className = `mensaje${esError ? " error" : ""}`;
  avisoPantalla.hidden = false;
}
function quitarAviso() {
  avisoPantalla.hidden = true;
}

// Desactiva el botón mientras se espera a la API, para que no se envíe dos veces
async function esperando(boton, tarea) {
  boton.disabled = true;
  try {
    await tarea();
  } catch (error) {
    avisar(error.message, true);
  } finally {
    boton.disabled = false;
  }
}

// 4. Paso 1: enviar el código al correo
pasos.correo.addEventListener("submit", evento => {
  evento.preventDefault();
  esperando(evento.submitter, async () => {
    const respuesta = await enviarApi("/enrolamiento/autenticar", { correo: campoCorreo.value.trim() });
    solicitud.intentoId = respuesta.intentoId;
    document.getElementById("texto-codigo").textContent =
      `Lo enviamos a ${respuesta.correo}. Vence en ${respuesta.vigenciaMin} minutos.`;
    campoCodigo.value = "";
    irA("codigo");
    campoCodigo.focus();
  });
});

// 5. Paso 2: validar el código
pasos.codigo.addEventListener("submit", evento => {
  evento.preventDefault();
  esperando(evento.submitter, async () => {
    try {
      const respuesta = await enviarApi(`/enrolamiento/autenticar/${solicitud.intentoId}/codigo`, { codigo: campoCodigo.value.trim() });
      solicitud.enrolamientoId = respuesta.enrolamientoId;
      solicitud.token = respuesta.token;
      document.getElementById("saludo").textContent = `Hola, ${respuesta.usuario.nombres}. Ahora tomemos tu foto.`;
      irA("foto");
    } catch (error) {
      // Si quedan intentos lo decimos; si no, hay que pedir otro código
      const restantes = error.datos?.intentosRestantes;
      throw new Error(restantes != null ? `${error.message} Te quedan ${restantes} intentos.` : error.message);
    }
  });
});

document.getElementById("otro-correo").addEventListener("click", () => irA("correo"));

// 6. Paso 3: la cámara
async function encenderCamara() {
  mostrarFotoTomada(false);
  if (camara) return;
  try {
    camara = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 } }, audio: false });
    video.srcObject = camara;
    botones.subir.hidden = true;
    mostrarFotoTomada(false);
  } catch (error) {
    console.error("No se pudo encender la cámara:", error);
    avisar("No pudimos encender la cámara. Puedes elegir una foto del equipo.", true);
    botones.tomar.hidden = true;
    botones.subir.hidden = false;
  }
}

function apagarCamara() {
  camara?.getTracks().forEach(pista => pista.stop());
  camara = null;
}

// Cambia entre "viendo la cámara" y "revisando la foto tomada"
function mostrarFotoTomada(tomada) {
  video.hidden = tomada;
  vistaPrevia.hidden = !tomada;
  botones.tomar.hidden = tomada || !camara;
  botones.enviar.hidden = !tomada;
  botones.repetir.hidden = !tomada;
}

botones.tomar.addEventListener("click", () => {
  lienzo.width = video.videoWidth;
  lienzo.height = video.videoHeight;
  lienzo.getContext("2d").drawImage(video, 0, 0);
  lienzo.toBlob(blob => usarFoto(blob), "image/jpeg", 0.9);
});

document.getElementById("archivo-foto").addEventListener("change", evento => {
  const archivo = evento.target.files[0];
  if (archivo) usarFoto(archivo);
  evento.target.value = "";
});

function usarFoto(blob) {
  foto = blob;
  if (vistaPrevia.src) URL.revokeObjectURL(vistaPrevia.src);
  vistaPrevia.src = URL.createObjectURL(blob);
  quitarAviso();
  mostrarFotoTomada(true);
}

botones.repetir.addEventListener("click", () => {
  quitarAviso();
  mostrarFotoTomada(false);
});

botones.enviar.addEventListener("click", () => {
  esperando(botones.enviar, async () => {
    const formulario = new FormData();
    formulario.append("foto", foto, "foto.jpg");
    try {
      await enviarApi(`/enrolamiento/${solicitud.enrolamientoId}/foto`, formulario, solicitud.token);
      solicitud.completada = true;
      irA("listo");
    } catch (error) {
      // Foto rechazada (cara tapada, borrosa...): se puede tomar otra. Otros errores: volver a empezar.
      if (error.codigo === "FOTO_RECHAZADA" || error.codigo === "IMAGEN_INVALIDA") mostrarFotoTomada(false);
      throw error;
    }
  });
});

// 7. Cancelar: se avisa al backend para que borre la solicitud y cualquier foto pendiente
function cancelarEnBackend() {
  if (!solicitud.enrolamientoId || solicitud.completada) return;
  fetch(`${API_URL}/enrolamiento/${solicitud.enrolamientoId}/cancelar`, {
    method: "POST",
    headers: { Authorization: `Bearer ${solicitud.token}` },
    keepalive: true,   // para que se envíe aunque la página se esté cerrando
  }).catch(() => {});
  solicitud.enrolamientoId = null;
}

document.getElementById("cancelar").addEventListener("click", () => {
  cancelarEnBackend();
  window.location.href = "index.html";
});

// Si la persona se va (botón Inicio o el modo tótem por inactividad), la solicitud se cancela y la cámara se apaga
window.addEventListener("pagehide", () => {
  cancelarEnBackend();
  apagarCamara();
});
