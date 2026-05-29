#!/usr/bin/env bash
# Резервная копия БД CRM. Запускать по cron, например ежедневно в 03:00.
# Использование: ./scripts/backup.sh [/путь/к/каталогу/бэкапов]
set -euo pipefail

BACKUP_DIR="${1:-./backups}"
TIMESTAMP="$(date +%Y-%m-%d_%H-%M-%S)"
FILENAME="crm-${TIMESTAMP}.sql.gz"
KEEP_DAYS="${BACKUP_KEEP_DAYS:-30}"

mkdir -p "$BACKUP_DIR"

if [ -f .env ]; then
  set -a
  # shellcheck disable=SC1091
  . .env
  set +a
fi

: "${POSTGRES_USER:?POSTGRES_USER is required}"
: "${POSTGRES_DB:?POSTGRES_DB is required}"

echo "Backup: ${BACKUP_DIR}/${FILENAME}"
docker compose exec -T postgres pg_dump -U "$POSTGRES_USER" "$POSTGRES_DB" | gzip > "${BACKUP_DIR}/${FILENAME}"

echo "Удаляем бэкапы старше ${KEEP_DAYS} дней..."
find "$BACKUP_DIR" -name "crm-*.sql.gz" -type f -mtime "+${KEEP_DAYS}" -delete

echo "Готово."
