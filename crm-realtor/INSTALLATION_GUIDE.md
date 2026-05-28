# Installation Guide

How to run Real Estate CRM **locally** for evaluation or development. For production server install see [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md).

## What you'll have after this

- CRM running at http://localhost:3000
- API at http://localhost:3001/api
- Login: `admin@crm.local` / `admin12345` (admin) or `realtor@crm.local` / `realtor12345`
- Demo data: 55 contacts, 23 properties, 49 leads, 700+ activities — looks like a real agency

## Requirements

| Tool | Version | Why |
|---|---|---|
| **Node.js** | 20+ | Runtime for API + web |
| **pnpm** | 9+ | Package manager (auto-installs via corepack) |
| **Docker Desktop** | latest | Postgres + Redis + MinIO containers |
| **Disk** | 3 GB free | Node modules + Docker images + data volumes |
| **RAM** | 4 GB free | Postgres + dev servers |

### Windows-specific

- Install Docker Desktop and enable WSL2 backend
- Use PowerShell or CMD; the bundled `start-local.bat` handles everything

### macOS / Linux

- `brew install node@20` (or use nvm)
- Docker Desktop or rootless docker

## One-command start

### macOS / Linux

```bash
./start-local.sh
```

### Windows

```cmd
start-local.bat
```

What this does (visible in the console):

1. Checks Node, pnpm, Docker, curl
2. `pnpm install` (all monorepo deps)
3. Builds `@crm/shared` (api depends on it)
4. `docker compose up -d` — Postgres, Redis, MinIO
5. Copies `.env.example` → `.env` if missing
6. Syncs `.env` → `apps/api/.env` (Prisma reads from cwd)
7. Waits for Postgres healthcheck (max 30s)
8. Auto-detects & resets DB if previous run left orphan enums
9. `prisma generate` + `prisma migrate deploy`
10. Seeds demo data if DB is empty
11. Finds free TCP ports for API (3001+) and web (3000+)
12. Starts API and web in separate consoles
13. Polls `/api/health` until OK
14. Opens browser at `http://localhost:<webPort>`

**First run** takes 3–5 min (mostly `pnpm install` + first Next.js compile). Subsequent: ~30s.

## After it boots

Open the printed URL (default http://localhost:3000) and log in:

- `admin@crm.local` / `admin12345` — admin (sees everything)
- `manager@crm.local` / `manager12345` — manager (team workload, reassign)
- `realtor@crm.local` / `realtor12345` — realtor (own leads only)
- `maria@crm.local` / `realtor12345` — second realtor
- `sofia@crm.local` / `realtor12345` — third realtor
- `pierre@crm.local` / `realtor12345` — realtor on vacation (`isAvailable=false`)

## Stop / restart / nuke

### Stop everything

```bash
./start-local.sh stop          # macOS / Linux
start-local.bat stop           # Windows
```

Stops dev servers AND Docker containers. Data persists.

### Reset the database

```bash
./start-local.sh reset         # asks confirmation
```

Drops Postgres volume, recreates schema, re-seeds demo data. Use when migrations get tangled.

### Tail logs

```bash
./start-local.sh logs
```

## Project structure

```
crm_project/
├─ apps/
│  ├─ api/          NestJS REST API + Prisma + BullMQ
│  └─ web/          Next.js 15 (App Router) + Tailwind + shadcn
├─ packages/
│  └─ shared/       Zod schemas, enums shared by api + web
├─ nginx/           Production reverse-proxy config (prod only)
├─ scripts/
│  ├─ backup.sh     pg_dump → gzip → ./backups/
│  ├─ restore.sh    Restore a dump
│  └─ deploy.sh     Production deploy (git pull → build → migrate → restart)
├─ docker-compose.yml       Dev (Postgres + Redis + MinIO)
├─ docker-compose.prod.yml  Prod (everything containerized + nginx)
├─ .env.example             Dev defaults (committed)
├─ .env.production.example  Prod template (committed; copy to .env on server)
└─ start-local.bat / .sh    One-command local start
```

## Common workflows

### Just want to play with it

```bash
./start-local.sh
# Browser opens automatically
```

### Make a change to the code

Web (Next.js) and API (`node --watch`) both hot-reload. Save a file → see it in the browser.

### Add a new database column

1. Edit `apps/api/prisma/schema.prisma`
2. ```bash
   cd apps/api && pnpm exec prisma migrate dev --name your_change_name
   ```
3. Prisma generates the migration SQL + updates the client.

### Reset to demo state mid-day

```bash
./start-local.sh reset
```

### View the database

```bash
docker exec -it crm-postgres psql -U crm -d crm
```

Or use a GUI: TablePlus, DataGrip, DBeaver, pgAdmin — all support pointing at `localhost:5432` with credentials from `.env`.

### View MinIO files (uploaded photos, documents)

Open http://localhost:9001 — credentials from `.env` (`MINIO_ROOT_USER` / `MINIO_ROOT_PASSWORD`, default `minioadmin` / `minioadmin_dev`).

## Manual fallback (if `start-local.sh` breaks)

```bash
pnpm install
pnpm --filter @crm/shared run build
docker compose up -d
cp .env apps/api/.env
pnpm --filter @crm/api run prisma:generate
pnpm --filter @crm/api run prisma:deploy
pnpm --filter @crm/api run prisma:seed

# Terminal 1
cd apps/api && API_PORT=3001 pnpm dev

# Terminal 2
cd apps/web && pnpm exec next dev --port 3000
```

Open http://localhost:3000.

## Troubleshooting

| Symptom | Fix |
|---|---|
| `Cannot find module '@crm/shared'` | `pnpm --filter @crm/shared run build` then retry |
| `Environment variable not found: DATABASE_URL` | `cp .env apps/api/.env` (Prisma reads from cwd) |
| Prisma migration P3018 (orphan enum) | `./start-local.sh reset` |
| Port 3000 or 3001 busy | The script auto-hops to 3002/3003. Check the printed summary. |
| Docker isn't running | Start Docker Desktop |
| Login fails — "wrong password" | Hit `http://localhost:3001/api/health` — if not 200, API didn't start. Check the CRM-API console window. |
| Web shows blank or 500 | Check `.dev-logs/web.log` (Linux/macOS) or the CRM-WEB window (Windows). First Next.js compile can take 60+ sec. |
| `Hotkeys conflict with browser (Ctrl+N, Ctrl+S)` | The CRM intentionally hijacks these (Linear-style). Disable in `apps/web/src/components/hotkeys-provider.tsx`. |
