// Pantalla "Mapa y Salas": punto de integración con el mapa 2D de Patricia.
// Esta pantalla NO dibuja el mapa: solo deja listo dónde se monta el plano SVG,
// cómo se resalta una sala y dónde se muestran sus datos.

// 1. Ubicamos los elementos de la pantalla
const plano = document.getElementById("plano");
const detalleSala = document.getElementById("detalle-sala");
const buscador = document.getElementById("buscador");
const contador = document.getElementById("contador");

// 2. Carga el plano SVG de un piso dentro de #plano.
//    El SVG se inserta como HTML (no como <img>) para poder resaltar sus salas por id.
async function cargarPlano() {
  // TODO (Patricia): descomentar cuando exista el SVG del plano y confirmar la ruta.
  // La tabla piso tiene la columna plano_svg_ruta; cuando la API de pisos esté lista,
  // la ruta debería salir de ahí en vez de quedar fija en el código.
  //
  // try {
  //   const respuesta = await fetch("planos/piso-1.svg");
  //   if (!respuesta.ok) throw new Error(`No se encontró el plano (${respuesta.status})`);
  //   plano.innerHTML = await respuesta.text();
  // } catch (error) {
  //   console.error("Error al cargar el plano:", error);
  //   mostrarMensaje(plano, "No pudimos cargar el mapa. Intenta nuevamente en un momento.", true);
  // }
}

// 3. Resalta una sala en el plano.
//    svgElementId es el campo espacio.svg_element_id de la base (ya viene en GET /areas).
//    Debe coincidir con el id del elemento de la sala dentro del SVG.
function resaltarSala(svgElementId) {
  // Quitamos el resaltado anterior
  plano.querySelectorAll(".sala-activa").forEach(elemento => elemento.classList.remove("sala-activa"));

  if (!svgElementId) return false;
  const sala = plano.querySelector(`[id="${CSS.escape(svgElementId)}"]`);
  if (!sala) return false;   // el plano no está cargado o la sala no está en este piso

  sala.classList.add("sala-activa");
  sala.scrollIntoView({ behavior: "smooth", block: "center" });
  return true;
}

// 4. Muestra los datos de la sala seleccionada.
//    Recibe un objeto con la forma de "espacio" de la API:
//    { codigo, nombre, svg_element_id, piso: { numero, nombre, edificio: { nombre } } }
function mostrarDetalleSala(espacio) {
  const piso = espacio.piso;
  detalleSala.innerHTML = `
    <div class="tarjeta abierta">
      <div class="tarjeta-detalle">
        <div class="datos">
          <div class="dato">
            <span class="dato-icono" aria-hidden="true">📍</span>
            <div><b>Sala</b><span>${escapar(espacio.nombre ? `${espacio.nombre} (${espacio.codigo})` : espacio.codigo)}</span></div>
          </div>
          ${piso ? `
            <div class="dato">
              <span class="dato-icono" aria-hidden="true">🏢</span>
              <div><b>Piso</b><span>${escapar(piso.nombre || `Piso ${piso.numero}`)}${piso.edificio ? ` · ${escapar(piso.edificio.nombre)}` : ""}</span></div>
            </div>` : ""}
        </div>
      </div>
    </div>
  `;
  resaltarSala(espacio.svg_element_id);
}

// 5. Buscador de salas.
//    TODO (Patricia): la búsqueda consumirá la API de Infraestructura y Salas cuando
//    esté disponible: GET /salas (todas, para buscar por código, nombre o alias) y
//    GET /pisos/:id/salas (las de un piso, para cargar su plano). Por ahora NO se llama.
//    Al tocar un resultado, se debe llamar a mostrarDetalleSala(sala), que ya resalta
//    la sala en el plano con resaltarSala(sala.svg_element_id).
buscador.addEventListener("input", () => {
  contador.textContent = "";
  if (buscador.value.trim() === "") {
    detalleSala.innerHTML = "";
    return;
  }
  mostrarMensaje(detalleSala, "La búsqueda de salas estará disponible cuando se conecte el mapa de la sede.");
});

cargarPlano();
