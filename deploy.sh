#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# CRM Realtor — deploy script.
#
# Что делает (по порядку):
#   1. Синхронизирует локальные исходники на сервер (rsync --delete с правильными
#      exclude'ами: .env, node_modules, .next, dist, .git, .turbo).
#   2. На сервере: pnpm install → собрать shared → применить миграции БД →
#      сгенерировать Prisma client → собрать API → собрать Web → перезапустить PM2.
#   3. Показать pm2 status и проверить, что 3000 порт отвечает.
#
# Использование:
#   ./deploy.sh              — полный деплой (код + миграции + рестарт)
#   ./deploy.sh --quick      — быстрый: только sync + pm2 restart (без install/build),
#                              когда поменял только конфиг или статику
#   ./deploy.sh --code-only  — только rsync, без перезапуска (для отладки)
#
# Безопасность:
#   - .env на сервере НЕ перезаписывается (--exclude .env).
#   - БД и MinIO живут в docker volumes — этот скрипт их не трогает.
#   - На любой ошибке прерываемся (set -e) — pm2 НЕ рестартим если build упал.
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

# Цвета для читаемости
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
RESET='\033[0m'

# Конфиг — единственное место где захардкожен сервер
SERVER="root@193.203.50.245"
REMOTE_DIR="/root/mycrm"
LOCAL_DIR="$(cd "$(dirname "$0")" && pwd)"

MODE="${1:-full}"

step() { echo -e "\n${GREEN}▶${RESET} $*"; }
warn() { echo -e "${YELLOW}⚠${RESET}  $*"; }
fail() { echo -e "${RED}✗${RESET} $*"; exit 1; }

# ────────────────────────────────────────────────────────────────
# 1) rsync исходников
# ────────────────────────────────────────────────────────────────
step "rsync исходников на ${SERVER}:${REMOTE_DIR}"

rsync -avz --delete \
  --exclude .env \
  --exclude node_modules \
  --exclude .next \
  --exclude dist \
  --exclude .git \
  --exclude .turbo \
  --exclude .DS_Store \
  --exclude '*.tsbuildinfo' \
  --exclude '/deploy.sh' \
  "${LOCAL_DIR}/" "${SERVER}:${REMOTE_DIR}/" \
  || fail "rsync упал"

if [[ "$MODE" == "--code-only" ]]; then
  step "Готово (только sync, без рестарта)"
  exit 0
fi

# ────────────────────────────────────────────────────────────────
# 2) Удалённая пересборка
# ────────────────────────────────────────────────────────────────
if [[ "$MODE" == "--quick" ]]; then
  step "Quick mode: только pm2 restart"
  ssh "$SERVER" "cd $REMOTE_DIR && pm2 restart all && pm2 status" || fail "pm2 restart упал"
else
  step "Установка зависимостей + миграции + сборка + рестарт"
  ssh "$SERVER" "set -e; cd $REMOTE_DIR && \
    ln -sf $REMOTE_DIR/.env apps/api/.env && \
    pnpm install --frozen-lockfile && \
    pnpm --filter @crm/shared build && \
    pnpm --filter @crm/api exec prisma migrate deploy && \
    pnpm --filter @crm/api exec prisma generate && \
    pnpm --filter @crm/api build && \
    pnpm --filter @crm/web build && \
    pm2 restart all && \
    pm2 status" \
    || fail "Удалённая сборка/рестарт упали"
fi

# ────────────────────────────────────────────────────────────────
# 3) Smoke-тест
# ────────────────────────────────────────────────────────────────
step "Smoke-тест — проверяем что :3000 отвечает"

HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time 10 "http://193.203.50.245:3000" || echo "fail")

if [[ "$HTTP_CODE" =~ ^(200|302|307|308)$ ]]; then
  echo -e "${GREEN}✓${RESET} :3000 отвечает ($HTTP_CODE)"
else
  warn ":3000 вернул '$HTTP_CODE' — проверь логи: ssh $SERVER 'pm2 logs --lines 50'"
fi

step "Готово 🚀  http://193.203.50.245:3000"
