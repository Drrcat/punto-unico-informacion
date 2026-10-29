# Backend de OrientaSede

Backend en NestJS y TypeScript de la plataforma OrientaSede. Esta parte del código implementa las APIs de **Infraestructura y Salas** (pisos, salas y áreas), de **Trámites** y de **Enrolamiento**, junto con sus integraciones con el servicio de correo transaccional y Google Vision AI. Las APIs de Preguntas Frecuentes (`/api/faq*`) y de autenticación del administrador (`/api/auth/*`) corresponden a otros módulos del backend; aquí solo se define el contrato que esta parte espera de la segunda (ver [Contrato con la autenticación del administrador](#contrato-con-la-autenticación-del-administrador)).

La instalación es genérica: ningún nombre, logotipo ni dominio de una institución está escrito en el código. Todo lo propio de cada institución vive en la tabla `configuracion_sistema` y en los datos (planos, áreas, trámites).

## Contenido

1. [Requisitos](#requisitos)
2. [Puesta en marcha](#puesta-en-marcha)
3. [Variables de entorno](#variables-de-entorno)
4. [Carga inicial de datos](#carga-inicial-de-datos)
5. [Parámetros de la institución](#parámetros-de-la-institución)
6. [Rutas de la API](#rutas-de-la-api)
7. [Formato de las respuestas y de los errores](#formato-de-las-respuestas-y-de-los-errores)
8. [Flujo de enrolamiento](#flujo-de-enrolamiento)
9. [Contrato con la autenticación del administrador](#contrato-con-la-autenticación-del-administrador)
10. [Planos SVG](#planos-svg)
11. [Mapa del tótem conectado a la API](#mapa-del-tótem-conectado-a-la-api)
12. [Integraciones externas](#integraciones-externas)
13. [Seguridad](#seguridad)
14. [Pruebas](#pruebas)
15. [Estructura del código](#estructura-del-código)
16. [Supuestos y pendientes](#supuestos-y-pendientes)

## Requisitos

- Node.js 20 o superior.
- PostgreSQL 16.
- Para el conector de enrolamiento con navegador automatizado: Chromium de Playwright (`npx playwright install --with-deps chromium`). La imagen Docker ya lo incluye.

## Puesta en marcha

La base de datos está en **Supabase** (PostgreSQL en la nube): no se crea ni se levanta una base local. El esquema y los datos ya están cargados allí.

```bash
cd backend
npm ci

# 1. Variables: copiar el ejemplo y completar DATABASE_URL y DIRECT_URL con los datos de Supabase
#    (Project Settings → Database → Connection string), además de JWT_SECRET.
cp .env.example .env

# 2. Cliente de Prisma y compilación
npm run prisma:generate
npm run build

# 3. Inicio (lee el .env automáticamente)
npm start
```

En Windows (PowerShell) son los mismos pasos, con `copy .env.example .env` en lugar de `cp`.

- `DATABASE_URL` usa el *pooler* de Supabase en modo transacción (puerto **6543**, con `?pgbouncer=true`): es la conexión del backend.
- `DIRECT_URL` usa el puerto **5432** (modo sesión): Prisma la usa solo para comandos de esquema como `prisma migrate`.
- Con Docker: `docker compose up --build -d` desde `Evidencias de sistema/` (solo levanta el backend; ver `docker-compose.yml`).
- La carga inicial (`npm run seed`) es idempotente, pero no hace falta ejecutarla: Supabase ya tiene los datos.

El backend queda en `http://localhost:3000/api`. Fuera de producción también publica la documentación interactiva en `http://localhost:3000/api/docs` (en producción se activa con `DOCS=on`).

Scripts disponibles:

| Comando | Qué hace |
|---|---|
| `npm run build` | Compila a `dist/`. |
| `npm start` | Inicia `dist/main.js`. |
| `npm run start:dev` | Inicia con recarga automática. |
| `npm run seed` | Carga inicial de datos (idempotente). |
| `npm run openapi` | Regenera `openapi.json`, el contrato de la API, sin necesitar base de datos. |
| `npm run token:admin -- correo@ejemplo.cl` | Solo desarrollo: emite un token de administrador para probar las rutas protegidas antes de contar con el inicio de sesión. |
| `npm test` | Pruebas unitarias. |
| `npm run test:e2e` | Pruebas de integración (necesitan PostgreSQL). |
| `npm run test:all` | Ambas, en serie. |
| `npm run perf:salas` | Prueba de rendimiento de la búsqueda de salas. |

## Variables de entorno

El backend valida las variables al iniciar y se detiene con un mensaje claro si falta alguna obligatoria. El archivo `backend/.env.example` las lista con valores de ejemplo.

| Variable | Obligatoria | Descripción |
|---|---|---|
| `DATABASE_URL` | Sí | Cadena de conexión a PostgreSQL: el *pooler* de Supabase (puerto 6543, `?pgbouncer=true`). |
| `DIRECT_URL` | Para migraciones | Conexión directa a Supabase (puerto 5432); la usa Prisma en `migrate`, no el backend. |
| `JWT_SECRET` | Sí | Clave con la que se firman y verifican los tokens. En producción debe tener al menos 32 caracteres. |
| `PORT`, `HOST` | No | Puerto (3000) y dirección de escucha (`0.0.0.0`). |
| `TOTEM_ID` | No | Id del tótem donde corre la instalación, fila de la tabla `totem` (1). A su nombre se registran las verificaciones y las consultas. |
| `CORREO_DRIVER` | No | `resend` o `consola`. Por defecto es `resend` si hay `CORREO_API_KEY` y `consola` si no. |
| `CORREO_API_KEY`, `CORREO_REMITENTE` | Con `resend` | Credencial del servicio de correo transaccional y dirección desde la que se envían los códigos. |
| `VISION_DRIVER` | No | `google` o `simulado`. Por defecto es `google` si hay `GOOGLE_APPLICATION_CREDENTIALS` y `simulado` si no. |
| `GOOGLE_APPLICATION_CREDENTIALS` | Con `google` | Ruta del archivo de credenciales de Google Vision AI. |
| `ENROLAMIENTO_CONECTOR` | No | Conector de respaldo si `configuracion_sistema.conector_enrolamiento` no existe (`click_visitas`, `simulado` o `ninguno`). Si la tabla lo define, la tabla manda. |
| `ENROLAMIENTO_URL`, `ENROLAMIENTO_USUARIO`, `ENROLAMIENTO_CLAVE` | Con `click_visitas` | Dirección y credenciales del sistema de enrolamiento. Solo existen en el servidor. |
| `FOTOS_DIR` | No | Carpeta del almacenamiento temporal de fotografías (`./fotos`). Solo el backend accede a ella. |
| `PLANOS_DIR` | No | Carpeta de los planos SVG (`./public/assets/planos`, que en la imagen Docker corresponde a `frontend-web/front-end/assets/planos`). |
| `PUBLIC_DIR` | No | Carpeta de la aplicación web del tótem que el backend entrega en `/` (`./public`). Si no existe, no se sirve nada. |
| `CORS_ORIGENES` | No | Orígenes autorizados para llamar desde un navegador, separados por coma. Vacío significa ninguno: la aplicación web servida por el propio backend no lo necesita. |
| `LIMITE_SOLICITUDES_POR_MIN` | No | Límite general de solicitudes por minuto y por origen (300). |
| `LIMITES` | No | `off` desactiva los límites de solicitudes (para la prueba de rendimiento). |
| `TAREAS` | No | `off` desactiva las tareas programadas (limpieza de fotografías y solicitudes vencidas). |
| `DOCS` | No | `on` publica `/api/docs` también en producción. |
| `NODE_ENV` | No | `production` en la imagen Docker. |

Los proveedores `consola` y `simulado` existen para desarrollar y probar sin credenciales: el primero imprime el código de verificación en el log en lugar de enviar un correo, y el segundo acepta cualquier imagen válida sin consultar Google Vision AI. Al iniciar, el backend deja una advertencia en el log cuando alguno está activo, para que no pasen inadvertidos en una instalación real.

## Carga inicial de datos

`npm run seed` (en Docker, `npx prisma db seed`) prepara una base recién migrada y se puede volver a ejecutar sin duplicar nada ni pisar lo que el administrador ya editó. Crea:

1. La sede, el edificio, los pisos y los tipos de espacio, y los espacios de cada plano a partir de `database/prisma/seed/zonas.json`. Las piezas con la misma `clave` (por ejemplo, los dos módulos de un mismo baño) forman un solo espacio. El `id` de cada entrada es el del elemento del plano SVG y no se cambia sin regenerar los planos; de él sale también el código del espacio, sin el piso ni la torre (`P3-T1-S01` pasa a `S01`).
2. Los parámetros de `configuracion_sistema`, solo los que faltan.
3. Los permisos del sistema y el rol *Administrador* con todos ellos.
4. El tótem con el id indicado en `TOTEM_ID`.
5. Opcionalmente, el primer administrador y los contenidos de la institución.

| Variable | Descripción |
|---|---|
| `SEED_ADMIN_CORREO`, `SEED_ADMIN_CLAVE` | Si se definen ambas, crea el primer administrador con esa clave (almacenada con bcrypt, costo 12). |
| `SEED_INSTITUCION_NOMBRE` | Nombre de la institución (`Mi institución`). |
| `SEED_DOMINIOS_CORREO` | Dominios de correo aceptados para el enrolamiento, separados por coma. |
| `SEED_CONECTOR_ENROLAMIENTO` | `ninguno` (por defecto, módulo desactivado), `simulado` o `click_visitas`. Distinto de `ninguno` activa el módulo. |
| `SEED_SEDE_NOMBRE`, `SEED_EDIFICIO_NOMBRE`, `SEED_TOTEM_NOMBRE` | Nombres de la sede, el edificio y el tótem. |
| `SEED_CONTENIDO` | Ruta de un JSON con las áreas y trámites de la institución. El archivo `database/prisma/seed/contenido.ejemplo.json` muestra el formato; volver a cargarlo actualiza las áreas y reemplaza los pasos y requisitos de cada trámite. |
| `SEED_ZONAS` | Ruta de un `zonas.json` propio, para otra sede o edificio. |

Los trámites no tienen módulo de administración en la aplicación de escritorio, por lo que su contenido se mantiene en el JSON de `SEED_CONTENIDO`.

## Parámetros de la institución

Se guardan en la tabla `configuracion_sistema` (clave, valor, descripción) y el backend los lee con una caché de 15 segundos, de modo que un cambio se aplica sin reiniciar. Los de esta parte del backend son:

| Clave | Valor inicial | Uso |
|---|---|---|
| `modulo_enrolamiento_activo` | `false` | Activa o desactiva el enrolamiento. Si está inactivo, sus rutas responden `403 MODULO_INACTIVO`. |
| `conector_enrolamiento` | `ninguno` | `click_visitas`, `simulado` o `ninguno`. |
| `dominios_correo` | vacío | Dominios aceptados, separados por coma. Con la lista vacía ningún correo es aceptado. |
| `codigo_vigencia_min` | `5` | Minutos de validez del código. |
| `codigo_max_intentos` | `3` | Códigos incorrectos permitidos por verificación. |
| `codigo_max_solicitudes` | `3` | Códigos que se pueden pedir para un mismo correo dentro de la ventana. |
| `codigo_ventana_min` | `10` | Minutos de esa ventana. |
| `enrolamiento_vigencia_min` | `10` | Minutos que tiene la persona, tras verificar su correo, para enviar la fotografía. |
| `foto_max_intentos` | `5` | Fotografías rechazadas permitidas antes de empezar de nuevo. |
| `foto_retencion_horas` | `24` | Máximo de horas que se conserva una fotografía si falló su carga por un motivo técnico. |

Las claves de identidad visual (`institucion_nombre`, `institucion_logo_ruta`, `color_primario`, `color_secundario`), `tiempo_inactividad_seg` y las del inicio de sesión (`login_max_intentos`, `login_bloqueo_min`, `sesion_admin_horas`) las crea la misma carga inicial, pero las consumen la aplicación web y el módulo de autenticación.

## Rutas de la API

El contrato completo, con los esquemas de cada solicitud y respuesta, está en [`openapi.json`](openapi.json) (OpenAPI 3) y se puede explorar en `/api/docs`. Resumen:

| Método | Ruta | Acceso | Descripción |
|---|---|---|---|
| GET | `/api/pisos` | Público | Pisos con la dirección de su plano. |
| GET | `/api/pisos/:id` | Público | Piso con sus espacios activos y el id del elemento del SVG de cada uno. |
| GET | `/api/pisos/:id/plano` | Público | Plano SVG del piso. |
| GET | `/api/salas/tipos` | Público | Catálogo de tipos de espacio. |
| GET | `/api/salas` | Público | Búsqueda y listado. Parámetros: `q`, `pisoId`, `tipoEspacioId`, `limite` (20), `desplazamiento`; `todas=true` incluye los espacios inactivos y exige sesión de administrador. |
| GET | `/api/salas/:id` | Público | Detalle: equipamiento, áreas que funcionan allí, piso y plano. |
| POST | `/api/salas` | `sala.crear` | Crea una sala. |
| PUT | `/api/salas/:id` | `sala.editar` | Edita solo los campos enviados. |
| DELETE | `/api/salas/:id` | `sala.eliminar` | Elimina la sala; `409 SALA_EN_USO` si un área o un tótem la usa. |
| GET | `/api/areas` | Público | Áreas con su ubicación. Parámetro `q`. |
| GET | `/api/areas/:id` | Público | Detalle: ubicación, trámites y carreras que atiende. |
| POST | `/api/areas` | `area.crear` | Crea un área. |
| PUT | `/api/areas/:id` | `area.editar` | Edita un área. |
| DELETE | `/api/areas/:id` | `area.eliminar` | Elimina el área; `409 AREA_EN_USO` si resuelve trámites. |
| GET | `/api/tramites` | Público | Trámites activos con su área. Parámetros `q` y `areaId`. |
| GET | `/api/tramites/:id` | Público | Pasos, requisitos y área responsable con su ubicación. |
| GET | `/api/enrolamiento/estado` | Público | Si el módulo está activo y los parámetros que el tótem necesita mostrar. |
| POST | `/api/enrolamiento/autenticar` | Público | Envía un código de seis dígitos al correo. |
| POST | `/api/enrolamiento/autenticar/:id/codigo` | Público | Valida el código y entrega el token de la solicitud. |
| POST | `/api/enrolamiento/:id/foto` | Token de enrolamiento | Valida la fotografía y la envía al sistema de destino. |
| POST | `/api/enrolamiento/:id/cancelar` | Token de enrolamiento | Cancela la solicitud y borra la fotografía pendiente. |
| GET | `/api/enrolamiento/solicitudes` | `enrolamiento.ver` | Seguimiento de solicitudes. Parámetros `estado`, `correo`, `desde`, `hasta`, `limite`, `desplazamiento`. |

Cuatro rutas no figuran en la tabla del documento de diseño y se agregaron porque la interfaz las necesita: `GET /api/salas/tipos` (para el filtro y el formulario de salas), `GET /api/pisos/:id/plano` (entrega el SVG), `GET /api/enrolamiento/estado` (el tótem decide si ofrece el enrolamiento) y `POST /api/enrolamiento/:id/cancelar` (cierra la solicitud por inactividad).

Los permisos de las rutas de administración son los de la columna *Acceso*. Los listados de salas y de solicitudes responden `{ "total": n, "items": [...] }`; el resto de los listados, un arreglo.

La búsqueda de salas ignora mayúsculas y tildes, reconoce los alias del espacio (por ejemplo «Laboratorio de Autotrónica» para `PA-LATI`) y no distingue ceros a la izquierda ni guiones (`s5`, `S-05` y `S05` encuentran lo mismo). Se resuelve con un índice en memoria, que se invalida cuando un administrador cambia una sala, y responde en decenas de milisegundos.

## Formato de las respuestas y de los errores

Todos los errores tienen la misma forma, con un `codigo` estable que la interfaz puede interpretar sin depender del texto:

```json
{ "statusCode": 422, "codigo": "DOMINIO_NO_PERMITIDO", "mensaje": "Ese correo no pertenece a un dominio aceptado. Usa un correo @ejemplo.cl.", "dominiosAceptados": ["ejemplo.cl"] }
```

Los errores de validación de datos llegan como `400` con `codigo: "VALIDACION"` y la lista completa en `detalle`. Los errores inesperados se registran completos en el log del servidor y al cliente solo le llega un mensaje genérico (`500 ERROR_INTERNO`).

| Código | HTTP | Cuándo |
|---|---|---|
| `MODULO_INACTIVO` | 403 | El enrolamiento no está habilitado en esta sede. |
| `DOMINIO_NO_PERMITIDO` | 422 | El correo no pertenece a un dominio aceptado. |
| `DEMASIADAS_SOLICITUDES` | 429 | Se pidieron demasiados códigos para ese correo, o se superó el límite de solicitudes de la ruta. |
| `CORREO_NO_DISPONIBLE` | 503 | El servicio de correo no respondió. |
| `VERIFICACION_NO_ENCONTRADA` | 404 | La verificación no existe. |
| `CODIGO_INCORRECTO` | 401 | Código erróneo; incluye `intentosRestantes`. |
| `CODIGO_EXPIRADO` | 410 | El código venció. |
| `CODIGO_YA_USADO` | 409 | El código ya fue canjeado. |
| `INTENTOS_AGOTADOS` | 429 | Se agotaron los intentos con ese código. |
| `USUARIO_INACTIVO` | 403 | El usuario está deshabilitado. |
| `NO_AUTENTICADO`, `TOKEN_INVALIDO`, `TOKEN_EXPIRADO`, `SESION_INVALIDA` | 401 | Falta el token, es inválido, venció o la sesión fue cerrada. |
| `ENROLAMIENTO_AJENO` | 403 | El token pertenece a otra solicitud. |
| `ENROLAMIENTO_NO_ENCONTRADO` | 404 | La solicitud no existe. |
| `ENROLAMIENTO_FINALIZADO` | 409 | La solicitud ya terminó (completada, cancelada o fallida). |
| `EN_PROCESO` | 409 | Ya se está procesando una fotografía de esa solicitud. |
| `TRANSICION_INVALIDA` | 409 | El estado actual de la solicitud no admite esa operación. |
| `FOTO_REQUERIDA` | 400 | Falta el campo `foto`. |
| `IMAGEN_INVALIDA` | 422 | El archivo no es JPG ni PNG. |
| `FOTO_RECHAZADA` | 422 | La fotografía no cumple los criterios; incluye `motivo` e `intentosRestantes`. |
| `FOTO_NO_DISPONIBLE` | 410 | La fotografía conservada para reintentar ya no existe. |
| `VISION_NO_DISPONIBLE` | 503 | Google Vision AI no respondió; `puedeReintentar: true`. |
| `ENROLAMIENTO_RECHAZADO` | 422 | El sistema de destino no aceptó la solicitud. |
| `ENROLAMIENTO_NO_DISPONIBLE` | 502 | El sistema de destino no respondió; `puedeReintentar: true`. |
| `SIN_CONECTOR` | 503 | No hay un sistema de destino configurado. |
| `SIN_PERMISO` | 403 | El rol del administrador no incluye el permiso. |
| `PISO_NO_ENCONTRADO`, `SALA_NO_ENCONTRADA`, `AREA_NO_ENCONTRADA`, `TRAMITE_NO_ENCONTRADO`, `PLANO_NO_DISPONIBLE` | 404 | El recurso no existe. |
| `CODIGO_DUPLICADO`, `NOMBRE_DUPLICADO`, `SVG_DUPLICADO` | 409 | Ya existe una sala con ese código, un área con ese nombre, o un espacio del piso con ese elemento del plano. |
| `SALA_EN_USO`, `AREA_EN_USO` | 409 | No se puede eliminar porque otro registro depende de ella. |
| `PISO_INEXISTENTE`, `TIPO_INEXISTENTE`, `SALA_INEXISTENTE` | 422 | Un dato enviado hace referencia a algo que no existe. |

## Flujo de enrolamiento

```mermaid
sequenceDiagram
    participant T as Tótem
    participant B as Backend
    participant C as Servicio de correo
    participant V as Google Vision AI
    participant E as Sistema de enrolamiento
    T->>B: GET /enrolamiento/estado
    T->>B: POST /enrolamiento/autenticar { correo }
    B->>C: Código de 6 dígitos
    B-->>T: intentoId, vigencia
    T->>B: POST /enrolamiento/autenticar/:intentoId/codigo { codigo }
    B-->>T: enrolamientoId, token, vigencia
    T->>B: POST /enrolamiento/:id/foto (Bearer token, multipart "foto")
    B->>V: Detección de rostros
    B->>E: Carga de la fotografía (conector)
    B-->>T: estado COMPLETADO
```

- **Código.** Seis dígitos generados con un generador criptográfico. Se guarda solo un HMAC del código y el correo, nunca el código. Dura `codigo_vigencia_min` minutos, admite `codigo_max_intentos` errores y solo se puede canjear una vez. Pedir más de `codigo_max_solicitudes` códigos para el mismo correo dentro de `codigo_ventana_min` minutos responde `429`.
- **Persona.** Al verificar el código se busca al usuario por su correo y, si no existe, se crea. Un usuario deshabilitado no puede enrolarse.
- **Token de enrolamiento.** JWT firmado con una clave derivada de `JWT_SECRET` y con el alcance `enrolamiento`; no sirve como sesión de administrador ni al revés. Vale `enrolamiento_vigencia_min` minutos y solo autoriza la solicitud para la que se emitió.
- **Estados.** `INICIADO` → `FOTO_PENDIENTE` → `COMPLETADO`. Una solicitud puede pasar a `FALLIDO` (se agotaron los intentos de fotografía o el sistema de destino la rechazó) o a `CANCELADO`. Si falla un servicio externo, la solicitud sigue en `FOTO_PENDIENTE` y la persona puede reintentar sin volver a sacarse la fotografía. Los cambios de estado son atómicos, así que dos solicitudes simultáneas no pueden procesar la misma fotografía.
- **Fotografía.** Se valida en memoria (tipo y dimensiones leídos del propio archivo, máximo 5 MB) y con Google Vision AI (un solo rostro, de frente, nítido, bien iluminado, completo, centrado y a una distancia adecuada de la cámara, con una resolución mínima de 300 píxeles por lado; cada rechazo trae una indicación para que la persona corrija la foto). Si la fotografía es rechazada nunca se escribe en disco. Si es válida se guarda solo el tiempo que el conector la necesita y se elimina al terminar; si el envío falla por un motivo técnico se conserva hasta `foto_retencion_horas` horas para el reintento, y una tarea programada (al iniciar y cada diez minutos) borra lo vencido, marca como expiradas las verificaciones que nadie completó y cancela las solicitudes que la persona abandonó.
- **Seguimiento.** Cada verificación, captura y error de un servicio externo queda registrado en las tablas de auditoría y es visible en `GET /api/enrolamiento/solicitudes`, que además incluye las verificaciones que nunca pasaron del correo.

Límites por ruta, además del límite general: `autenticar` 10 por minuto, `codigo` 20 por minuto y `foto` 10 por minuto.

## Contrato con la autenticación del administrador

Las rutas de administración no emiten tokens; solo los validan. El módulo `/api/auth/login` y `/api/auth/logout` debe cumplir lo siguiente para que funcionen:

1. El token es un **JWT HS256** firmado con la variable `JWT_SECRET` (la misma que usa este backend), con `sub` igual al id del usuario (`usuario.id`, como texto o número) y `exp`.
2. Al iniciar sesión se inserta una fila en `sesion_admin` con `usuario_id`, `token_hash` y `expira_en`. El `token_hash` es el **SHA-256 en hexadecimal** del token completo, tal como se entrega al cliente.
3. Al cerrar sesión se marca `sesion_admin.revocada_en`.
4. Los permisos salen de los roles del usuario (`usuario_rol` → `rol_permiso` → `permiso.codigo`). La carga inicial crea los permisos `sala.crear`, `sala.editar`, `sala.eliminar`, `area.crear`, `area.editar`, `area.eliminar` y `enrolamiento.ver`, y el rol *Administrador* con todos ellos.
5. El cliente envía el token en `Authorization: Bearer <token>`.

Una sesión es válida si el token verifica, la fila existe con ese `token_hash` y ese `usuario_id`, no está revocada ni vencida, y el usuario está activo. Si no, la respuesta es `401` con `SESION_INVALIDA` (o `TOKEN_EXPIRADO` o `TOKEN_INVALIDO`). Un token con alcance `enrolamiento` nunca se acepta como sesión de administrador.

Para probar las rutas protegidas antes de tener el inicio de sesión, `npm run token:admin -- admin@ejemplo.cl` emite un token que cumple este contrato (solo en desarrollo).

## Planos SVG

Cada piso apunta a su plano mediante `piso.plano_svg_ruta` (`piso-2.svg`, `piso-3.svg`), que se resuelve dentro de `PLANOS_DIR` y nunca fuera de ella. Los planos del repositorio están en `frontend-web/assets/planos/` y los generó `herramientas/exportar_planos.py`, un script que parte del mapa del edificio. `herramientas/construir_mapa.py` hace lo mismo con el mapa del tótem (`frontend-web/mapa-totem.html`, con búsqueda, pisos y zoom; ver la sección siguiente): ambos toman los ids de `zonas.json`.

- Cada espacio es un `<g id="…" class="zona <tipo>">` cuyo `id` es el `espacio.svg_element_id` que devuelve la API. Cuando un espacio tiene varias piezas (por ejemplo, un baño con dos módulos) todas quedan dentro del mismo grupo, y el atributo `data-piezas` lista los ids de las piezas originales.
- Para resaltar un espacio basta agregarle una clase al elemento con ese `id`: `destacada` (resultado de una búsqueda) o `seleccionada` (destino elegido). El estilo está incluido en el propio SVG y está acotado a la clase `plano-piso`, para no chocar con los estilos de la página que lo incorpore.
- El SVG no contiene scripts ni referencias externas. El endpoint lo entrega con una política de seguridad de contenido estricta.
- Un test (`test/unit/planos.spec.ts`) verifica que todos los espacios de `zonas.json` existan en el plano de su piso; si se rehace un plano o se edita la carga inicial, ese test avisa si dejaron de coincidir.
- Otro (`test/unit/mapa-totem.spec.ts`) verifica que el dibujo que lleva el mapa del tótem sea el mismo que entrega la API.

Para incorporar los planos de otra institución, se exportan los SVG de sus pisos con el mismo criterio (un grupo por espacio con el `id` de la base), se dejan en `PLANOS_DIR` y se cargan sus espacios con `SEED_ZONAS`.

## Mapa del tótem conectado a la API

`frontend-web/front-end/mapa-totem.html` es la pantalla del tótem con buscador, accesos rápidos, selector de piso, torres y zoom. Es un solo archivo que el backend entrega en `/mapa-totem.html` (con `PUBLIC_DIR=../frontend-web`, ver [Puesta en marcha](#puesta-en-marcha)) y que, al abrirse, se conecta a estas rutas:

| Qué toma de la API | Ruta | Para qué |
|---|---|---|
| Pisos | `GET /api/pisos` | Saber qué pisos hay y dónde está su plano. |
| Espacios de cada piso | `GET /api/pisos/:id` | Nombre y código de cada zona (se une por `svgElementId`) y cuáles siguen activos. |
| Dibujo de cada piso | `GET /api/pisos/:id/plano` | El SVG que se muestra. |
| Búsqueda | `GET /api/salas?q=` | Resultados por nombre, código, alias, área o tipo. Además queda registrada como consulta. |

Cómo se comporta:

- **Los nombres salen de la base de datos.** Si un administrador renombra una sala (`PUT /api/salas/:id`), el mapa la muestra con el nombre nuevo sin recargar la página. Se actualiza cada 30 segundos, cada vez que el tótem vuelve a la pantalla de inicio por inactividad y al volver a la pestaña. En una demostración conviene acortarlo con `?actualizar=5`.
- **Una sala desactivada se atenúa** en el plano, pierde su etiqueta y deja de aparecer en las búsquedas. Una sala reactivada vuelve sola.
- **La búsqueda la hace la API**, de modo que reconoce los alias (por ejemplo, tras renombrar "Sala 03" a "Laboratorio de Redes" con el alias "Sala 03", ambos nombres la encuentran). Las palabras que la API no conoce ("wc", "elevador") se traducen al nombre del tipo antes de preguntar.
- **Si el backend no responde, el mapa sigue funcionando** con los datos que lleva en el propio archivo (lista `ZONAS` y dibujo) y lo reintenta cada 10 segundos. Un plano que llegue sin alguna de las zonas conocidas, o con contenido activo (scripts, enlaces), no se usa o se limpia.
- **La geometría no está en la base de datos.** La posición de las etiquetas, el giro de las salas inclinadas y la torre de cada zona salen siempre de la lista `ZONAS` del archivo. Si el dibujo de la API cambia levemente, las posiciones se recalculan desde el dibujo nuevo.

Parámetros de la dirección, útiles en demostraciones:

| Parámetro | Efecto |
|---|---|
| `?estado=1` | Muestra abajo a la izquierda si hay conexión con la API y a qué hora se actualizó por última vez. |
| `?actualizar=5` | Pide los datos cada 5 segundos (mínimo 2). |
| `?api=http://servidor:3000` | Usa otro backend. Si se sirve desde otro origen, ese backend debe tener el origen en `CORS_ORIGENES`. |
| `?api=off` | No usa la API: solo los datos del archivo. |
| `?edificio=1` | Si el backend tiene más de un edificio, cuál mostrar. |
| `?piso=3`, `?sala=PA-326`, `?marco=0`, `?sede=Nombre` | Piso inicial, sala preseleccionada, sin marco de tótem y nombre de la sede. |

Si se abre el archivo con doble clic (`file://`), el mapa intenta conectarse a `http://localhost:3000`; el navegador lo bloquea salvo que el backend tenga `CORS_ORIGENES=null`. Lo más simple es abrirlo desde el propio backend: `http://localhost:3000/mapa-totem.html`.

Para probar el cambio de nombre en una demostración:

```bash
# Token de administrador (solo desarrollo) y renombrar una sala
export TOKEN=$(npm run -s token:admin admin@ejemplo.cl)
node herramientas/renombrar-sala.js "Sala 03" "Laboratorio de Redes" "Sala 03"   # con alias
node herramientas/renombrar-sala.js "Sala 03" "Sala 03" --sin-alias              # lo devuelve
```

En PowerShell: `$env:TOKEN = npm run -s token:admin admin@ejemplo.cl` y luego `node herramientas/renombrar-sala.js ...`. `herramientas/renombrar-piso.js` hace lo mismo con todas las salas de un piso (genera nombres genéricos).

El archivo se genera con `herramientas/construir_mapa.py`, que parte del mapa del edificio, usa los ids de `zonas.json` e incorpora la conexión (`herramientas/conexion_api.js` más una lista de cambios al código original). Para modificar la conexión se edita `conexion_api.js` y se vuelve a generar el mapa; los ajustes a los textos o al diseño van en el mapa original. Lo que el mapa espera de la API (ids, tipos, alias, desactivación) lo verifica la suite en `test/e2e/mapa-totem.e2e-spec.ts`. El comportamiento en pantalla (nombres, búsqueda, cambio de nombre en vivo, respaldo sin API, plano con contenido activo) se prueba con un navegador real mediante `herramientas/probar_mapa.py`, con el backend en marcha y la carga inicial hecha:

```bash
pip install playwright && playwright install chromium
TOKEN=$(npm run -s token:admin admin@ejemplo.cl) BASE_URL=http://localhost:3000 python3 herramientas/probar_mapa.py
```

La prueba renombra y desactiva dos salas y las deja como estaban al terminar.

## Integraciones externas

- **Correo transaccional** (`src/integraciones/correo`). Interfaz `CorreoProvider` con dos implementaciones: `resend` (Resend, por HTTPS) y `consola` (desarrollo). El mensaje es de texto y HTML, sin imágenes remotas, y menciona el nombre de la institución configurado.
- **Google Vision AI** (`src/integraciones/vision`). Interfaz `ValidadorRostros` con `google` (detección de rostros) y `simulado`. Los criterios de aceptación están en `src/modulos/enrolamiento/rostro.ts` y se prueban sin llamar al servicio.
- **Conector de enrolamiento** (`src/integraciones/conector`). Interfaz `ConectorEnrolamiento` con `simulado` y `click_visitas`, que carga la fotografía en la plataforma con Playwright, de a una solicitud por vez y con las credenciales de `ENROLAMIENTO_*`. Se elige con `conector_enrolamiento`; agregar otro sistema de destino consiste en implementar la interfaz y registrarla en `ConectoresService`.

Los errores de estos servicios se registran con su código y duración, nunca con credenciales ni con el contenido de la fotografía, y ninguno de ellos afecta las rutas de consulta: si el servicio de correo cae, el mapa y el directorio siguen funcionando.

## Seguridad

- Las rutas de administración exigen sesión y el permiso específico; el servidor decide los permisos, nunca el cliente.
- Las rutas públicas no exponen datos personales. El listado de salas oculta los espacios inactivos a quien no sea administrador.
- Validación estricta de todo lo que llega (`whitelist` y `forbidNonWhitelisted`): un campo desconocido se rechaza en lugar de ignorarse.
- Consultas parametrizadas mediante Prisma. Las rutas de archivos se resuelven dentro de su carpeta base y se descartan las que intentan salir de ella.
- Cabeceras de seguridad con `helmet` en la API; la aplicación web del tótem define las suyas. CORS cerrado salvo los orígenes de `CORS_ORIGENES`.
- Límites de solicitudes por origen y, más estrictos, en las rutas del enrolamiento.
- Los códigos de verificación y los tokens no se guardan en claro (HMAC y SHA-256); las credenciales de los servicios externos viven solo en variables de entorno.
- Las fotografías no se escriben en disco hasta que Vision AI las acepta y se eliminan al completar la solicitud.

## Pruebas

Hay 102 pruebas unitarias (búsqueda, códigos, estados, reglas de la fotografía, plantilla del correo, registro de errores, sesiones, entorno y coherencia de los planos y del mapa del tótem) y 167 de integración que levantan la aplicación completa contra una base PostgreSQL de pruebas, con servicios externos simulados: lectura pública, administración, el flujo de enrolamiento con sus casos límite, la carga inicial, los límites de solicitudes y lo que el mapa del tótem espera de la API.

```bash
# Las pruebas de integración recrean la base indicada: debe tener "test" en el nombre.
export TEST_DATABASE_URL=postgresql://usuario:clave@localhost:5432/orientasede_test
npm run test:all
```

La prueba de rendimiento levanta carga contra un backend ya iniciado (con `LIMITES=off`) y falla si hay errores o si el percentil 99 de la búsqueda supera 2 segundos:

```bash
LIMITES=off npm start &
BASE_URL=http://localhost:3000 npm run perf:salas
```

## Estructura del código

```
backend/
├── src/
│   ├── main.ts, app.module.ts, app.setup.ts, openapi.ts
│   ├── config/            Variables de entorno validadas
│   ├── common/
│   │   ├── auth/          Sesión de administrador, permisos, token de enrolamiento
│   │   ├── configuracion/ Lectura de configuracion_sistema con caché
│   │   ├── filtros/       Formato único de errores
│   │   ├── prisma/        Acceso a la base de datos
│   │   ├── registro/      Auditoría, consultas y errores de servicios externos
│   │   └── util/          Buscador, caché del índice, fotografías, vistas
│   ├── integraciones/     correo/, vision/, conector/
│   ├── modulos/           pisos/, salas/, areas/, tramites/, enrolamiento/
│   ├── scripts/           emitir-token-admin.ts
│   └── seed/              seed.ts
├── test/                  unit/, e2e/, soporte/, perf/
├── herramientas/          exportar_planos.py, construir_mapa.py, conexion_api.js, probar_mapa.py,
│                          renombrar-sala.js, renombrar-piso.js
└── openapi.json           Contrato de la API (generado)
```

## Supuestos y pendientes

- **Conector de Click Visitas.** El conector está completo salvo los selectores de las pantallas de la plataforma, que hay que confirmar con una cuenta de prueba. Están marcados con `__CONFIRMAR__` en `src/integraciones/conector/click-visitas.conector.ts`; mientras queden marcadores el conector se niega a ejecutarse y lo informa, en lugar de fallar con un error confuso. `npx playwright codegen <url>` ayuda a obtenerlos.
- **Proveedor de correo.** Se usó Resend como servicio de correo transaccional. Cambiarlo implica implementar `CorreoProvider` y registrarlo en `integraciones.module.ts`.
- **Esquema Prisma.** `database/prisma/schema.prisma` declara `engineType = "client"` (Prisma con adaptador de PostgreSQL, sin el motor binario), porque el backend se conecta con `@prisma/adapter-pg`. La migración inicial `0001_init` es el script del modelo de 32 tablas.
- **Autenticación.** Las rutas de administración dependen del contrato descrito arriba; hasta que exista `/api/auth/login`, se prueban con `npm run token:admin`.
- **Exposición en la red.** El backend queda escuchando en todas las interfaces porque la aplicación de escritorio lo consume desde otro equipo de la red institucional. Conviene restringir el puerto con el cortafuegos del equipo del tótem a las direcciones de los administradores.
- **Dependencias.** `npm audit --omit=dev` informa cinco avisos, todos en herramientas que no procesan datos de los usuarios: la CLI de Prisma 6 (para leer su propia configuración al migrar) y la generación de la documentación Swagger. Corregirlos exige pasar a Prisma 7 y a `@nestjs/swagger` 12, que son cambios mayores; conviene evaluarlos como una tarea aparte.
- **Una instalación por institución.** El backend no distingue instituciones dentro de una misma base de datos.
