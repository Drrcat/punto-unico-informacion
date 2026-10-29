# Web del tótem — Punto Único de Información

Interfaz táctil del tótem de orientación estudiantil. HTML, CSS y JavaScript puro (sin frameworks); los datos vienen de la API del backend.

## Pantallas

| Archivo | Pantalla | API que usa |
|---|---|---|
| `index.html` | Menú principal (la opción de enrolamiento solo aparece si está habilitado) | `GET /api/enrolamiento/estado` |
| `faqs.html` | Preguntas frecuentes (con buscador) | `GET /api/faq` |
| `areas.html` | ¿Dónde debo ir? (directorio de áreas) | `GET /api/areas` |
| `tramites.html` | Guía de trámites (pasos y requisitos) | `GET /api/tramites`, `GET /api/tramites/:id` |
| `mapa.html` | Mapa de la sede: barra "Inicio" + el mapa de Patricia (`mapa-totem.html`) en un iframe. Acepta `?sala=<svgElementId>&piso=<número>` para marcar un espacio | — |
| `mapa-totem.html` | Mapa interactivo de Patricia (pisos 2 y 3), con sus planos en `assets/planos/`. No se edita: es de Patricia | `GET /api/pisos`, `GET /api/pisos/:id/plano`, `GET /api/salas` |
| `salas.html` | Salas y espacios: lista con buscador y filtros por piso y tipo; cada espacio tiene "Ver en el mapa" | `GET /api/salas`, `GET /api/salas/tipos`, `GET /api/pisos` |
| `enrolamiento.html` | Enrolamiento facial: correo institucional → código de 6 dígitos → foto con la cámara | `/api/enrolamiento/*` |

En áreas y trámites aparece "Ver en el mapa" cuando el área tiene una sala asignada en la base (`area.espacio_id`).

Archivos compartidos:

- `styles.css`: estilos de todas las pantallas (misma paleta que la app de escritorio).
- `comun.js`: dirección de la API (`API_URL`, `http://localhost:3000/api`) y funciones comunes (`pedirApi`, `enviarApi`, `urlMapa`...).
- `inicio.js`: muestra u oculta la opción de enrolamiento en el menú.
- `totem.js`: modo tótem (ver abajo).

## Cómo probarla

La forma más simple: levantar el backend (carpeta `../backend`, `npm run start:dev`). Con `PUBLIC_DIR=../frontend-web/front-end` en su `.env`, el mismo backend entrega la web y el mapa en `http://localhost:3000`.

También se puede servir aparte (el backend permite ese origen con `CORS_ORIGENES`):

1. Levantar el backend en `http://localhost:3000`.
2. Servir la carpeta `front-end/` con cualquier servidor estático, por ejemplo:

   ```bash
   cd "Fase 2/Evidencias Proyecto/Evidencias de sistema/frontend-web/front-end"
   python3 -m http.server 5500
   ```

3. Abrir `http://localhost:5500`.

Si el backend está en otra dirección, se cambia `API_URL` en `comun.js`.

### Probar el enrolamiento

El módulo se habilita en la tabla `configuracion_sistema` (`modulo_enrolamiento_activo=true`, `conector_enrolamiento`, `dominios_correo`). Sin `CORREO_API_KEY` ni credenciales de Google Vision en el `.env`, el backend trabaja en modo simulado:

- el código de 6 dígitos **no llega al correo: aparece en la consola del backend** (`[SIMULADO] Código para ...`);
- cualquier foto se acepta y no se envía a ningún sistema externo.

La cámara solo funciona en `localhost` o con HTTPS (regla del navegador). Si el equipo no tiene cámara, la pantalla ofrece elegir una foto del equipo.

## Modo tótem

`totem.js` se carga en todas las pantallas y hace lo siguiente:

- **Reinicio por inactividad** (también en el mapa: `mapa.html` reenvía los toques del iframe): si nadie toca la pantalla por 60 segundos, aparece el aviso "¿Sigues ahí?" con una cuenta regresiva de 15 segundos. Si nadie responde, vuelve al menú principal, para que el siguiente estudiante no vea la consulta del anterior. Los tiempos se cambian en las constantes `SEGUNDOS_SIN_USO` y `SEGUNDOS_DE_AVISO`.
- Al salir del enrolamiento a medias (botón Inicio o inactividad), la solicitud se cancela en el backend y la cámara se apaga.
- **Gestos bloqueados**: sin zoom (doble toque o pellizco), sin menú al mantener presionado y sin arrastrar enlaces.

### Pantalla completa (modo kiosco)

La pantalla completa la entrega el navegador, no la página: como la web tiene varias páginas, la pantalla completa que se activa desde JavaScript se perdería en cada cambio de página. En el equipo del tótem se abre el navegador en modo kiosco (pantalla completa, sin barra de direcciones ni pestañas):

**Windows**

```bat
"C:\Program Files\Google\Chrome\Application\chrome.exe" --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://localhost:5500
```

**Linux**

```bash
google-chrome --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://localhost:5500
```

**macOS**

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --kiosk --noerrdialogs --disable-pinch --overscroll-history-navigation=0 http://localhost:5500
```

Para salir del modo kiosco: `Alt + F4` (Windows/Linux) o `Cmd + Q` (macOS).

La interfaz está pensada para una pantalla vertical (por ejemplo 1080 × 1920).
