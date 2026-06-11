# syntax=docker/dockerfile:1.6
#
# Frontend Angular — Curandis Clinico
#
# Multi-stage:
#  1. builder (node:22-alpine) — ng build production
#  2. runtime (nginx:1.27-alpine) — serve i bundle statici.
#
# Build context atteso: root del repo (curandis-clinico/).
# Tutti i COPY sono prefissati con `frontend/`.

# ──────────────────────────────────────────────────────────────
# Stage 1 — build
# ──────────────────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

COPY frontend/package.json frontend/package-lock.json* ./
RUN npm ci

COPY frontend/. .
RUN npm run build -- --configuration=production

# ──────────────────────────────────────────────────────────────
# Stage 2 — serve con nginx
# ──────────────────────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

RUN rm /etc/nginx/conf.d/default.conf
COPY frontend/nginx.conf /etc/nginx/conf.d/default.conf

# Angular del clinic emette in dist/calendar-frontend/ (browser builder
# legacy, non application builder Angular 17+ che userebbe /browser).
COPY --from=builder /app/dist/calendar-frontend /usr/share/nginx/html

EXPOSE 80

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:80/ > /dev/null || exit 1

CMD ["nginx", "-g", "daemon off;"]
