#!/usr/bin/env bash
# Restore the CRM database from a pg_dump archive created by `backup.sh`.
#
# Usage:
#   ./scripts/restore.sh ./backups/crm-2026-05-15_03-00-00.sql.gz
#
# What it does:
#   1. Sanity-check the dump file
#   2. Stop API + web (so no writes during restore)
#   3. DROP + CREATE the database (clean state)
#   4. Pipe gzipped dump into psql
#   5. Re-apply prisma migrations (idempotent)
#   6. Restart API + web
#
# Refuses to run unless DUMP arg passed AND user confirms via env DRY_RUN=false.
set -euo pipefail

DUMP="${1:-}"
if [ -z "$DUMP" ]; then
  echo "Usage: $0 <dump-file.sql.gz>"
  exit 1
fi
if [ ! -f "$DUMP" ]; then
  echo "Dump file not found: $DUMP"
  exit 1
fi

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

echo "⚠ This will DROP and recreate the «${POSTGRES_DB}» database. ALL CURRENT DATA WILL BE LOST."
echo "Dump: $DUMP"
echo "Type the database name to confirm:"
read -r confirm
if [ "$confirm" != "$POSTGRES_DB" ]; then
  echo "Confirmation failed. Aborting."
  exit 1
fi

echo "→ Stopping api + web…"
docker compose -f docker-compose.prod.yml stop api web

echo "→ Dropping + recreating database…"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "DROP DATABASE IF EXISTS ${POSTGRES_DB};"
docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"

echo "→ Restoring dump…"
gunzip -c "$DUMP" | docker compose -f docker-compose.prod.yml exec -T postgres psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"

echo "→ Re-applying prisma migrations (idempotent)…"
docker compose -f docker-compose.prod.yml run --rm api sh -c "cd apps/api && npx prisma migrate deploy"

echo "→ Restarting api + web…"
docker compose -f docker-compose.prod.yml start api web

echo "✓ Restore complete."
