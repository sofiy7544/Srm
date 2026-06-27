#!/usr/bin/env bash
# ──────────────────────────────────────────────
# stanley-fitness-audience-crm — one-click launcher (Linux / macOS)
# Usage:  ./start.sh
# ──────────────────────────────────────────────
set -e
cd "$(dirname "$0")"

echo "🥤 stanley-fitness-audience-crm — starting…"

# 1) Ensure .env exists
if [ ! -f .env ]; then
  cp .env.example .env
  echo "📝 Created .env from .env.example — fill in your Meta/Telegram tokens later."
fi

# 2) Prefer Docker (full stack: api + postgres + redis + worker + beat + bot)
if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  echo "🐳 Starting full stack with Docker Compose…"
  docker compose up -d --build
  echo "⏳ Waiting for the API to come up…"
  for i in $(seq 1 30); do
    if curl -sf http://localhost:8000/health >/dev/null 2>&1; then break; fi
    sleep 2
  done
  docker compose exec -T api python -m scripts.seed || true
  echo ""
  echo "✅ Up! Admin panel:  http://localhost:8000   (login: admin / admin12345)"
  echo "   API docs:        http://localhost:8000/docs"
  echo "   Landing example: http://localhost:8000/landing/stanley"
  echo "   Stop with:       docker compose down"
  exit 0
fi

# 3) Fallback: local Python + SQLite (no Docker)
echo "🐍 Docker not found — running locally with SQLite…"
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip >/dev/null
pip install -r requirements.txt
export DATABASE_URL="sqlite+pysqlite:///./dev.sqlite3"
python -m scripts.seed
echo ""
echo "✅ Starting API on http://localhost:8000  (login: admin / admin12345)"
echo "   (Background workers/bot need Redis — use Docker for the full stack.)"
exec uvicorn app.main:app --host 0.0.0.0 --port 8000
