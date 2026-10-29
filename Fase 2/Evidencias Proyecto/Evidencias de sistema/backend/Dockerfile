# ===== Imagen del backend (API NestJS + Prisma) con la web del tótem =====
# Se construye en 2 etapas para que la imagen final sea liviana:
#   1) "build": instala todo y compila TypeScript -> JavaScript (carpeta dist)
#   2) "final": solo lo necesario para ejecutar (sin herramientas de desarrollo)
#
# El contexto es la carpeta "Evidencias de sistema", porque la imagen necesita backend/,
# el esquema de database/ y la web de frontend-web/. Desde esa carpeta:
#     docker build -f backend/Dockerfile -t orientasede-backend .
#     docker run --env-file backend/.env -p 3000:3000 orientasede-backend
# La base de datos está en Supabase (DATABASE_URL del .env): no se levanta PostgreSQL local.

# ---------- Etapa 1: compilar ----------
FROM node:22-slim AS build

# Prisma necesita OpenSSL para conectarse a PostgreSQL
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend

# Primero solo package*.json: si no cambian las dependencias, Docker reutiliza
# esta capa y no reinstala todo en cada build
COPY backend/package*.json ./
RUN npm ci

# Código fuente + esquema de base de datos (el script prisma:generate lo busca en ../database)
COPY database/prisma /app/database/prisma
COPY backend/ ./

# Genera el cliente de Prisma (para Linux) y compila el proyecto
RUN npm run prisma:generate && npm run build

# ---------- Etapa 2: ejecutar ----------
FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app/backend
ENV NODE_ENV=production

# Solo dependencias de producción
COPY backend/package*.json ./
RUN npm ci --omit=dev

# Esquema y datos de carga + cliente de Prisma generado + código compilado
COPY database/prisma /app/database/prisma
RUN npx prisma generate --schema=../database/prisma/schema.prisma
COPY --from=build /app/backend/dist ./dist

# Web del tótem (páginas, mapa y planos): la entrega el mismo backend en http://localhost:3000.
# Misma ruta relativa que fuera de Docker, así sirven los PUBLIC_DIR y PLANOS_DIR del .env.
COPY frontend-web/front-end /app/frontend-web/front-end
ENV PUBLIC_DIR=../frontend-web/front-end \
    PLANOS_DIR=../frontend-web/front-end/assets/planos

EXPOSE 3000

# La base de Supabase ya tiene el esquema y los datos, así que el contenedor solo inicia la API.
# (La carga inicial de Patricia, si se necesitara en una base vacía: npx prisma db seed)
CMD ["node", "dist/main.js"]
