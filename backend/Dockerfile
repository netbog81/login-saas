# syntax=docker/dockerfile:1.6
#
# Backend NestJS — Curandis Clinico
#
# Multi-stage:
#  1. builder (node:20-alpine) — npm ci + nest build
#  2. runtime (node:20-alpine) — solo dist + node_modules prod, utente
#     non-root nel gruppo `openbao-agent` per leggere il sink token montato
#     bind-only dal volume host /run/openbao-agent-clinico.
#
# Build context atteso: root del repo (curandis-clinico/).
# Tutti i COPY sono prefissati con `backend/`.
#
# Build args:
#   OPENBAO_AGENT_GID — GID del gruppo openbao-agent dell'host (default 986).
#   Override via `docker compose build --build-arg OPENBAO_AGENT_GID=$(getent group openbao-agent | cut -d: -f3)`.

# ──────────────────────────────────────────────────────────────
# Stage 1 — build
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# local-libs prima del npm ci (le dep file: risolvono i tarball locali).
COPY backend/local-libs ./local-libs
COPY backend/package*.json ./
# Cache mount BuildKit: la cache npm persiste tra i build (vedi frontend).
RUN --mount=type=cache,target=/root/.npm npm ci --no-audit --no-fund

COPY backend/tsconfig*.json ./
COPY backend/nest-cli.json ./
COPY backend/src ./src
RUN npm run build && npm prune --omit=dev

# ──────────────────────────────────────────────────────────────
# Stage 2 — runtime
# ──────────────────────────────────────────────────────────────
FROM node:20-alpine

# tini come PID 1 → forwarda SIGTERM a node, evita zombie process.
RUN apk add --no-cache tini

WORKDIR /app

ENV NODE_ENV=production \
    PORT=3000

# Crea utente clinico e lo aggiunge al gruppo openbao-agent (stesso GID
# dell'host, default 986). Necessario per leggere il sink token che è
# 0640 root:openbao-agent.
ARG OPENBAO_AGENT_GID=986
RUN addgroup -S -g ${OPENBAO_AGENT_GID} openbao-agent \
 && addgroup -S clinico \
 && adduser -S -G clinico -D clinico \
 && addgroup clinico openbao-agent

COPY --from=builder --chown=clinico:clinico /app/node_modules ./node_modules
COPY --from=builder --chown=clinico:clinico /app/dist ./dist
COPY --from=builder --chown=clinico:clinico /app/package.json ./package.json

USER clinico
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health/live || exit 1

ENTRYPOINT ["/sbin/tini", "--"]
CMD ["node", "dist/main.js"]
