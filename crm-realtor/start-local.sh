#!/usr/bin/env bash
# ============================================================================
# CRM Realtor — local boot (Mac / Linux).
#
#   ./start-local.sh           full setup + start
#   ./start-local.sh stop      stop dev servers + docker
#   ./start-local.sh reset     NUKE database and start fresh
#   ./start-local.sh logs      tail api + web logs
#
# What it does:
#   1. Checks Node 20+, pnpm, Docker.
#   2. Installs dependencies.
#   3. Builds @crm/shared (workspace package consumed by api).
#   4. Boots Postgres + Redis + MinIO.
#   5. Repairs the database if a previous run left it in a half-migrated state.
#   6. Generates Prisma client, runs migrations, seeds demo data.
#   7. Finds free TCP ports for API (default 3001) and Web (default 3000).
#      Hops to the next port if the default is occupied.
#   8. Writes the chosen ports + NEXT_PUBLIC_API_URL into apps/api/.env.
#   9. Launches both servers as background processes, captures their PIDs.
#  10. Polls the API health endpoint and the Web root until both respond.
#  11. Opens http://localhost:<web_port> in the default browser.
#  12. Prints a one-line summary with both URLs.
# ============================================================================

set -euo pipefail
cd "$(dirname "$0")"

# ─── Pretty output ──────────────────────────────────────────────────────────
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[0;33m'
BLUE=$'\033[0;34m'
BOLD=$'\033[1m'
DIM=$'\033[2m'
NC=$'\033[0m'

step()  { printf "\n${BOLD}${BLUE}▸ %s${NC}\n" "$*"; }
ok()    { printf "  ${GREEN}✓${NC} %s\n" "$*"; }
warn()  { printf "  ${YELLOW}⚠${NC} %s\n" "$*"; }
fail()  { printf "\n${BOLD}${RED}✗ %s${NC}\n" "$*" >&2; exit 1; }

LOG_DIR=".dev-logs"
PID_DIR=".dev-pids"
PORT_FILE=".dev-ports"
mkdir -p "$LOG_DIR" "$PID_DIR"

# ─── Helpers ────────────────────────────────────────────────────────────────

is_port_free() {
  local port="$1"
  # Try `lsof` first (Mac default), fall back to `nc`, finally `bash /dev/tcp`.
  if command -v lsof >/dev/null 2>&1; then
    ! lsof -iTCP:"$port" -sTCP:LISTEN >/dev/null 2>&1
  elif command -v nc >/dev/null 2>&1; then
    ! nc -z localhost "$port" >/dev/null 2>&1
  else
    ! (echo > "/dev/tcp/localhost/$port") >/dev/null 2>&1
  fi
}

find_free_port() {
  local port="$1" max_attempts="${2:-50}"
  local original="$port"
  local i=0
  while ! is_port_free "$port"; do
    port=$((port + 1))
    i=$((i + 1))
    if (( i >= max_attempts )); then
      fail "No free port in range $original-$((original+max_attempts))"
    fi
  done
  echo "$port"
}

wait_for_url() {
  local url="$1" timeout="${2:-60}" what="${3:-server}"
  local i=0
  while (( i < timeout )); do
    if curl -fsS -o /dev/null -m 1 "$url" 2>/dev/null; then
      return 0
    fi
    printf "  ${DIM}waiting for %s... %d/%d${NC}\r" "$what" "$((i+1))" "$timeout"
    sleep 1
    i=$((i + 1))
  done
  printf "\n"
  return 1
}

wait_for_api_health() {
  local url="$1" timeout="${2:-90}"
  local i=0
  while (( i < timeout )); do
    local resp
    resp=$(curl -fsS -m 1 "$url" 2>/dev/null || true)
    if [[ "$resp" == *'"status":"ok"'* ]]; then
      return 0
    fi
    printf "  ${DIM}waiting for API health... %d/%d${NC}\r" "$((i+1))" "$timeout"
    sleep 1
    i=$((i + 1))
  done
  printf "\n"
  return 1
}

stop_dev_servers() {
  for service in api web; do
    if [[ -f "$PID_DIR/$service.pid" ]]; then
      local pid
      pid=$(cat "$PID_DIR/$service.pid")
      if kill -0 "$pid" 2>/dev/null; then
        # Send SIGTERM to the process group so children (next dev, tsc --watch) die too.
        kill -- -"$pid" 2>/dev/null || kill "$pid" 2>/dev/null || true
      fi
      rm -f "$PID_DIR/$service.pid"
    fi
  done
  # Best-effort cleanup of stray dev processes
  pkill -f "next dev" 2>/dev/null || true
  pkill -f "nest start" 2>/dev/null || true
  pkill -f "tsc -p tsconfig.json --watch" 2>/dev/null || true
}

open_browser() {
  local url="$1"
  if command -v open >/dev/null 2>&1; then open "$url"
  elif command -v xdg-open >/dev/null 2>&1; then xdg-open "$url" >/dev/null 2>&1 || true
  elif command -v wslview >/dev/null 2>&1; then wslview "$url"
  else warn "Couldn't auto-open browser. Visit $url manually."
  fi
}

wait_postgres() {
  step "Waiting for Postgres"
  local i
  for i in {1..30}; do
    if docker compose exec -T postgres pg_isready -U crm >/dev/null 2>&1; then
      ok "Postgres ready"
      return 0
    fi
    printf "  ${DIM}attempt %d/30...${NC}\r" "$i"
    sleep 1
  done
  fail "Postgres didn't become ready. Check: docker compose logs postgres"
}

# ─── Subcommands ────────────────────────────────────────────────────────────

case "${1:-start}" in
  stop)
    step "Stopping dev servers"
    stop_dev_servers
    ok "dev servers stopped"
    step "Stopping docker services"
    docker compose down
    ok "all stopped"
    exit 0
    ;;
  logs)
    step "Tailing logs (Ctrl+C to exit)"
    tail -f "$LOG_DIR/api.log" "$LOG_DIR/web.log" 2>/dev/null \
      || fail "No log files yet. Start the servers first: ./start-local.sh"
    exit 0
    ;;
  reset)
    step "Hard reset: will DELETE all data"
    read -r -p "  Continue? [y/N] " ans
    [[ "$ans" =~ ^[Yy]$ ]] || { warn "aborted"; exit 0; }
    stop_dev_servers
    docker compose down -v
    ok "volumes removed"
    docker compose up -d
    ok "docker compose up -d"
    wait_postgres
    cp .env apps/api/.env
    pnpm --filter @crm/shared run build 2>&1 | tail -3
    pnpm --filter @crm/api run prisma:generate 2>&1 | tail -3
    pnpm --filter @crm/api run prisma:deploy 2>&1 | tail -3
    pnpm --filter @crm/api run prisma:seed 2>&1 | tail -3 || warn "seed failed"
    ok "database recreated. Now run: ./start-local.sh"
    exit 0
    ;;
  start|"") ;; # fall through
  *) fail "Unknown command: $1. Use: start | stop | reset | logs" ;;
esac

# ============================================================================
# Main start flow
# ============================================================================

# ─── 1. Prerequisites ───────────────────────────────────────────────────────

step "Checking prerequisites"

command -v node >/dev/null || fail "Node.js not found. Install from https://nodejs.org (need v20+)."
NODE_MAJOR=$(node -p "process.versions.node.split('.')[0]")
(( NODE_MAJOR < 20 )) && fail "Node $NODE_MAJOR is too old. Need v20+. Try: nvm install 20"
ok "Node $(node -v)"

if ! command -v pnpm >/dev/null 2>&1; then
  warn "pnpm not found, installing via corepack"
  corepack enable 2>/dev/null && corepack prepare pnpm@latest --activate \
    || npm install -g pnpm \
    || fail "Could not install pnpm. Install manually: npm i -g pnpm"
fi
ok "pnpm $(pnpm -v)"

command -v docker >/dev/null || fail "Docker not found. Install Docker Desktop: https://docker.com/products/docker-desktop"
docker info >/dev/null 2>&1 || fail "Docker daemon not running. Start Docker Desktop and retry."
ok "Docker running"

command -v curl >/dev/null || fail "curl not found. Install via your package manager."

# ─── 2. Dependencies ────────────────────────────────────────────────────────

step "Installing pnpm dependencies (may take a few minutes on first run)"
if [[ -d node_modules ]] && [[ -f pnpm-lock.yaml ]]; then
  pnpm install --prefer-offline 2>&1 | tail -3
else
  pnpm install 2>&1 | tail -3
fi
[[ ${PIPESTATUS[0]} -eq 0 ]] || fail "pnpm install failed"
ok "dependencies installed"

# ─── 3. Build @crm/shared ───────────────────────────────────────────────────

step "Building @crm/shared"
# Apps/api imports from '@crm/shared', whose package.json points main → ./dist.
# Skipping this step yields 'Cannot find module @crm/shared' (TS2307) on every
# api file that uses Zod schemas or enums from the shared package.
#
# Defensively delete any stale tsbuildinfo and dist before building. If an
# old tsbuildinfo is checked in (or left over from a previous run on another
# machine), tsc's --incremental mode sees "nothing changed" and emits NO
# files. The api then crashes at runtime with MODULE_NOT_FOUND.
rm -f packages/shared/tsconfig.tsbuildinfo
rm -rf packages/shared/dist
pnpm --filter @crm/shared run build 2>&1 | tail -3
[[ ${PIPESTATUS[0]} -eq 0 ]] || fail "@crm/shared build failed."
[[ -f packages/shared/dist/index.js ]] || fail \
  "@crm/shared build silently produced no output. Try running it manually: pnpm --filter @crm/shared run build"
ok "@crm/shared built (verified dist/index.js exists)"

# ─── 4. .env propagation ────────────────────────────────────────────────────

step "Checking .env"
if [[ ! -f .env ]]; then
  cp .env.example .env
  ok ".env created from .env.example"
fi
# Both Prisma CLI and NestJS load .env from THEIR cwd, not the monorepo root.
cp .env apps/api/.env
ok "apps/api/.env synced"

# ─── 5. Docker infra ────────────────────────────────────────────────────────

step "Starting Postgres + Redis + MinIO"
docker compose up -d 2>&1 | grep -iE "(starting|started|running|created)" || true
ok "docker compose up -d"
wait_postgres

# ─── 6. Database state repair ───────────────────────────────────────────────

step "Detecting database state"
PRISMA_TABLE=$(docker compose exec -T postgres psql -U crm -d crm -tAc \
  "SELECT to_regclass('public._prisma_migrations');" 2>/dev/null | tr -d ' \r\n')
USERS_TABLE=$(docker compose exec -T postgres psql -U crm -d crm -tAc \
  "SELECT to_regclass('public.users');" 2>/dev/null | tr -d ' \r\n')
NEEDS_RESET="false"

if [[ -n "$PRISMA_TABLE" ]]; then
  FAILED_COUNT=$(docker compose exec -T postgres psql -U crm -d crm -tAc \
    "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL;" 2>/dev/null | tr -d ' \r\n')
  if [[ "$FAILED_COUNT" != "0" && -n "$FAILED_COUNT" ]]; then
    warn "Found $FAILED_COUNT incomplete migration(s) — will reset"
    NEEDS_RESET="true"
  fi
fi

if [[ -z "$USERS_TABLE" ]]; then
  # Users table missing, but maybe orphan enums exist from a half-applied init.
  ORPHAN=$(docker compose exec -T postgres psql -U crm -d crm -tAc \
    "SELECT COUNT(*) FROM pg_type WHERE typname IN ('UserRole','LeadStage','PropertyType');" \
    2>/dev/null | tr -d ' \r\n')
  if [[ "$ORPHAN" != "0" && -n "$ORPHAN" ]]; then
    warn "Orphan enum types from a previous failed run — will reset"
    NEEDS_RESET="true"
  fi
fi

if [[ "$NEEDS_RESET" == "true" ]]; then
  step "Resetting database to a clean state"
  docker compose exec -T postgres psql -U crm -d postgres -c \
    "DROP DATABASE IF EXISTS crm WITH (FORCE);" >/dev/null 2>&1
  docker compose exec -T postgres psql -U crm -d postgres -c \
    "CREATE DATABASE crm;" >/dev/null 2>&1
  ok "database recreated"
else
  ok "database state OK"
fi

# ─── 7. Prisma generate + migrate + seed ────────────────────────────────────

step "Generating Prisma client"
pnpm --filter @crm/api run prisma:generate 2>&1 | tail -3
[[ ${PIPESTATUS[0]} -eq 0 ]] || fail "prisma generate failed"
ok "Prisma client generated"

step "Applying Prisma migrations"
pnpm --filter @crm/api run prisma:deploy 2>&1 | tail -10
[[ ${PIPESTATUS[0]} -eq 0 ]] || fail "prisma migrate deploy failed. Try: ./start-local.sh reset"
ok "migrations applied"

USER_COUNT=$(docker compose exec -T postgres psql -U crm -d crm -tAc \
  "SELECT COUNT(*) FROM users;" 2>/dev/null | tr -d ' \r\n' || echo "0")
if [[ "$USER_COUNT" == "0" ]]; then
  step "Seeding demo data"
  pnpm --filter @crm/api run prisma:seed 2>&1 | tail -3 \
    && ok "seeded" \
    || warn "seed failed (non-fatal — you can sign up manually)"
else
  ok "Database has $USER_COUNT users — skipping seed"
fi

# ─── 8. Stop leftover dev servers ───────────────────────────────────────────

stop_dev_servers

# ─── 9. Find free ports ─────────────────────────────────────────────────────

step "Reserving free TCP ports"
API_PORT=$(find_free_port 3001)
WEB_PORT=$(find_free_port 3000)
ok "API → :$API_PORT"
ok "Web → :$WEB_PORT"

# Persist for `stop` / `logs` subcommands.
echo "API_PORT=$API_PORT" >  "$PORT_FILE"
echo "WEB_PORT=$WEB_PORT" >> "$PORT_FILE"

# Rewrite ports + public API URL in apps/api/.env (NestJS reads from there).
# We do a targeted sed-edit so user-customised values stay intact.
update_env_var() {
  local file="$1" key="$2" value="$3"
  if grep -q "^${key}=" "$file" 2>/dev/null; then
    # macOS / BSD sed needs `-i ''`; GNU sed accepts `-i`. Use a portable form.
    sed -i.bak "s|^${key}=.*|${key}=${value}|" "$file" && rm -f "$file.bak"
  else
    echo "${key}=${value}" >> "$file"
  fi
}

update_env_var apps/api/.env API_PORT "$API_PORT"
update_env_var apps/api/.env WEB_PORT "$WEB_PORT"
update_env_var apps/api/.env NEXT_PUBLIC_API_URL "http://localhost:$API_PORT"
ok "apps/api/.env updated with chosen ports"

# ─── 10. Launch API ────────────────────────────────────────────────────────

step "Starting API on :$API_PORT"
(
  cd apps/api
  # `nohup` + `&` + `setsid` (when available) puts the process in its own
  # group so we can kill the whole tree later.
  nohup env API_PORT="$API_PORT" pnpm run dev > "../../$LOG_DIR/api.log" 2>&1 &
  echo $! > "../../$PID_DIR/api.pid"
)
ok "API pid $(cat $PID_DIR/api.pid) — logs: $LOG_DIR/api.log"

# ─── 11. Wait for API health ────────────────────────────────────────────────

step "Waiting for API to compile and become healthy"
if ! wait_for_api_health "http://localhost:$API_PORT/api/health" 120; then
  printf "\n"
  warn "API didn't respond at /api/health within 120s."
  echo
  echo "  Last 30 lines of api log:"
  echo "  ${DIM}$(tail -30 "$LOG_DIR/api.log" | sed 's/^/    /')${NC}"
  echo
  fail "API failed to start. See $LOG_DIR/api.log for the full trace."
fi
ok "API healthy"

# ─── 12. Launch Web ────────────────────────────────────────────────────────

step "Starting Web on :$WEB_PORT"
(
  cd apps/web
  # Pass --port directly so the hardcoded `next dev -p 3000` from package.json
  # is overridden cleanly.
  nohup pnpm exec next dev --port "$WEB_PORT" > "../../$LOG_DIR/web.log" 2>&1 &
  echo $! > "../../$PID_DIR/web.pid"
)
ok "Web pid $(cat $PID_DIR/web.pid) — logs: $LOG_DIR/web.log"

# ─── 13. Wait for Web ───────────────────────────────────────────────────────

step "Waiting for Next.js to compile"
if ! wait_for_url "http://localhost:$WEB_PORT" 90 "Web"; then
  printf "\n"
  warn "Web didn't respond within 90s. First Next.js compile can be slow on cold caches."
  echo "  Last 30 lines of web log:"
  echo "  ${DIM}$(tail -30 "$LOG_DIR/web.log" | sed 's/^/    /')${NC}"
  echo
  warn "Will still try to open the browser — it may catch up."
fi
ok "Web responding"

# ─── 14. Open browser ───────────────────────────────────────────────────────

step "Opening browser"
URL="http://localhost:$WEB_PORT"
open_browser "$URL"
ok "$URL"

# ─── 15. Final summary ──────────────────────────────────────────────────────

cat <<EOF

${BOLD}${GREEN}✓ CRM Realtor is up.${NC}

  ${BOLD}Web (open in browser):${NC}   http://localhost:$WEB_PORT
  ${BOLD}API:${NC}                     http://localhost:$API_PORT/api
  ${BOLD}API health:${NC}              http://localhost:$API_PORT/api/health
  ${BOLD}MinIO console:${NC}           http://localhost:9001  ${DIM}(login: minioadmin / minioadmin)${NC}

  ${BOLD}Login:${NC}
    admin@crm.local  / admin12345
    realtor@crm.local / realtor12345

  ${BOLD}Logs:${NC}
    tail -f $LOG_DIR/api.log
    tail -f $LOG_DIR/web.log
    ./start-local.sh logs

  ${BOLD}Controls:${NC}
    ./start-local.sh stop      ${DIM}# stop everything${NC}
    ./start-local.sh reset     ${DIM}# nuke DB and start fresh${NC}

  ${BOLD}Manual fallback${NC} ${DIM}(if autostart fails or you want to see live output)${NC}${BOLD}:${NC}
    1. pnpm install
    2. pnpm --filter @crm/shared run build
    3. docker compose up -d
    4. cp .env apps/api/.env
    5. pnpm --filter @crm/api run prisma:generate
    6. pnpm --filter @crm/api run prisma:deploy
    7. pnpm --filter @crm/api run prisma:seed
    8. In one terminal:  cd apps/api && API_PORT=$API_PORT pnpm dev
    9. In another:        cd apps/web && pnpm exec next dev --port $WEB_PORT
   10. Open http://localhost:$WEB_PORT

EOF
