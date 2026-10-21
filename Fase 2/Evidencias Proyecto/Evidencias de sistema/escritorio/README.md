# Punto Único de Información — Aplicación de escritorio

Aplicación administrativa de Electron + HTML + CSS + JavaScript.

## Qué incluye

- Inicio de sesión de demostración.
- Navegación entre Resumen, Salas, Áreas, Preguntas frecuentes y Solicitudes de enrolamiento.
- Seguimiento de enrolamientos de solo lectura con filtros por estado y fecha, selección de solicitud y detalle de validaciones.
- CRUD de preguntas frecuentes conectado a la API y la base de datos PostgreSQL.
- CRUD local de salas y áreas, persistido en `localStorage`.
- Listado y ubicaciones de áreas basados en los ejemplos locales del mockup, sin depender de la API de salas.
- Búsqueda en listados y validaciones básicas de formularios.
- `contextIsolation`, `nodeIntegration: false`, `sandbox` y un `preload.js` mínimo.

## Ejecutar en Windows

1. Inicia el backend en `http://localhost:3000` (ver [instrucciones del backend](../../../../backend/README.md)).
2. Configura `FAQ_CREATED_BY_ID` al iniciar el backend con el id de un usuario existente en la base de datos.
3. Asegúrate de que `categoria_faq` tenga al menos una categoría.
4. Abre PowerShell en esta carpeta y ejecuta:

   ```powershell
   npm install
   npm start
   ```

La primera instalación requiere conexión a internet para descargar Electron. El escritorio usa `http://localhost:3000` como dirección de la API.

## Credenciales de demostración

- Correo: `admin@demo.local`
- Contraseña: `demo1234`

Este acceso es una simulación y no se conecta al sistema de usuarios. `FAQ_CREATED_BY_ID` permite cumplir la relación de autoría de la base de datos; no sustituye la autenticación institucional.

## Integración FAQ

La sección Preguntas frecuentes consulta `GET /faqs/admin` y `GET /faqs/categorias`. Crear, editar y eliminar usan `POST /faqs`, `PATCH /faqs/:id` y `DELETE /faqs/:id`. Los borradores y las preguntas publicadas se guardan en la base de datos; el endpoint público `GET /faqs` continúa devolviendo solo las publicadas.

Salas y áreas siguen siendo datos locales de demostración. Las áreas incluyen los ejemplos de Financiamiento, Servicios Digitales, CASE y Dirección de Carrera; las ubicaciones de muestra no dependen de la API de salas. Estos cambios no se envían a la API ni aparecen en el tótem.

El seguimiento de solicitudes de enrolamiento también usa registros locales de demostración mientras no esté integrado el endpoint correspondiente. La sección es de solo lectura y no muestra fotografías.
