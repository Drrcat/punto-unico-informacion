// 1. Ubicamos los elementos de la pantalla
const listaAreas = document.getElementById("lista-areas");
const buscador = document.getElementById("buscador");
const contador = document.getElementById("contador");

// 2. Variable para guardar las áreas una vez cargadas
let areas = [];

// 3. Cargamos las áreas desde la API
mostrarMensaje(listaAreas, "Cargando áreas...");
pedirApi("/areas")
  .then(datos => {
    areas = datos;
    mostrarAreas(areas);
  })
  .catch(error => {
    console.error("Error al cargar las áreas:", error);
    mostrarMensaje(listaAreas, "No pudimos cargar las áreas. Intenta nuevamente en un momento.", true);
  });

// Arma el texto de ubicación: "Sala A-101 · Piso 1 · Edificio A"
function textoUbicacion(espacio) {
  if (!espacio) return "Consulta en el mesón de informaciones";
  const partes = [espacio.nombre ? `${espacio.nombre} (${espacio.codigo})` : `Sala ${espacio.codigo}`];
  if (espacio.piso) {
    partes.push(espacio.piso.nombre || `Piso ${espacio.piso.numero}`);
    if (espacio.piso.edificio) partes.push(espacio.piso.edificio.nombre);
  }
  return partes.join(" · ");
}

// Una fila de dato (icono, título y valor). Si no hay valor, no se muestra.
function dato(icono, titulo, valor) {
  if (!valor) return "";
  return `
    <div class="dato">
      <span class="dato-icono" aria-hidden="true">${icono}</span>
      <div><b>${titulo}</b><span>${escapar(valor)}</span></div>
    </div>`;
}

// 4. Función que dibuja las áreas en pantalla
function mostrarAreas(lista) {
  mostrarContador(contador, lista.length);
  if (lista.length === 0) {
    mostrarMensaje(listaAreas, "No encontramos un área para esa búsqueda. Prueba con otra palabra.");
    return;
  }

  listaAreas.innerHTML = lista.map(area => `
    <div class="tarjeta">
      <button class="tarjeta-boton" aria-expanded="false">
        <div>
          <strong>${escapar(area.nombre)}</strong>
          ${area.descripcion ? `<small>${escapar(area.descripcion)}</small>` : ""}
        </div>
      </button>
      <div class="tarjeta-detalle">
        <div class="datos">
          ${dato("📍", "Dónde está", textoUbicacion(area.espacio))}
          ${dato("🕘", "Horario de atención", area.horario_atencion)}
          ${dato("✉️", "Correo", area.correo_contacto)}
          ${dato("☎️", "Anexo", area.anexo)}
        </div>
      </div>
    </div>
  `).join("");
}

// 5. Buscador en vivo: filtra por nombre o descripción del área
buscador.addEventListener("input", () => {
  const texto = normalizar(buscador.value.trim());
  const filtradas = areas.filter(area =>
    normalizar(`${area.nombre} ${area.descripcion}`).includes(texto)
  );
  mostrarAreas(filtradas);
});

// 6. Abrir / cerrar el detalle al tocar
activarTarjetas(listaAreas);
