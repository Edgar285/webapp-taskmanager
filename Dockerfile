# syntax=docker/dockerfile:1
# =============================================================================
# Dockerfile - API de tareas (Node.js + Express + SQLite)
# Build multi-etapa: la imagen final solo lleva dependencias de produccion
# y el codigo fuente, y se ejecuta con un usuario sin privilegios.
# =============================================================================

# ---------- Etapa 1: dependencias de produccion ----------
FROM node:22-slim AS deps
WORKDIR /app

# Se copian primero los manifiestos para aprovechar la cache de capas:
# si el codigo cambia pero package*.json no, esta capa no se reconstruye.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

# ---------- Etapa 2: imagen final ----------
FROM node:22-slim AS runtime

# Hash del commit con el que se construyo la imagen (lo pasa GitHub Actions).
ARG GIT_SHA=local

ENV NODE_ENV=production \
    PORT=3000 \
    SOCKET_PORT=6061 \
    GIT_SHA=${GIT_SHA}

LABEL org.opencontainers.image.title="webapp-taskmanager" \
      org.opencontainers.image.description="API REST de gestion de tareas" \
      org.opencontainers.image.revision="${GIT_SHA}"

WORKDIR /app

COPY --from=deps --chown=node:node /app/node_modules ./node_modules
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src

# Carpetas de datos (SQLite) y respaldos, propiedad del usuario 'node'
RUN mkdir -p /app/data /app/backups && chown -R node:node /app/data /app/backups

# No se ejecuta como root. Por eso la app escucha en el 3000 (puerto no privilegiado)
# y Docker lo publica en el 80 del servidor: docker run -p 80:3000 ...
USER node

EXPOSE 3000 6061

# Docker revisa periodicamente /api/health; si falla, marca el contenedor como 'unhealthy'
HEALTHCHECK --interval=15s --timeout=3s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch('http://127.0.0.1:' + process.env.PORT + '/api/health').then(r => process.exit(r.ok ? 0 : 1)).catch(() => process.exit(1))"]

CMD ["node", "src/server.js"]
