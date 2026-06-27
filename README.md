# 🥤 stanley-fitness-audience-crm

A **legal** warm-audience collection & CRM system for the Stanley / thermos /
fitness / water / sport / healthy-nutrition niche, built **exclusively on
official Meta tools** — Meta Pixel, Marketing API, Lead Ads + Webhooks,
Conversions API and Custom Audiences.

> ### ⚖️ Compliance by design
> This project **does not** scrape Facebook users, **does not** collect personal
> data without consent, and **does not** bypass any Meta protection. Every
> contact is collected with explicit consent and uploaded to Meta only in
> **SHA-256 hashed** form, exactly as the Marketing API requires.

---

## Stack

| Layer | Tech |
|-------|------|
| Backend | Python 3.12 · FastAPI |
| DB | PostgreSQL + SQLAlchemy 2.0 + Alembic |
| Queue / jobs | Redis + Celery (worker + beat) |
| Admin panel | FastAPI + Jinja2 (server-rendered) |
| Bot | python-telegram-bot v21 |
| Meta | `facebook-business` SDK + Graph API (httpx) |
| Deploy | Docker Compose · Render · Railway · GitHub Actions |

---

## Features

- **CRM leads** — full pipeline (`new → contacted → interested → price_sent → ordered → paid → rejected → archived`), search, filtering, manager comments.
- **Lead scoring** — transparent rule-based `lead_score()` (unit-tested).
- **Meta Lead Ads** — webhook receiver + bulk sync from lead forms.
- **Custom Audiences** — built from *consented* leads, hashed before upload.
- **Pixel + landing pages** — 5 segmented landings firing PageView / ViewContent / Lead / AddToCart / Purchase.
- **Conversions API** — optional server-side event mirroring.
- **Telegram bot** — new-lead alerts, lead cards, status changes, reminders, `/stats`, `/today`, `/hot`.
- **CSV** — import / export / downloadable template.
- **Audience JSON templates** — 8 ready-to-use targeting specs in `/audiences`.
- **Security** — env-only secrets, admin auth, rate limiting, PII-redacting logs.

---

## Quick start (local, no Docker)

```bash
# 1. Create a virtualenv and install deps
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt

# 2. Configure
cp .env.example .env
# For the fastest start, set in .env:  DATABASE_URL=sqlite+pysqlite:///./dev.sqlite3

# 3. Seed demo data (creates tables + demo leads + audience templates)
python -m scripts.seed

# 4. Run the API
uvicorn app.main:app --reload
```

Open <http://localhost:8000> → log in with `admin` / `admin12345` (change in `.env`).

Landing pages: `/landing/stanley`, `/landing/fitness`, `/landing/water`,
`/landing/protein`, `/landing/gift`.

API docs: <http://localhost:8000/docs> · Health: <http://localhost:8000/health>

## Quick start (Docker)

```bash
cp .env.example .env          # fill in secrets
docker compose up --build     # api:8000, postgres, redis, worker, beat, bot
docker compose exec api python -m scripts.seed   # optional demo data
```

---

## Project layout

```
app/
├── main.py            # FastAPI entrypoint
├── config.py          # env settings (pydantic-settings)
├── database.py        # SQLAlchemy engine/session
├── models/            # Lead, PixelEvent, Audience, Campaign, ActivityLog
├── schemas/           # Pydantic DTOs
├── services/          # scoring, meta_client, leads, csv_io, notifications
├── api/routes/        # auth, admin, api_leads, meta, webhooks, landing
├── core/              # security, logging (PII redaction), rate_limit
├── tasks/             # Celery app + jobs
├── telegram/          # manager bot
├── templates/         # admin panel + landing pages (Jinja2)
└── static/            # pixel.js helper
alembic/               # migrations
audiences/             # 8 ad-audience JSON templates
scripts/               # seed.py, seed_audiences.py
tests/                 # scoring unit tests
```

---

## Lead scoring rules

| Signal | Points |
|--------|-------:|
| Has phone | +20 |
| Has Telegram | +20 |
| Interest = Stanley | +15 |
| Interest = fitness/water/protein | +15 |
| Came from Lead Ads | +10 |
| Visited landing > 1× | +10 |
| Clicked price | +10 |
| Added to cart | +20 |
| No contact | −20 |
| No consent | −30 |

A lead is **hot** at **≥ 50** points.

---

## Tests

```bash
pytest -q
```

---

## Deployment

See **[README_DEPLOY.md](./README_DEPLOY.md)** for the full step-by-step guide:
Meta Business Manager setup, creating a Pixel, connecting the Lead Ads webhook,
required environment variables, and one-click deploy to Render / Railway.
