# syntax=docker/dockerfile:1

# ---- deps: install dependencies only (cached separately from source) ----
FROM node:22-bookworm-slim AS deps
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
RUN npm ci

# ---- builder: generate Prisma client + build the Next.js app ----
FROM node:22-bookworm-slim AS builder
WORKDIR /app
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# A placeholder DATABASE_URL is enough here — this only runs `prisma generate`
# (build-time codegen), not a real DB connection. The real one is supplied
# at container start via docker-compose / the platform's env settings.
RUN DATABASE_URL="file:./build-placeholder.db" npx prisma generate
RUN npm run build

# ---- runner: minimal production image ----
FROM node:22-bookworm-slim AS runner
WORKDIR /app
# tzdata is required for the TZ env var below to actually shift local-time
# calculations (retard/heures sup) — Debian slim doesn't ship it by default.
RUN apt-get update -y && apt-get install -y openssl curl tzdata && rm -rf /var/lib/apt/lists/*

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
# Change this per deployment if the business operates in a different zone —
# it controls how "retard"/"heures sup" are computed against local time.
ENV TZ=Africa/Dakar

RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 nextjs

# Next.js standalone output (small, self-contained server)
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

# Prisma needs its schema/migrations at runtime (for `migrate deploy`) plus
# the generated client + query engine, which standalone tracing misses.
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh \
  && mkdir -p /app/data /app/backups \
  && chown -R nextjs:nodejs /app/data /app/backups

USER nextjs

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD curl -f http://localhost:3000/api/health || exit 1

ENTRYPOINT ["./docker-entrypoint.sh"]
