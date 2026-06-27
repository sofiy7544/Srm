@echo off
REM ──────────────────────────────────────────────
REM stanley-fitness-audience-crm — one-click launcher (Windows)
REM Double-click this file or run: start.bat
REM ──────────────────────────────────────────────
cd /d "%~dp0"
echo 🥤 stanley-fitness-audience-crm - starting...

REM 1) Ensure .env exists
if not exist ".env" (
  copy ".env.example" ".env" >nul
  echo 📝 Created .env from .env.example - fill in your Meta/Telegram tokens later.
)

REM 2) Prefer Docker (full stack)
where docker >nul 2>nul
if %ERRORLEVEL%==0 (
  echo 🐳 Starting full stack with Docker Compose...
  docker compose up -d --build
  echo ⏳ Waiting for the API...
  timeout /t 20 /nobreak >nul
  docker compose exec -T api python -m scripts.seed
  echo.
  echo ✅ Up! Admin panel:  http://localhost:8000   ^(login: admin / admin12345^)
  echo    API docs:        http://localhost:8000/docs
  echo    Stop with:       docker compose down
  pause
  exit /b 0
)

REM 3) Fallback: local Python + SQLite
echo 🐍 Docker not found - running locally with SQLite...
python -m venv .venv
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip
pip install -r requirements.txt
set DATABASE_URL=sqlite+pysqlite:///./dev.sqlite3
python -m scripts.seed
echo.
echo ✅ Starting API on http://localhost:8000  (login: admin / admin12345)
uvicorn app.main:app --host 0.0.0.0 --port 8000
