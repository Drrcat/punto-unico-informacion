// 1. Ubicamos los elementos de la pantalla
const listaFaqs = document.getElementById("lista-faqs");
const buscador = document.getElementById("buscador");
const contador = document.getElementById("contador");

// 2. Variable para guardar las preguntas una vez cargadas
let faqs = [];

// 3. Cargamos las preguntas publicadas desde la API
mostrarMensaje(listaFaqs, "Cargando preguntas...");
pedirApi("/faq")
  .then(datos => {
    faqs = datos;
    mostrarFaqs(faqs);
  })
  .catch(error => {
    console.error("Error al cargar las FAQ:", error);
    mostrarMensaje(listaFaqs, "No pudimos cargar las preguntas. Intenta nuevamente en un momento.", true);
  });

// 4. Función que dibuja las preguntas en pantalla
function mostrarFaqs(lista) {
  mostrarContador(contador, lista.length);
  if (lista.length === 0) {
    mostrarMensaje(listaFaqs, "No encontramos preguntas con esa búsqueda.");
    return;
  }

  listaFaqs.innerHTML = lista.map(faq => `
    <div class="tarjeta">
      <button class="tarjeta-boton" aria-expanded="false">
        <div>
          ${faq.categoria ? `<span class="etiqueta">${escapar(faq.categoria.nombre)}</span>` : ""}
          <strong>${escapar(faq.pregunta)}</strong>
        </div>
      </button>
      <div class="tarjeta-detalle">
        ${escapar(faq.respuesta)}
        ${faq.area ? `<p class="nota">Área responsable: ${escapar(faq.area.nombre)}</p>` : ""}
      </div>
    </div>
  `).join("");
}

// 5. Buscador en vivo: filtra por pregunta, respuesta o categoría
buscador.addEventListener("input", () => {
  const texto = normalizar(buscador.value.trim());
  const filtradas = faqs.filter(faq =>
    normalizar(`${faq.pregunta} ${faq.respuesta} ${faq.categoria?.nombre}`).includes(texto)
  );
  mostrarFaqs(filtradas);
});

// 6. Abrir / cerrar respuestas al tocar
activarTarjetas(listaFaqs);
