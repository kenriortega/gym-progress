# Imagen de producción para autoalojamiento (VPS con Dokploy).
# Usa la salida "standalone" de Next: solo lo necesario para arrancar.

FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# La misma clave en las dos instancias: Next cifra los argumentos de las
# server actions y, sin compartirla, una instancia no puede descifrar lo que
# cifró la otra ("Failed to find Server Action").
ARG NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV NEXT_SERVER_ACTIONS_ENCRYPTION_KEY=$NEXT_SERVER_ACTIONS_ENCRYPTION_KEY
ENV DOCKER_BUILD=1
ENV NEXT_TELEMETRY_DISABLED=1

# La compilación no toca la base de datos, pero drizzle.config la exige.
ENV DATABASE_URL=postgresql://build:build@localhost:5432/build
RUN npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs \
 && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]

# Etapa aparte para las migraciones. drizzle-kit necesita sus dependencias
# completas (esbuild, entre otras) para leer drizzle.config.ts, y meterlas en
# la imagen de la app anularía la ventaja de la salida standalone.
FROM node:22-alpine AS migrator
WORKDIR /app
ENV NODE_ENV=production
COPY --from=deps /app/node_modules ./node_modules
COPY package.json drizzle.config.ts ./
COPY drizzle ./drizzle
COPY src/db ./src/db
CMD ["npx", "drizzle-kit", "migrate"]
