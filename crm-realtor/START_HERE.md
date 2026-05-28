# 🚀 Quick start

You need: **Node.js 20+**, **pnpm** (auto-installs if missing), **Docker Desktop** (running).

## Run it

| OS | Command |
|---|---|
| **macOS / Linux** | `./start-local.sh` |
| **Windows** | `start-local.bat` (double-click or run from CMD/PowerShell) |

That's it. The script will:

1. Check Node 20+, pnpm, Docker.
2. Install all dependencies (`pnpm install`).
3. Build the `@crm/shared` workspace package (api depends on its compiled output).
4. Boot Postgres + Redis + MinIO via `docker compose up -d`.
5. Copy `.env.example` → `.env` if missing.
6. Sync `.env` into `apps/api/.env` (Prisma/Nest read from cwd, not the monorepo root).
7. Wait for Postgres to be ready.
8. Detect if the database is in a half-migrated state from a previous failed run, and reset it if needed.
9. Run `prisma generate` + `prisma migrate deploy`.
10. Seed demo users if the database is empty.
11. **Find free TCP ports** for API (starts at 3001) and Web (starts at 3000). Hops to the next free port if busy.
12. Write the chosen ports into `apps/api/.env` so `NEXT_PUBLIC_API_URL` matches.
13. Launch the API and Web servers as background processes.
14. Poll `GET /api/health` until the API returns `status: ok`.
15. Poll the Web root until Next.js finishes compiling.
16. Open `http://localhost:<web_port>` in your default browser.

First run takes ~3-5 minutes (mostly `pnpm install` + first Next.js compile). Subsequent runs: ~30 seconds.

## After it boots

The script prints a summary at the end with the exact URLs and ports it chose. Log in with one of the seeded users:

- `admin@crm.local` / `admin12345`
- `realtor@crm.local` / `realtor12345`

## Other commands

```bash
./start-local.sh stop      # stop dev servers + docker
./start-local.sh reset     # nuke database and start fresh (asks confirmation)
./start-local.sh logs      # tail both api + web logs
```

Windows: same with `start-local.bat …`. On Windows the API and Web run in their own visible CMD windows titled `CRM-API` and `CRM-WEB` so you can watch their output live.

## Manual fallback

If the autostart fails for any reason, run these in order:

```bash
pnpm install
pnpm --filter @crm/shared run build
docker compose up -d
cp .env apps/api/.env                                 # Windows: copy /Y .env apps\api\.env
pnpm --filter @crm/api run prisma:generate
pnpm --filter @crm/api run prisma:deploy
pnpm --filter @crm/api run prisma:seed

# Then in two separate terminals:
cd apps/api && API_PORT=3001 pnpm dev                 # backend on :3001
cd apps/web && pnpm exec next dev --port 3000         # frontend on :3000
```

Open `http://localhost:3000`.

## Troubleshooting

**`Cannot find module '@crm/shared'` (TS2307):**
You skipped the `pnpm --filter @crm/shared run build` step. Run it.

**Prisma error P3018 `type "UserRole" already exists`:**
The DB has orphan types from a failed previous run. Fix:
```bash
./start-local.sh reset       # macOS / Linux
start-local.bat reset        # Windows
```

**`Environment variable not found: DATABASE_URL`:**
The `.env` file isn't in `apps/api/`. Fix:
```bash
cp .env apps/api/.env        # macOS / Linux
copy /Y .env apps\api\.env   # Windows
```

**Port already in use:**
The script automatically hops to the next free port. The summary at the end shows the ports it actually used.

**Web is blank or shows 500:**
Check `.dev-logs/web.log` (macOS/Linux) or the CRM-WEB window (Windows). First-time Next.js compile can take 60+ seconds on slow machines.

**Login fails with "wrong password":**
Most likely the API isn't responding. Hit `http://localhost:<api_port>/api/health` in your browser. If you get a connection error there, the API didn't start. Check its log file or window for errors.

**PowerShell blocks `.ps1`:** I removed `start.ps1` for this reason — use `start-local.bat` on Windows. It's a `.bat` and doesn't trigger PowerShell's execution policy.

**Hotkeys in the app conflict with browser shortcuts (`Ctrl+N`, `Ctrl+S` etc):**
The CRM intentionally hijacks these (Linear/Notion-style). To disable: edit `apps/web/src/components/hotkeys-provider.tsx`.

---

For the full list of architectural changes vs. the original codebase, see `CHANGES.md`.
