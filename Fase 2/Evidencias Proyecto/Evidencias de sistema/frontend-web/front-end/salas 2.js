// 1. Ubicamos los elementos de la pantalla
const listaSalas = document.getElementById("lista-salas");
const buscador = document.getElementById("buscador");
const contador = document.getElementById("contador");
const filtroPisos = document.getElementById("filtro-pisos");
const filtroTipos = document.getElementById("filtro-tipos");

// 2. Filtros elegidos (vacío = todos)
const filtros = { pisoId: "", tipoEspacioId: "" };
let temporizadorBusqueda = null;
let ultimaConsulta = 0;

// 3. Cargamos los pisos y los tipos de espacio para los filtros, y luego la lista
Promise.all([pedirApi("/pisos"), pedirApi("/salas/tipos")])
  .then(([pisos, tipos]) => {
    dibujarFiltro(filtroPisos, "pisoId", pisos.map(piso => ({ id: piso.id, nombre: piso.nombre || `Piso ${piso.numero}` })));
    dibujarFiltro(filtroTipos, "tipoEspacioId", tipos);
  })
  .catch(error => console.error("Error al cargar los filtros:", error))
  .finally(cargarSalas);

// Botones de filtro: "Todos" + una opción por cada piso o tipo
function dibujarFiltro(contenedor, campo, opciones) {
  contenedor.innerHTML = [{ id: "", nombre: "Todos" }, ...opciones].map(opcion => `
    <button type="button" class="filtro${String(opcion.id) === filtros[campo] ? " activo" : ""}" data-id="${opcion.id}">
      ${escapar(opcion.nombre)}
    </button>
  `).join("");

  contenedor.addEventListener("click", evento => {
    const boton = evento.target.closest(".filtro");
    if (!boton) return;
    filtros[campo] = boton.dataset.id;
    contenedor.querySelectorAll(".filtro").forEach(b => b.classList.toggle("activo", b === boton));
    cargarSalas();
  });
}

// 4. Pedimos los espacios a la API. La búsqueda la hace el backend: reconoce códigos, nombres,
//    alias y el área que funciona en cada sala, y queda registrada para las estadísticas del tótem.
function cargarSalas() {
  const parametros = new URLSearchParams({ limite: "100" });
  const texto = buscador.value.trim();
  if (texto) parametros.set("q", texto);
  if (filtros.pisoId) parametros.set("pisoId", filtros.pisoId);
  if (filtros.tipoEspacioId) parametros.set("tipoEspacioId", filtros.tipoEspacioId);

  // Si llega tarde la respuesta de una búsqueda anterior, se descarta
  const consulta = ++ultimaConsulta;
  if (!listaSalas.children.length) mostrarMensaje(listaSalas, "Cargando espacios...");

  pedirApi(`/salas?${parametros}`)
    .then(respuesta => {
      if (consulta === ultimaConsulta) mostrarSalas(respuesta.items);
    })
    .catch(error => {
      console.error("Error al cargar las salas:", error);
      if (consulta === ultimaConsulta) mostrarMensaje(listaSalas, "No pudimos cargar los espacios. Intenta nuevamente en un momento.", true);
    });
}

// 5. Función que dibuja los espacios en pantalla
function mostrarSalas(lista) {
  mostrarContador(contador, lista.length);
  if (lista.length === 0) {
    mostrarMensaje(listaSalas, "No encontramos un espacio con esa búsqueda. Prueba con otra palabra o quita los filtros.");
    return;
  }

  listaSalas.innerHTML = lista.map(sala => {
    const piso = sala.piso.nombre || `Piso ${sala.piso.numero}`;
    const areas = sala.areas.map(area => area.nombre).join(", ");
    return `
      <div class="tarjeta fila-sala">
        <div>
          <span class="etiqueta">${escapar(sala.tipo.nombre)}</span>
          <strong>${escapar(sala.nombre || sala.codigo)}</strong>
          <small>${escapar([sala.nombre ? `Código ${sala.codigo}` : "", piso, sala.edificio.nombre].filter(Boolean).join(" · "))}</small>
          ${areas ? `<small>Aquí funciona: ${escapar(areas)}</small>` : ""}
        </div>
        ${sala.svgElementId ? `<a class="boton-mapa" href="${urlMapa(sala.svgElementId, sala.piso.numero)}">🗺️ Ver en el mapa</a>` : ""}
      </div>`;
  }).join("");
}

// 6. Buscador: espera a que la persona deje de escribir para no consultar la API por cada letra
buscador.addEventListener("input", () => {
  clearTimeout(temporizadorBusqueda);
  temporizadorBusqueda = setTimeout(cargarSalas, 350);
});
