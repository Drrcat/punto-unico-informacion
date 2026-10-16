# OrientaSede API (backend)

API REST del Tótem OrientaSede. Administra las **Preguntas Frecuentes (FAQ)** que muestra la pantalla `faq.html` del tótem.

- **NestJS** (framework de Node.js con TypeScript)
- **Prisma** (acceso a la base de datos)
- **PostgreSQL** (base de datos)
- **Jest + Supertest** (pruebas)

## Endpoints

| Método | Ruta | Qué hace | Respuestas |
|---|---|---|---|
| GET | `/` | Chequeo de que la API está funcionando | 200 |
| GET | `/faqs` | Lista todas las FAQ (ordenadas por id) | 200 |
| GET | `/faqs/:id` | Devuelve una FAQ | 200 · 404 si no existe · 400 si el id no es número |
| POST | `/faqs` | Crea una FAQ | 201 · 400 si faltan datos |
| PATCH | `/faqs/:id` | Edita una FAQ (uno o ambos campos) | 200 · 404 · 400 |
| DELETE | `/faqs/:id` | Borra una FAQ y devuelve la borrada | 200 · 404 |

**Body para POST / PATCH:**

```json
{
  "pregunta": "¿Cuál es el horario de la biblioteca?",
  "respuesta": "De lunes a viernes de 08:00 a 21:00."
}
```

Reglas de validación (`src/faqs/dto/create-faq.dto.ts`):
- `pregunta`: texto obligatorio, máximo 200 caracteres.
- `respuesta`: texto obligatorio, máximo 2000 caracteres.
- Si se envían campos extra, la API responde 400.

**Ejemplo con curl:**

```bash
curl http://localhost:3000/faqs
curl -X POST http://localhost:3000/faqs \
  -H "Content-Type: application/json" \
  -d '{"pregunta":"¿Hay estacionamiento?","respuesta":"Sí, en el subterráneo del Edificio A."}'
```

## Cómo correrlo (sin Docker)

Requisitos: Node.js 22 o superior y PostgreSQL corriendo.

```bash
# 1. Instalar dependencias
npm install

# 2. Crear el archivo .env a partir de la plantilla y poner tu conexión
cp .env.example .env

# 3. Crear la tabla Faq en la base de datos y generar el cliente de Prisma
npx prisma migrate deploy
npx prisma generate

# 4. Cargar las FAQ de ejemplo (solo si la tabla está vacía)
npm run db:seed
#    Para borrar todo y volver a los datos de ejemplo:
#    SEED_REINICIAR=1 npm run db:seed

# 5. Levantar la API en modo desarrollo (se reinicia al guardar cambios)
npm run start:dev
```

La API queda en http://localhost:3000.

Para correrla con Docker, ver el [README principal](../README.md).

## Pruebas

```bash
npm test            # pruebas unitarias (servicio y controlador)
npm run test:e2e    # pruebas end-to-end de todas las rutas HTTP
npm run test:cov    # pruebas unitarias + reporte de cobertura
```

Ninguna prueba necesita PostgreSQL: la base de datos se reemplaza por una versión falsa.

- `src/faqs/faqs.service.spec.ts`: lógica del servicio (incluye los casos 404).
- `src/faqs/faqs.controller.spec.ts`: que cada ruta llame al método correcto.
- `test/app.e2e-spec.ts`: peticiones HTTP reales a la API completa, con validaciones, 400 y 404.

## Estructura

```
backend/
├── prisma/
│   ├── schema.prisma        # modelo Faq (tabla de la base)
│   ├── migrations/          # historial de cambios de la base
│   └── seed.js              # FAQ de ejemplo (ficticias)
├── src/
│   ├── main.ts              # punto de entrada
│   ├── configurar-app.ts    # CORS + validación (compartido con las pruebas e2e)
│   ├── app.module.ts        # módulo raíz
│   ├── prisma/              # conexión a la base (un solo cliente para toda la app)
│   └── faqs/                # módulo FAQ: controlador (rutas), servicio (lógica), DTO (validación)
├── test/app.e2e-spec.ts     # pruebas end-to-end
└── Dockerfile
```
