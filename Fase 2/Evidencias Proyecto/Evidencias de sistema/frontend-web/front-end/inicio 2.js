// Menú principal: la opción de enrolamiento solo se muestra si el módulo está habilitado en esta sede.
// Si la API no responde, la opción queda oculta y el resto del menú funciona igual.
pedirApi("/enrolamiento/estado")
  .then(estado => {
    document.getElementById("opcion-enrolamiento").hidden = !estado.activo;
  })
  .catch(error => console.error("Error al consultar el enrolamiento:", error));
