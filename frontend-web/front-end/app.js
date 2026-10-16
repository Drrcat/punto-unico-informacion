// 1. Ubicamos el contenedor donde irán las preguntas
const listaFaqs = document.getElementById("lista-faqs");

// 2. Variable para guardar las preguntas una vez cargadas
let faqs = [];

// 3. Cargamos el archivo faqs.json
fetch("http://localhost:3000/faqs")
  .then(respuesta => respuesta.json())
  .then(datos => {
    faqs = datos;          // guardamos los datos
    mostrarFaqs(faqs);     // los dibujamos en pantalla
  })
  .catch(error => {
    console.error("Error al cargar las FAQ:", error);
  });

// 4. Función que dibuja las preguntas en pantalla
function mostrarFaqs(lista) {
  listaFaqs.innerHTML = "";  // limpiamos antes de dibujar

  lista.forEach(faq => {
    const card = document.createElement("div");
    card.className = "faq-card";

    card.innerHTML = `
      <button class="faq-pregunta">${faq.pregunta}</button>
      <div class="faq-respuesta">${faq.respuesta}</div>
    `;

    listaFaqs.appendChild(card);
  });
}