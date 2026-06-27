#!/usr/bin/env bash
set -e

# Apply DB migrations (idempotent), then start the API server.
echo "Running database migrations…"
alembic upgrade head || echo "⚠️  Alembic migration step skipped/failed (check DATABASE_URL)."

echo "Starting API on :${PORT:-8000}…"
exec uvicorn app.main:app --host 0.0.0.0 --port "${PORT:-8000}"
