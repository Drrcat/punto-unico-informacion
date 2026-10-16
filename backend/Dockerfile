# ===== Imagen del backend (API NestJS + Prisma) =====
# Se construye en 2 etapas para que la imagen final sea liviana:
#   1) "build": instala todo y compila TypeScript -> JavaScript (carpeta dist)
#   2) "final": solo lo necesario para ejecutar (sin herramientas de desarrollo)

# ---------- Etapa 1: compilar ----------
FROM node:22-slim AS build

# Prisma necesita OpenSSL para conectarse a PostgreSQL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Primero solo package*.json: si no cambian las dependencias, Docker reutiliza
# esta capa y no reinstala todo en cada build
COPY package*.json ./
RUN npm ci

# Código fuente + esquema de base de datos
COPY . .

# Genera el cliente de Prisma (para Linux) y compila el proyecto
RUN npx prisma generate && npm run build

# ---------- Etapa 2: ejecutar ----------
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app
ENV NODE_ENV=production

# Solo dependencias de producción
COPY package*.json ./
RUN npm ci --omit=dev

# Esquema, migraciones y seed + cliente de Prisma generado + código compilado
COPY prisma ./prisma
RUN npx prisma generate
COPY --from=build /app/dist ./dist

EXPOSE 3000

# Al arrancar el contenedor:
#   1) aplica las migraciones pendientes (crea/actualiza la tabla Faq)
#   2) carga las FAQ de ejemplo si la tabla está vacía
#   3) inicia la API
CMD ["sh", "-c", "npx prisma migrate deploy && node prisma/seed.js && node dist/main.js"]
