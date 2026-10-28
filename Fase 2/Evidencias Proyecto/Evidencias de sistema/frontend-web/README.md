# Web del tótem — Punto Único de Información

Interfaz táctil del tótem de orientación estudiantil. HTML, CSS y JavaScript puro (sin frameworks); los datos vienen de la API del backend.

## Pantallas

| Archivo | Pantalla | API que usa |
|---|---|---|
| `index.html` | Menú principal | — |
| `faqs.html` | Preguntas frecuentes (con buscador) | `GET /faqs` |
| `areas.html` | ¿Dónde debo ir? (directorio de áreas) | `GET /areas` |
| `tramites.html` | Guía de trámites (pasos y requisitos) | `GET /tramites`, `GET /tramites/:id` |
| `mapa.html` | Mapa y Salas: muestra en un iframe el mapa interactivo de Patricia (`OrientaSede_Mapa_Piso2y3_v2.html?marco=0`), sin modificarlo | — (datos dentro del mapa) |

Archivos compartidos:

- `styles.css`: estilos de todas las pantallas (misma paleta que la app de escritorio).
- `comun.js`: dirección de la API (`API_URL`) y funciones comunes.
- `totem.js`: modo tótem (ver abajo).

## Cómo probarla

1. Levantar el backend (carpeta `../backend`, por defecto en `http://localhost:3000`).
2. Servir la carpeta `front-end/` con cualquier servidor estático, por ejemplo:

   ```bash
   cd "Fase 2/Evidencias Proyecto/Evidencias de sistema/frontend-web/front-end"
   python3 -m http.server 5500
   ```

3. Abrir `http://localhost:5500`.

Si el backend está en otra dirección, se cambia `API_URL` en `comun.js`.

## Modo tótem

`totem.js` se carga en todas las pantallas y hace lo siguiente:

- **Reinicio por inactividad**: si nadie toca la pantalla por 60 segundos, aparece el aviso "¿Sigues ahí?" con una cuenta regresiva de 15 segundos. Si nadie responde, vuelve al menú principal, para que el siguiente estudiante no vea la consulta del anterior. Los tiempos se cambian en las constantes `SEGUNDOS_SIN_USO` y `SEGUNDOS_DE_AVISO`.
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
