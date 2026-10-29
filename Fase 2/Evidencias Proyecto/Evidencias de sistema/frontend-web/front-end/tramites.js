// 1. Ubicamos los elementos de la pantalla
const vistaLista = document.getElementById("vista-lista");
const vistaDetalle = document.getElementById("vista-detalle");
const listaTramites = document.getElementById("lista-tramites");
const detalleTramite = document.getElementById("detalle-tramite");
const buscador = document.getElementById("buscador");
const contador = document.getElementById("contador");

// 2. Variable para guardar los trámites una vez cargados
let tramites = [];

// 3. Cargamos la lista de trámites activos desde la API
mostrarMensaje(listaTramites, "Cargando trámites...");
pedirApi("/tramites")
  .then(datos => {
    tramites = datos;
    mostrarTramites(tramites);
  })
  .catch(error => {
    console.error("Error al cargar los trámites:", error);
    mostrarMensaje(listaTramites, "No pudimos cargar los trámites. Intenta nuevamente en un momento.", true);
  });

// Texto del plazo: "1 día hábil" / "5 días hábiles"
function textoPlazo(dias) {
  if (dias == null) return "";
  return dias === 1 ? "1 día hábil" : `${dias} días hábiles`;
}

// 4. Función que dibuja la lista de trámites
function mostrarTramites(lista) {
  mostrarContador(contador, lista.length);
  if (lista.length === 0) {
    mostrarMensaje(listaTramites, "No encontramos trámites con esa búsqueda.");
    return;
  }

  listaTramites.innerHTML = lista.map(tramite => `
    <div class="tarjeta navega">
      <button class="tarjeta-boton" data-id="${tramite.id}">
        <div>
          <span class="etiqueta">${escapar(tramite.area.nombre)}</span>
          <strong>${escapar(tramite.nombre)}</strong>
          ${tramite.descripcion ? `<small>${escapar(tramite.descripcion)}</small>` : ""}
        </div>
      </button>
    </div>
  `).join("");
}

// 5. Al tocar un trámite, pedimos su guía completa y mostramos el detalle
listaTramites.addEventListener("click", evento => {
  const boton = evento.target.closest(".tarjeta-boton");
  if (boton) abrirTramite(Number(boton.dataset.id));
});

function abrirTramite(id) {
  vistaLista.hidden = true;
  vistaDetalle.hidden = false;
  window.scrollTo(0, 0);
  mostrarMensaje(detalleTramite, "Cargando trámite...");

  pedirApi(`/tramites/${id}`)
    .then(mostrarDetalle)
    .catch(error => {
      console.error("Error al cargar el trámite:", error);
      mostrarMensaje(detalleTramite, "No pudimos cargar este trámite. Intenta nuevamente.", true);
    });
}

// 6. Función que dibuja el detalle: resumen, pasos y requisitos
function mostrarDetalle(tramite) {
  const pasos = tramite.pasos.map(paso => `
    <li class="paso">
      <span class="paso-numero">${paso.orden}</span>
      <div>
        <strong>${escapar(paso.titulo)}</strong>
        <p>${escapar(paso.descripcion)}</p>
      </div>
    </li>
  `).join("");

  const requisitos = tramite.requisitos.map(req => `
    <li class="requisito">
      ${escapar(req.nombre)}
      ${req.obligatorio ? "" : "<em>Opcional</em>"}
    </li>
  `).join("");

  detalleTramite.innerHTML = `
    <article class="detalle-tramite">
      <span class="etiqueta">${escapar(tramite.area.nombre)}</span>
      <h2>${escapar(tramite.nombre)}</h2>
      ${tramite.descripcion ? `<p>${escapar(tramite.descripcion)}</p>` : ""}

      <div class="resumen-tramite">
        ${tramite.plazoDias != null ? `
          <div class="dato">
            <span class="dato-icono" aria-hidden="true">⏱️</span>
            <div><b>Plazo de respuesta</b><span>${textoPlazo(tramite.plazoDias)}</span></div>
          </div>` : ""}
        <div class="dato">
          <span class="dato-icono" aria-hidden="true">📍</span>
          <div><b>Dónde se realiza</b><span>${escapar(tramite.area.nombre)}</span></div>
        </div>
        ${tramite.area.horarioAtencion ? `
          <div class="dato">
            <span class="dato-icono" aria-hidden="true">🕘</span>
            <div><b>Horario de atención</b><span>${escapar(tramite.area.horarioAtencion)}</span></div>
          </div>` : ""}
      </div>
      ${botonMapa(tramite.area.ubicacion)}

      ${requisitos ? `<h3>Lo que necesitas</h3><ul class="requisitos">${requisitos}</ul>` : ""}
      ${pasos ? `<h3>Paso a paso</h3><ol class="pasos">${pasos}</ol>` : ""}
    </article>
  `;
}

// 7. Volver a la lista
document.getElementById("volver-lista").addEventListener("click", () => {
  vistaDetalle.hidden = true;
  vistaLista.hidden = false;
});

// 8. Buscador en vivo: filtra por nombre, descripción o área
buscador.addEventListener("input", () => {
  const texto = normalizar(buscador.value.trim());
  const filtrados = tramites.filter(tramite =>
    normalizar(`${tramite.nombre} ${tramite.descripcion} ${tramite.area.nombre}`).includes(texto)
  );
  mostrarTramites(filtrados);
});
