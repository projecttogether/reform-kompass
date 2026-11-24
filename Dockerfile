# syntax=docker/dockerfile:1

FROM node:22-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

FROM base AS dependencies
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM base AS builder
COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

# The image builds without environment variables. AI keys and account settings are runtime-only.
RUN mkdir -p public && npm run build

FROM base AS runner
LABEL org.opencontainers.image.source="https://github.com/projecttogether/reform-kompass" \
      org.opencontainers.image.licenses="Apache-2.0"
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000

COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static
COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/src/app/fonts/OFL-*.txt ./public/fonts/
# The operator's content, read at request time. Replace it in an image of your own
# or mount a folder here (docs/content.md).
COPY --from=builder --chown=node:node /app/inhalte ./inhalte
# SQL migrations, applied at server start when member accounts are configured.
COPY --from=builder --chown=node:node /app/drizzle ./drizzle
COPY --from=builder --chown=node:node /app/LICENSE /app/NOTICE ./

USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:' + process.env.PORT + '/-/healthz', { signal: AbortSignal.timeout(4000) }).then(r => process.exit(r.status === 200 ? 0 : 1)).catch(() => process.exit(1))"
CMD ["node", "server.js"]
