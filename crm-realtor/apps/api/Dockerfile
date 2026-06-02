# ──── Stage 1: deps ────
FROM node:22-alpine AS deps
WORKDIR /app
# Prisma postinstall needs OpenSSL to detect the correct engine binary variant
RUN apk add --no-cache openssl
RUN npm install -g corepack && corepack enable pnpm
COPY package.json pnpm-workspace.yaml pnpm-lock.yaml ./
COPY apps/api/package.json ./apps/api/
COPY packages/shared/package.json ./packages/shared/
RUN pnpm install --frozen-lockfile

# ──── Stage 2: build ────
FROM node:22-alpine AS builder
WORKDIR /app
# Prisma на Alpine требует OpenSSL для генерации/работы движка
RUN apk add --no-cache openssl
RUN npm install -g corepack && corepack enable pnpm
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY . .
RUN pnpm --filter @crm/shared build 2>/dev/null || true
# Генерируем Prisma Client до tsc — иначе типы (@prisma/client: enum'ы, классы
# ошибок Prisma) отсутствуют и сборка падает с TS-ошибками.
RUN pnpm --filter @crm/api run prisma:generate
RUN pnpm --filter @crm/api build

# ──── Stage 3: production image ────
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
# npx/npm пишут кеш в HOME; у non-root юзера его нет — направляем в /tmp
ENV npm_config_cache=/tmp/.npm
# Prisma на Alpine требует OpenSSL в рантайме (иначе query engine не стартует)
RUN apk add --no-cache openssl

RUN addgroup --system --gid 1001 crm && \
    adduser --system --uid 1001 crm

RUN npm install -g corepack && corepack enable pnpm

COPY --from=builder /app/apps/api/package.json ./apps/api/
COPY --from=builder /app/apps/api/dist          ./apps/api/dist
COPY --from=builder /app/apps/api/prisma        ./apps/api/prisma
# node_modules берём из builder (а НЕ deps): там лежит сгенерированный Prisma
# Client (prisma generate отрабатывает в builder). Иначе runner стартует со
# stub-клиентом, new PrismaClient() падает молча и healthcheck не проходит.
COPY --from=builder /app/apps/api/node_modules  ./apps/api/node_modules
COPY --from=builder /app/node_modules           ./node_modules
COPY --from=builder /app/packages               ./packages
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

# Отдаём весь /app non-root юзеру: prisma migrate deploy пишет во временные
# файлы node_modules, иначе падает с EACCES под пользователем crm.
RUN chown -R crm:crm /app

# Каталог для загрузок (LocalStorageProvider). Создаём mount-point /data с
# владельцем crm ДО монтирования volume — иначе Railway-volume монтируется
# root-owned и запись под юзером crm падает с EACCES.
RUN mkdir -p /data/uploads && chown -R crm:crm /data

USER crm
WORKDIR /app/apps/api
EXPOSE 3001

# Run migrations then start. mkdir -p UPLOAD_DIR на старте — на случай, если
# volume смонтирован пустым (каталог uploads внутри него ещё не создан).
CMD ["sh", "-c", "mkdir -p \"${UPLOAD_DIR:-/data/uploads}\" 2>/dev/null; npx prisma migrate deploy && node dist/main.js"]
