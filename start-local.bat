@echo off
REM ============================================================================
REM CRM Realtor - local boot (Windows).
REM
REM Usage (double-click or from CMD/PowerShell):
REM   start-local.bat           full setup + start
REM   start-local.bat stop      stop dev servers + docker
REM   start-local.bat reset     NUKE database and start fresh
REM   start-local.bat logs      show log file paths
REM ============================================================================

setlocal EnableDelayedExpansion
cd /d "%~dp0"

if /i "%1"=="stop"  goto :CMD_STOP
if /i "%1"=="reset" goto :CMD_RESET
if /i "%1"=="logs"  goto :CMD_LOGS

REM ============================================================================
REM Main start flow
REM ============================================================================

echo.
echo === Checking prerequisites ===

where node >nul 2>&1
if errorlevel 1 (
  echo [X] Node.js not found. Install from https://nodejs.org ^(need v20+^).
  pause & exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VER=%%i
echo   [OK] Node !NODE_VER!

where pnpm >nul 2>&1
if errorlevel 1 (
  echo   [!] pnpm not found, installing via corepack
  call corepack enable
  call corepack prepare pnpm@latest --activate
  where pnpm >nul 2>&1 || (
    echo [X] Failed to install pnpm. Try: npm install -g pnpm
    pause & exit /b 1
  )
)
for /f "tokens=*" %%i in ('pnpm --version') do set PNPM_VER=%%i
echo   [OK] pnpm !PNPM_VER!

docker info >nul 2>&1
if errorlevel 1 (
  echo [X] Docker not running. Start Docker Desktop and re-run.
  pause & exit /b 1
)
echo   [OK] Docker running

where curl >nul 2>&1
if errorlevel 1 (
  echo [X] curl not found. ^(Windows 10+ ships with it. Update Windows.^)
  pause & exit /b 1
)
echo   [OK] curl available

echo.
echo === Installing pnpm dependencies ===
call pnpm install
if errorlevel 1 (
  echo [X] pnpm install failed
  pause & exit /b 1
)
echo   [OK] dependencies installed

echo.
echo === Building @crm/shared ===
REM apps/api imports @crm/shared whose main points at ./dist.
REM Without this build, the api fails with TS2307 on every import.
REM
REM Defensively delete any stale tsbuildinfo and dist before building. If an
REM old tsbuildinfo is checked in (or left over from a previous run on another
REM machine), tsc's --incremental mode sees "nothing changed" and emits NO
REM files, leaving dist empty. The api then crashes at runtime with
REM "Cannot find module '@crm/shared/dist/index.js'".
if exist packages\shared\tsconfig.tsbuildinfo del /F /Q packages\shared\tsconfig.tsbuildinfo
if exist packages\shared\dist rmdir /S /Q packages\shared\dist
call pnpm --filter "@crm/shared" run build
if errorlevel 1 (
  echo [X] @crm/shared build failed
  pause & exit /b 1
)
REM Verify the build actually produced the expected entry point.
if not exist packages\shared\dist\index.js (
  echo [X] @crm/shared build silently produced no output.
  echo     packages\shared\dist\index.js is missing.
  echo     Try: pnpm --filter "@crm/shared" run build  in a fresh terminal.
  pause & exit /b 1
)
echo   [OK] @crm/shared built (verified dist\index.js exists)

echo.
echo === Checking .env ===
if not exist .env (
  copy /Y .env.example .env >nul
  echo   [OK] .env created from .env.example
) else (
  echo   [OK] .env exists
)
REM Prisma/Nest both load .env from cwd.
copy /Y .env apps\api\.env >nul
echo   [OK] apps\api\.env synced

echo.
echo === Starting Postgres + Redis + MinIO ===
call docker compose up -d
if errorlevel 1 (
  echo [X] docker compose up failed
  pause & exit /b 1
)
echo   [OK] docker compose up -d

echo.
echo === Waiting for Postgres ^(max 30s^) ===
set /a count=0
:WAIT_PG
docker compose exec -T postgres pg_isready -U crm >nul 2>&1
if errorlevel 1 (
  set /a count+=1
  if !count! geq 30 (
    echo [X] Postgres not ready after 30s. Check: docker compose logs postgres
    pause & exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto :WAIT_PG
)
echo   [OK] Postgres ready

echo.
echo === Detecting database state ===

REM Detect failed/orphan migrations and repair before applying.
docker compose exec -T postgres psql -U crm -d crm -tAc "SELECT to_regclass('public._prisma_migrations');" >tmp_check.txt 2>nul
set /p PRISMA_TABLE=<tmp_check.txt
del tmp_check.txt 2>nul
set PRISMA_TABLE=!PRISMA_TABLE: =!

docker compose exec -T postgres psql -U crm -d crm -tAc "SELECT to_regclass('public.users');" >tmp_check.txt 2>nul
set /p USERS_TABLE=<tmp_check.txt
del tmp_check.txt 2>nul
set USERS_TABLE=!USERS_TABLE: =!

set NEEDS_RESET=0

if not "!PRISMA_TABLE!"=="" (
  docker compose exec -T postgres psql -U crm -d crm -tAc "SELECT COUNT(*) FROM _prisma_migrations WHERE finished_at IS NULL;" >tmp_check.txt 2>nul
  set /p FAILED_COUNT=<tmp_check.txt
  del tmp_check.txt 2>nul
  set FAILED_COUNT=!FAILED_COUNT: =!
  if not "!FAILED_COUNT!"=="0" (
    if not "!FAILED_COUNT!"=="" (
      echo   [!] Found !FAILED_COUNT! incomplete migration^(s^) - will reset
      set NEEDS_RESET=1
    )
  )
)

if "!USERS_TABLE!"=="" (
  docker compose exec -T postgres psql -U crm -d crm -tAc "SELECT COUNT(*) FROM pg_type WHERE typname IN ('UserRole','LeadStage','PropertyType');" >tmp_check.txt 2>nul
  set /p ORPHAN=<tmp_check.txt
  del tmp_check.txt 2>nul
  set ORPHAN=!ORPHAN: =!
  if not "!ORPHAN!"=="0" (
    if not "!ORPHAN!"=="" (
      echo   [!] Orphan enums from previous failed run - will reset
      set NEEDS_RESET=1
    )
  )
)

if "!NEEDS_RESET!"=="1" (
  echo.
  echo === Resetting database to clean state ===
  docker compose exec -T postgres psql -U crm -d postgres -c "DROP DATABASE IF EXISTS crm WITH (FORCE);" >nul 2>&1
  docker compose exec -T postgres psql -U crm -d postgres -c "CREATE DATABASE crm;" >nul 2>&1
  echo   [OK] database recreated
) else (
  echo   [OK] database state OK
)

echo.
echo === Generating Prisma client ===
call pnpm --filter "@crm/api" run prisma:generate
if errorlevel 1 (
  echo [X] prisma generate failed
  pause & exit /b 1
)
echo   [OK] Prisma client generated

echo.
echo === Applying Prisma migrations ===
call pnpm --filter "@crm/api" run prisma:deploy
if errorlevel 1 (
  echo [X] prisma migrate deploy failed
  echo     Try: start-local.bat reset
  pause & exit /b 1
)
echo   [OK] migrations applied

echo.
echo === Seeding demo data ^(if database empty^) ===
docker compose exec -T postgres psql -U crm -d crm -tAc "SELECT COUNT(*) FROM users;" >tmp_check.txt 2>nul
set /p USER_COUNT=<tmp_check.txt
del tmp_check.txt 2>nul
set USER_COUNT=!USER_COUNT: =!
set /a NEED_SEED=0
if "!USER_COUNT!"=="0" set /a NEED_SEED=1
if "!USER_COUNT!"=="1" set /a NEED_SEED=1
if "!USER_COUNT!"=="2" set /a NEED_SEED=1
if "!USER_COUNT!"=="3" set /a NEED_SEED=1
if "!USER_COUNT!"=="4" set /a NEED_SEED=1
if "!NEED_SEED!"=="1" (
  call pnpm --filter "@crm/api" run prisma:seed
  if errorlevel 1 (
    echo   [!] Seed failed - you can sign up manually
  ) else (
    echo   [OK] seeded
  )
) else (
  echo   [OK] Database has !USER_COUNT! users, skipping seed
)

echo.
echo === Stopping any leftover dev servers ===
call :STOP_DEV_WINDOWS
echo   [OK] cleared

echo.
echo === Finding free TCP ports ===

REM Port hopping: start at 3001 for API, 3000 for Web, walk up to +50.
set API_PORT=3001
set /a tries=0
:FIND_API_PORT
call :IS_PORT_FREE !API_PORT!
if "!PORT_FREE!"=="0" (
  set /a API_PORT+=1
  set /a tries+=1
  if !tries! geq 50 (
    echo [X] Could not find free port for API in range 3001-3050
    pause & exit /b 1
  )
  goto :FIND_API_PORT
)

set WEB_PORT=3000
set /a tries=0
:FIND_WEB_PORT
call :IS_PORT_FREE !WEB_PORT!
if "!PORT_FREE!"=="0" (
  set /a WEB_PORT+=1
  set /a tries+=1
  if !tries! geq 50 (
    echo [X] Could not find free port for Web in range 3000-3050
    pause & exit /b 1
  )
  goto :FIND_WEB_PORT
)
REM Avoid Web colliding with API if they hopped onto the same number.
if !WEB_PORT!==!API_PORT! (
  set /a WEB_PORT+=1
  goto :FIND_WEB_PORT
)

echo   [OK] API -^> :!API_PORT!
echo   [OK] Web -^> :!WEB_PORT!

echo.
echo === Writing chosen ports into apps\api\.env ===
REM Use a small powershell snippet for reliable in-place key=value updates.
powershell -NoProfile -Command "$f='apps\api\.env'; $c=Get-Content $f -Raw; $c=[regex]::Replace($c,'(?m)^API_PORT=.*$','API_PORT=%API_PORT%'); $c=[regex]::Replace($c,'(?m)^WEB_PORT=.*$','WEB_PORT=%WEB_PORT%'); $c=[regex]::Replace($c,'(?m)^NEXT_PUBLIC_API_URL=.*$','NEXT_PUBLIC_API_URL=http://localhost:%API_PORT%'); Set-Content $f -Value $c -NoNewline"
if errorlevel 1 (
  echo   [!] Could not patch apps\api\.env automatically. Will pass via env var instead.
)
echo   [OK] env updated

echo.
echo === Starting API on :%API_PORT% ===
REM The npm-script "dev" uses bash syntax (`& sleep 3 && node --watch & wait`)
REM which silently fails on Windows cmd. Launch the two pieces ourselves so
REM both tsc --watch and node --watch are real processes we can observe.
REM
REM Same anti-stale-incremental dance as for @crm/shared above: nuke any
REM old tsbuildinfo and dist so tsc actually emits files this run.
if exist apps\api\tsconfig.tsbuildinfo del /F /Q apps\api\tsconfig.tsbuildinfo
if exist apps\api\dist rmdir /S /Q apps\api\dist

echo   Pre-building API once...
call pnpm --filter "@crm/api" run build
if errorlevel 1 (
  echo [X] API initial build failed. Check the output above.
  pause & exit /b 1
)
if not exist apps\api\dist\main.js (
  echo [X] API build produced no main.js. Cannot start node --watch.
  pause & exit /b 1
)
echo   [OK] API pre-built (verified dist\main.js exists)

REM Window 1: tsc watcher — recompiles on every file save.
start "CRM-API-TSC" cmd /k "cd apps\api && pnpm exec tsc -p tsconfig.json --watch --noEmit false"

REM Wait briefly so tsc grabs the lock on dist files before node touches them.
timeout /t 2 /nobreak >nul

REM Window 2: node runtime — restarts on every dist/*.js change.
start "CRM-API" cmd /k "cd apps\api && set API_PORT=%API_PORT% && node --watch dist/main.js"
echo   [OK] API windows opened ^(CRM-API and CRM-API-TSC^)

echo.
echo === Waiting for API to compile and become healthy ^(max 180s^) ===
set /a count=0
:WAIT_API
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%API_PORT%/api/health' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; if ($r.Content -match '\"status\":\"ok\"') { exit 0 } else { exit 1 } } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  set /a count+=1
  if !count! geq 180 (
    echo.
    echo [!] API didn't become healthy within 180s. Check the CRM-API window.
    echo     If you see errors there, copy them and ask for help.
    goto :LAUNCH_WEB
  )
  if !count!==1 echo   ^(this can take 30-60s for first Nest compile^)
  timeout /t 1 /nobreak >nul
  goto :WAIT_API
)
echo   [OK] API healthy

:LAUNCH_WEB
echo.
echo === Starting Web on :%WEB_PORT% ===
start "CRM-WEB" cmd /k "pnpm --filter @crm/web exec next dev --port %WEB_PORT%"
echo   [OK] Web window opened ^(title: CRM-WEB^)

echo.
echo === Waiting for Next.js to compile ^(max 120s^) ===
set /a count=0
:WAIT_WEB
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%WEB_PORT%' -TimeoutSec 1 -UseBasicParsing -ErrorAction Stop; exit 0 } catch { exit 1 }" >nul 2>&1
if errorlevel 1 (
  set /a count+=1
  if !count! geq 120 (
    echo.
    echo [!] Web didn't respond within 120s. Check the CRM-WEB window.
    goto :OPEN_BROWSER
  )
  if !count!==1 echo   ^(first compile of Next.js can be 30-90s^)
  timeout /t 1 /nobreak >nul
  goto :WAIT_WEB
)
echo   [OK] Web responding

:OPEN_BROWSER
echo.
echo === Opening browser ===
start http://localhost:%WEB_PORT%
echo   [OK] http://localhost:%WEB_PORT%

echo.
echo ============================================================
echo   CRM Realtor is up.
echo ============================================================
echo.
echo   Web ^(open in browser^):  http://localhost:%WEB_PORT%
echo   API:                    http://localhost:%API_PORT%/api
echo   API health:             http://localhost:%API_PORT%/api/health
echo   MinIO console:          http://localhost:9001 ^(minioadmin/minioadmin^)
echo.
echo   Login:
echo     admin@crm.local   / admin12345
echo     realtor@crm.local / realtor12345
echo.
echo   The API and Web run in separate windows ^(titled CRM-API and CRM-WEB^).
echo   Close them or use 'start-local.bat stop' to terminate.
echo.
echo   Hotkeys in the app: Ctrl+K palette, Ctrl+N new client,
echo                       Ctrl+L new lead, Shift+? help
echo.
echo   Controls:
echo     start-local.bat stop    - stop dev servers + docker
echo     start-local.bat reset   - nuke DB and start fresh
echo.
echo   Manual fallback if autostart fails:
echo     1. pnpm install
echo     2. pnpm --filter @crm/shared run build
echo     3. docker compose up -d
echo     4. copy /Y .env apps\api\.env
echo     5. pnpm --filter @crm/api run prisma:generate
echo     6. pnpm --filter @crm/api run prisma:deploy
echo     7. pnpm --filter @crm/api run prisma:seed
echo     8. In one CMD:  cd apps\api ^&^& set API_PORT=%API_PORT% ^&^& pnpm dev
echo     9. In another:  cd apps\web ^&^& pnpm exec next dev --port %WEB_PORT%
echo    10. Open http://localhost:%WEB_PORT%
echo.
pause
exit /b 0


REM ============================================================================
REM Helper: check if a TCP port is free.
REM Sets PORT_FREE=1 if free, 0 if busy.
REM ============================================================================
:IS_PORT_FREE
set PORT_FREE=1
netstat -ano -p TCP | findstr ":%~1 " | findstr "LISTENING" >nul 2>&1
if not errorlevel 1 set PORT_FREE=0
exit /b 0


REM ============================================================================
:STOP_DEV_WINDOWS
taskkill /F /FI "WINDOWTITLE eq CRM-API*" >nul 2>&1
taskkill /F /FI "WINDOWTITLE eq CRM-WEB*" >nul 2>&1
exit /b 0


REM ============================================================================
:CMD_STOP
echo === Stopping dev servers ===
call :STOP_DEV_WINDOWS
echo   [OK] dev servers stopped

echo === Stopping docker services ===
call docker compose down
echo   [OK] all stopped
exit /b 0


REM ============================================================================
:CMD_RESET
echo === Hard reset: will DELETE all data ===
set /p ans="Continue? [y/N] "
if /i not "!ans!"=="y" (
  echo aborted
  exit /b 0
)

call :STOP_DEV_WINDOWS
call docker compose down -v
echo   [OK] volumes removed

call docker compose up -d
echo   [OK] docker compose up -d

set /a count=0
:RESET_WAIT_PG
docker compose exec -T postgres pg_isready -U crm >nul 2>&1
if errorlevel 1 (
  set /a count+=1
  if !count! geq 30 (
    echo [X] Postgres not ready
    pause & exit /b 1
  )
  timeout /t 1 /nobreak >nul
  goto :RESET_WAIT_PG
)
echo   [OK] Postgres ready

copy /Y .env apps\api\.env >nul
call pnpm --filter "@crm/shared" run build
call pnpm --filter "@crm/api" run prisma:generate
call pnpm --filter "@crm/api" run prisma:deploy
call pnpm --filter "@crm/api" run prisma:seed
echo.
echo   [OK] database recreated. Now run: start-local.bat
exit /b 0


REM ============================================================================
:CMD_LOGS
echo The API and Web run in their own windows ^(titled CRM-API / CRM-WEB^).
echo The output is visible there in real time.
echo.
echo Docker service logs:
echo   docker compose logs -f postgres
echo   docker compose logs -f redis
echo   docker compose logs -f minio
exit /b 0
