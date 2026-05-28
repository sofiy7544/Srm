# ──── Stage 1: deps ────
FROM node:22-alpine AS deps
WORKDIR /app
RUN npm install -g corepack && corepack enable pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/web/package.json ./apps/web/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ──── Stage 2: builder ────
FROM node:22-alpine AS builder
WORKDIR /app
RUN npm install -g corepack && corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
# Build-time arg: pass API URL so NEXT_PUBLIC_* gets baked in correctly
ARG NEXT_PUBLIC_API_URL=http://localhost:3001
ARG NEXT_PUBLIC_DEFAULT_LOCALE=ru
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_DEFAULT_LOCALE=$NEXT_PUBLIC_DEFAULT_LOCALE
RUN pnpm --filter @crm/shared build 2>/dev/null || true
RUN pnpm --filter @crm/web build

# ──── Stage 3: runner ────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 crm && \
    adduser --system --uid 1001 crm

COPY --from=builder /app/apps/web/public           ./public
COPY --from=builder /app/apps/web/.next/standalone  ./
COPY --from=builder /app/apps/web/.next/static      ./.next/static

USER crm
# PORT is overridden at runtime by Render/Railway (they inject their own PORT)
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# server.js reads PORT env var automatically (Next.js standalone)
CMD ["node", "server.js"]
