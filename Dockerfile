# syntax=docker/dockerfile:1
# Production image for app.ypnus.com on AWS (ECS Fargate or any container host).
# Uses Next.js `output: "standalone"`. State lives in LOANPILOT_DATA_DIR, which
# MUST be a persistent volume (EFS/EBS) because the store is a JSON snapshot.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:22-alpine AS build
WORKDIR /app
ARG APP_COMMIT=unknown
ENV APP_COMMIT=$APP_COMMIT NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN mkdir -p public && npm run build

FROM node:22-alpine AS runtime
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 \
    PORT=3000 HOSTNAME=0.0.0.0 LOANPILOT_DATA_DIR=/data
RUN addgroup -S -g 1001 app && adduser -S -u 1001 -G app app && mkdir -p /data && chown app:app /data
COPY --from=build --chown=app:app /app/.next/standalone ./
COPY --from=build --chown=app:app /app/.next/static ./.next/static
COPY --from=build --chown=app:app /app/public ./public
USER app
VOLUME ["/data"]
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "server.js"]
