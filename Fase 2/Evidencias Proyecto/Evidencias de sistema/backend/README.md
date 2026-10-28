# OrientaSede API (backend)

API REST de NestJS que administra las preguntas frecuentes almacenadas en PostgreSQL mediante Prisma.

## Endpoints

| Método | Ruta | Qué hace |
|---|---|---|
| GET | `/` | Comprueba que la API está funcionando |
| GET | `/faqs` | Lista solo las preguntas publicadas para el tótem |
| GET | `/faqs/admin` | Lista todas las preguntas, incluidos los borradores |
| GET | `/faqs/categorias` | Devuelve las categorías disponibles para el formulario |
| GET | `/faqs/:id` | Devuelve una pregunta publicada por id |
| POST | `/faqs` | Crea una pregunta frecuente |
| PATCH / PUT | `/faqs/:id` | Actualiza los campos enviados |
| DELETE | `/faqs/:id` | Elimina una pregunta frecuente |

El cuerpo de `POST /faqs` requiere pregunta, respuesta y una categoría existente:

```json
{
  "pregunta": "¿Cuál es el horario de la biblioteca?",
  "respuesta": "De lunes a viernes de 08:00 a 21:00.",
  "categoria_id": 1,
  "publicada": false
}
```

`area_id` y `publicada` son opcionales. En `PATCH` o `PUT`, todos los campos editables son opcionales. La API valida tipos, campos requeridos, longitud y campos adicionales.

La tabla `pregunta_frecuente` exige el id de un usuario autor. Mientras el escritorio use el inicio de sesión de demostración, el backend lo toma de `FAQ_CREATED_BY_ID`. Configura esta variable con el id de un registro existente en `usuario`; si falta, el endpoint de creación responderá con un error explícito. La base también debe tener al menos una fila en `categoria_faq`.

Los endpoints CRUD todavía no autentican al solicitante. Utiliza esta integración solo en desarrollo o en una red controlada hasta conectar la autenticación institucional.

## Ejecutar localmente

Requisitos: Node.js 20 o superior, PostgreSQL y `DATABASE_URL` configurada para Prisma.

```powershell
npm install
npx prisma generate
$env:FAQ_CREATED_BY_ID = "1" # Cambiar por un id de usuario que exista en la base
npm run start:dev
```

La API queda en `http://localhost:3000`, la dirección que usa la aplicación de escritorio. Si se ejecuta con Docker Compose, agrega `FAQ_CREATED_BY_ID` al archivo `.env` raíz para entregarlo al contenedor.

Para la configuración con Docker, consulta el [README principal](../README.md).

## Pruebas

```powershell
npm test
npm run test:e2e
```

Las pruebas reemplazan Prisma por una implementación en memoria; no requieren PostgreSQL.
