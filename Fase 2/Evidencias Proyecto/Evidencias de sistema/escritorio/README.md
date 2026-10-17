# Punto Único de Información — Aplicación de escritorio

Prototipo inicial de la aplicación administrativa del proyecto APT (Electron + HTML + CSS + JavaScript).

## Qué incluye

- Inicio de sesión de demostración.
- Navegación entre Resumen, Salas, Coordinadores y Preguntas frecuentes.
- CRUD local (crear, consultar, editar y eliminar) para salas, coordinadores y preguntas frecuentes.
- Búsqueda en los listados y validaciones básicas de formularios.
- Persistencia de datos de demostración en `localStorage` del equipo.
- Configuración básica de Electron con `contextIsolation`, `nodeIntegration: false`, `sandbox` y un `preload.js` mínimo.

## Requisitos

- Node.js instalado (se recomienda una versión LTS compatible con la versión de Electron del proyecto).
- npm.

## Ejecutar en Windows

1. Extrae la carpeta del proyecto.
2. Abre una terminal dentro de `punto-unico-escritorio`.
3. Ejecuta:

   ```powershell
   npm install
   npm start
   ```

La primera instalación requiere conexión a internet para descargar Electron.

## Credenciales de demostración

- Correo: `admin@demo.local`
- Contraseña: `demo1234`

No uses estas credenciales en producción. Esta pantalla es una simulación de acceso: todavía no está conectada a Microsoft Entra ID ni a un sistema de autenticación real.

## Importante: estado del backend

Los módulos guardan los registros localmente y **no se conectan todavía a las API del proyecto**. Antes de integrar el backend, se deben confirmar las rutas reales, los métodos HTTP, los esquemas de solicitud/respuesta, la estrategia de autenticación y las reglas de autorización. Los datos precargados son ejemplos ficticios y no corresponden a un directorio oficial de la Institución Educativa.

## Próximos pasos recomendados

1. Confirmar el repositorio y las API disponibles para salas, coordinadores y preguntas frecuentes.
2. Reemplazar la persistencia local por llamadas a las API compartidas.
3. Integrar la autenticación acordada para personal autorizado.
4. Agregar pruebas de integración y de los flujos completos.
5. Ajustar la interfaz y los campos al modelo de datos definitivo del equipo.
