#!/usr/bin/env bash
set -euo pipefail

# ────────────────────────────────────────────────────────────────────
#  start.sh — Production startup script for Real Estate CRM
#  Usage: ./start.sh [--seed] [--reset]
# ────────────────────────────────────────────────────────────────────

SEED=0
RESET=0
for arg in "$@"; do
  case $arg in
    --seed)  SEED=1  ;;
    --reset) RESET=1 ;;
  esac
done

log() { echo "$(date '+%H:%M:%S') [CRM] $*"; }

# ── Check required env vars ──
required=(DATABASE_URL JWT_ACCESS_SECRET JWT_REFRESH_SECRET)
for var in "${required[@]}"; do
  if [ -z "${!var:-}" ]; then
    echo "ERROR: $var is not set" >&2
    exit 1
  fi
done

log "Starting Real Estate CRM..."

# ── Wait for Postgres ──
log "Waiting for database..."
until pg_isready -d "$DATABASE_URL" -q 2>/dev/null; do
  sleep 1
done
log "Database ready."

# ── Migrations ──
cd apps/api
if [ "$RESET" = "1" ]; then
  log "RESET: dropping and recreating schema..."
  npx prisma migrate reset --force --skip-seed
fi

log "Running migrations..."
npx prisma migrate deploy
log "Migrations complete."

# ── Seed ──
if [ "$SEED" = "1" ]; then
  log "Seeding database..."
  npx tsx prisma/seed.ts
  log "Seed complete."
fi

cd ../..

log "✅ CRM ready. API → :3001, Web → :3000"
