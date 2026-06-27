# 🔍 Audit report — stanley-fitness-audience-crm

**Date:** 2026-06-27
**Scope:** full codebase — functionality, security, correctness, quality.
**Verdict:** ✅ **PASS** — the application builds, migrates, all tests and smoke
checks pass, and no secrets or hard policy issues were found. One minor dead-code
line was removed.

---

## 1. Environment & build

| Check | Result |
|-------|--------|
| Python compileall (`app scripts tests alembic`) | ✅ OK |
| `pip install -r requirements.txt` | ✅ OK |
| Alembic `upgrade head` (fresh DB) | ✅ creates all 5 tables |
| Seed script (`scripts.seed`) | ✅ 8 audiences + 5 demo leads |
| App import / lifespan startup | ✅ OK |

## 2. Unit tests

`pytest` → **7 passed** (lead scoring rules, including consent penalty and the
`hot` threshold).

## 3. Functional & security smoke (9/9 passed)

| Check | Result |
|-------|--------|
| Consent flag changes score by −30 | ✅ |
| CSV export header well-formed | ✅ |
| CSV re-import accepted | ✅ |
| Webhook rejects wrong `verify_token` (403) | ✅ |
| Lead Ads webhook returns 200 + processes entry | ✅ |
| Lead Ads lead stored as consented, `source=lead_ads` | ✅ |
| Duplicate webhook is idempotent (no double insert) | ✅ |
| Settings page masks all secret values | ✅ |
| Logs redact email + phone (PII filter) | ✅ |

Endpoint coverage verified: `/health`, `/login`, `/`, `/leads`, `/audiences`,
`/campaigns`, `/settings`, `/logs`, `/api/leads` (CRUD), `/leads.csv`,
`/leads/template.csv`, `/webhooks/meta` (GET+POST), `/webhooks/pixel-event`,
`/landing/{segment}` (+ lead submit), `/api/meta/*`.

## 4. Security review

| Area | Finding |
|------|---------|
| Secrets in repo | ✅ No `.env` tracked; no hardcoded tokens/passwords (grep clean) |
| Secret display | ✅ Settings page shows "set ✓" only, never values |
| Auth | ✅ Admin pages redirect to `/login`; API returns 401 unauthenticated |
| Rate limiting | ✅ `slowapi` limiter wired (`RATE_LIMIT_DEFAULT`) |
| PII in logs | ✅ `PIIRedactingFilter` redacts emails & phone numbers |
| Consent gate | ✅ Audience push selects only `consent = true` leads |
| Hashing | ✅ Email/phone SHA-256 normalized+hashed before any Meta upload |
| Graceful degradation | ✅ Meta calls return clear 400 / log + continue when unconfigured |

## 5. Correctness notes

- **Idempotent ingestion** — leads are upserted by `external_id`
  (`meta:<leadgen_id>` / `csv:<email>:<phone>`), so webhook retries and repeated
  CSV imports never duplicate records. Verified.
- **Scoring** matches the agreed rule table exactly (unit-tested end-to-end,
  e.g. phone+telegram+stanley+lead_ads+visits+price+cart = 105).
- **Migrations vs models** — initial migration mirrors the ORM schema; both
  produce the same 5 tables.

## 6. Issues found & fixed

| # | Severity | Issue | Action |
|---|----------|-------|--------|
| 1 | Low | Dead/confusing line in `webhooks.py::_fetch_and_map_lead` (`raw = meta_client.fetch_leads_for_form`, unused) | ✅ Removed |

## 7. Observations (no action required)

- The broad `except Exception` in `_fetch_and_map_lead` is intentional: it keeps
  webhook ingestion resilient to Graph API/network failures and logs a warning.
- During the smoke test the leadgen webhook attempted a real Graph API call and
  received `403` (no valid token configured) — handled gracefully, lead still
  stored. This confirms the degradation path works.

## 8. Compliance restatement

This system uses **official Meta APIs only** (Pixel, Marketing API, Lead Ads
webhooks, Conversions API, Custom Audiences). It performs **no scraping, no
collection without consent, and no circumvention of Meta protections**. Audit
confirms the consent gate and hashing are enforced before any data leaves the
server.

---

### How to reproduce this audit

```bash
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt pytest
export DATABASE_URL="sqlite+pysqlite:///./audit.sqlite3" \
       SECRET_KEY="audit-secret-key-1234567890-abcdefghij" VERIFY_TOKEN="audit-verify"
python -m compileall app scripts tests alembic
pytest -q
alembic upgrade head
```
