# OrientaSede (Punto Único de Información) - imagen del backend
#
# El contexto de construcción es la raíz del repositorio, porque la imagen necesita
# el código de backend/, el esquema de database/prisma/ y la aplicación web de
# frontend-web/. Se construye con:
#     docker compose -f docker/docker-compose.yml build

# ---------------------------------------------------------------- etapa 1: compilación
FROM node:20-bookworm-slim AS build
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

COPY backend/package*.json ./
COPY database/prisma ./prisma
RUN npm ci

COPY backend/ ./
RUN npx prisma generate --schema=./prisma/schema.prisma \
    && npm run build

# ---------------------------------------------------------------- etapa 2: ejecución
FROM node:20-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /app

RUN apt-get update \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# El paquete "prisma" y "playwright" deben estar declarados en "dependencies" de
# backend/package.json: el primero aplica las migraciones al iniciar y el segundo
# automatiza el conector de enrolamiento.
COPY backend/package*.json ./
RUN npm ci --omit=dev \
    && npx playwright install --with-deps chromium \
    && rm -rf /var/lib/apt/lists/*

COPY --from=build /app/dist ./dist
COPY --from=build /app/prisma ./prisma
COPY --from=build /app/node_modules/.prisma ./node_modules/.prisma

# Aplicación web del tótem, que el backend entrega en la misma dirección.
# Si la aplicación web requiere compilación, se agrega una etapa de construcción.
COPY frontend-web/ ./public/

# Almacenamiento temporal de las fotografías; solo el backend accede a esta carpeta.
RUN mkdir -p /var/lib/orientasede/fotos \
    && chown -R node:node /var/lib/orientasede /app
USER node

EXPOSE 3000

# Aplica las migraciones pendientes y luego inicia el backend. La carga inicial de datos
# se ejecuta una sola vez con "npx prisma db seed", que usa el script indicado en la
# clave "prisma.seed" de backend/package.json (debe apuntar al archivo ya compilado).
CMD ["sh", "-c", "npx prisma migrate deploy --schema=./prisma/schema.prisma && node dist/main.js"]
