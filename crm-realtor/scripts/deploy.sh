#!/usr/bin/env bash
# Zero-downtime-ish production deploy.
#
# Usage on the production server (assumes you've already SSH'd in):
#   ./scripts/deploy.sh
#
# What it does:
#   1. Pre-flight: check .env exists, docker is running
#   2. Pull latest code (git)
#   3. Take an emergency backup of the DB before any changes
#   4. Build new docker images
#   5. Run prisma migrations (additive; no destructive operations)
#   6. Rolling restart: api → web → nginx
#   7. Health-check the running stack
#   8. Print summary
#
# Safe to run on every deploy. Idempotent.
set -euo pipefail

cd "$(dirname "$0")/.."   # repo root regardless of cwd

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() { printf "${GREEN}▶ %s${NC}\n" "$1"; }
warn() { printf "${YELLOW}⚠ %s${NC}\n" "$1"; }
err() { printf "${RED}✗ %s${NC}\n" "$1" >&2; }

# 1. Pre-flight
if [ ! -f .env ]; then
  err ".env not found. Copy .env.production.example to .env and fill the values."
  exit 1
fi
if ! docker info >/dev/null 2>&1; then
  err "Docker is not running."
  exit 1
fi

# 2. Pull latest code
log "Pulling latest code from git…"
git fetch --all
git reset --hard origin/main

# 3. Pre-deploy backup
log "Taking a pre-deploy DB backup…"
./scripts/backup.sh ./backups/pre-deploy || warn "Backup failed — continuing anyway"

# 4. Build images
log "Building Docker images (this may take a few minutes)…"
docker compose -f docker-compose.prod.yml build --pull

# 5. Migrate DB
log "Running prisma migrations…"
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd apps/api && npx prisma migrate deploy"

# 6. Rolling restart
log "Restarting api…"
docker compose -f docker-compose.prod.yml up -d --no-deps api
sleep 5
log "Restarting web…"
docker compose -f docker-compose.prod.yml up -d --no-deps web
sleep 3
log "Reloading nginx…"
docker compose -f docker-compose.prod.yml exec nginx nginx -s reload || \
  docker compose -f docker-compose.prod.yml up -d --no-deps nginx

# Make sure postgres, redis, minio are up (idempotent)
docker compose -f docker-compose.prod.yml up -d postgres redis minio

# 7. Health-check
log "Health-check (waiting up to 60s)…"
for i in $(seq 1 30); do
  if docker compose -f docker-compose.prod.yml exec -T api wget -qO- http://localhost:3001/api/health 2>/dev/null | grep -q '"status":"ok"'; then
    log "API healthy ✓"
    break
  fi
  if [ "$i" -eq 30 ]; then
    err "API didn't become healthy within 60s. Check logs:"
    err "  docker compose -f docker-compose.prod.yml logs api --tail=80"
    exit 1
  fi
  sleep 2
done

# 8. Summary
log "Deployment complete."
echo
echo "Containers:"
docker compose -f docker-compose.prod.yml ps --format "table {{.Name}}\t{{.Status}}"
echo
echo "Next: tail logs with"
echo "  docker compose -f docker-compose.prod.yml logs -f api web nginx"
