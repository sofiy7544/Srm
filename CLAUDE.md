# CLAUDE.md — AI Development Guide
> **Realtor CRM** | Production SaaS | Last updated: 2026-05-28
> Maintained automatically after important discussions. Source of truth: GitHub repo `sofiy7544/srm`.

---

## 1. Project Identity

| Field | Value |
|-------|-------|
| **Product** | Self-hosted real estate CRM for agencies and individual realtors |
| **Repo** | `sofiy7544/srm` (monorepo) |
| **Stack** | NestJS 10 + Next.js 15 + PostgreSQL 16 + Redis 7 + MinIO |
| **Language** | TypeScript 5.6 throughout (strict mode) |
| **Package manager** | pnpm 11, workspaces |
| **Node** | ≥ 22 |
| **Status** | Production-ready (8.4/10 audit score, 0 TS errors, 157 tests) |

---

## 2. Monorepo Layout

```
crm-realtor/
├── apps/
│   ├── api/          # NestJS backend (25 modules, Prisma ORM)
│   └── web/          # Next.js 15 App Router frontend
├── packages/
│   └── shared/       # Zod schemas + TypeScript enums consumed by both apps
├── docs/             # Architecture & CRM logic docs (this folder)
├── nginx/            # Reverse proxy config
├── scripts/          # DB backup / deployment helpers
├── docker-compose.yml          # Dev: postgres, redis, minio
└── docker-compose.prod.yml     # Production deployment
```

---

## 3. Development Commands

```bash
# First run
pnpm install
pnpm --filter @crm/shared run build
docker compose up -d          # starts postgres:5432, redis:6379, minio:9000
pnpm db:migrate
pnpm db:seed
pnpm dev                      # web→3000, api→3001

# Daily
pnpm dev                      # parallel dev servers
pnpm typecheck                # zero errors required before commit
pnpm lint                     # ESLint across all packages
pnpm test                     # Jest (157 tests)
pnpm build                    # full production build

# Database
pnpm db:migrate               # apply Prisma migrations
pnpm db:generate              # regenerate Prisma client after schema change
pnpm db:seed                  # seed demo data (≈ 50 clients, 50 leads, 700 activities)

# Docker
pnpm docker:up / docker:down / docker:logs
```

---

## 4. Key File Locations

| Concern | Path |
|---------|------|
| Database schema | `crm-realtor/apps/api/prisma/schema.prisma` |
| API entry point | `crm-realtor/apps/api/src/main.ts` |
| NestJS app module | `crm-realtor/apps/api/src/app.module.ts` |
| API modules | `crm-realtor/apps/api/src/modules/` (25 dirs) |
| Shared enums/Zod | `crm-realtor/packages/shared/src/` |
| Next.js app dir | `crm-realtor/apps/web/src/app/` |
| Components | `crm-realtor/apps/web/src/components/` (132 files) |
| Zustand stores | `crm-realtor/apps/web/src/stores/` |
| i18n locales | `crm-realtor/apps/web/src/locales/` (ru, uk, en, fr, it) |
| Middleware | `crm-realtor/apps/web/src/middleware.ts` |
| Env template (dev) | `crm-realtor/.env.example` |
| Env template (prod) | `crm-realtor/.env.production.example` |
| CI pipeline | `crm-realtor/.github/workflows/ci.yml` |

---

## 5. Architecture Decisions (ADRs)

See `docs/architecture.md` for full ADR log. Summary:

- **NestJS** chosen for structured DI, decorator-based routing, native BullMQ/Prisma/Passport integration.
- **Next.js 15 App Router** for SSR/RSC where needed, streaming, nested layouts.
- **Prisma** over raw SQL for type-safe queries; migrations tracked in version control.
- **BullMQ** for all async jobs (email dispatch, Telegram webhooks, SLA cron, notifications).
- **Zustand** over Redux — minimal boilerplate, React 19 compatible.
- **pnpm workspaces** to share Zod schemas and enums without duplicating types.
- **MinIO** default storage (S3-compatible, self-hosted) — can swap to AWS S3 via env vars.
- **Argon2** for password hashing (not bcrypt) — superior against GPU attacks.

---

## 6. CRM Business Logic (summary)

Full detail in `docs/crm_logic.md`. Key rules:

- Lead stages: `NEW → CONTACTED → QUALIFIED → SHOWING → NEGOTIATION → WON | LOST`
- Deal stages: `OFFER → DOCS_REVIEW → DUE_DILIGENCE → CONTRACT → CLOSED_WON | CLOSED_LOST`
- Deduplication: only one active lead per phone number (server enforced).
- Assignment: round-robin weighted, respects `user.isAvailable` flag.
- SLA: first contact within policy → escalate to manager → auto-unassign if breached.
- Dual funnel: Buy and Rent are separate pipelines sharing the same Lead model (`dealIntent` field).
- GDPR: `Client.marketingConsent` + `consentTimestamp` + `consentVersion` required.
- Audit: every CREATE/UPDATE/DELETE writes to `AuditLog`.

---

## 7. RBAC Roles

| Role | Scope |
|------|-------|
| `ADMIN` | Full access, system settings, user management |
| `MANAGER` | Team view, reassignment, analytics |
| `EMPLOYEE` | TBD (same as REALTOR in current schema) |
| `REALTOR` | Own leads, clients, properties |
| `ASSISTANT` | Support tasks, no financial data |
| `ANALYST` | Read-only analytics, no PII mutation |

---

## 8. Locales

Supported: `ru` (Russian), `uk` (Ukrainian), `en` (English), `fr` (French), `it` (Italian).
Default locale set via `DEFAULT_LOCALE` env var. Locale files: `apps/web/src/locales/`.

---

## 9. Coding Standards

- **No `any` types** — use proper generics or `unknown`.
- **Zod schemas** in `packages/shared` are the single source of truth for DTOs.
- **No raw SQL** — Prisma queries only; raw SQL only if Prisma can't express it and must be wrapped in a typed helper.
- **BullMQ for side effects** — email, notifications, webhooks are always queued, never inline.
- **Atomic transactions** via `prisma.$transaction()` for multi-model writes (e.g., lead + activity + notification).
- **Argon2** for passwords — never bcrypt, never SHA, never MD5.
- Comments only when the WHY is non-obvious (see system CLAUDE.md rule).
- Test files live next to source: `*.spec.ts`.

---

## 10. Environment Variables (critical)

| Variable | Notes |
|----------|-------|
| `DATABASE_URL` | PostgreSQL connection string |
| `REDIS_URL` | Redis connection string |
| `JWT_ACCESS_SECRET` | ≥ 32 chars |
| `JWT_REFRESH_SECRET` | ≥ 32 chars, different from access |
| `MINIO_ENDPOINT / AWS_*` | File storage (one or the other) |
| `RESEND_API_KEY` | Email delivery |
| `TELEGRAM_BOT_TOKEN` | Bot integration |
| `DEFAULT_LOCALE` | `uk` | `ru` | `en` | `fr` | `it` |

Never commit real secrets. Use `.env.example` as template.

---

## 11. CI/CD

- **Trigger:** push to `main`, PR to `main`
- **Jobs (sequential):** install → prisma generate → migrate → typecheck → lint → build → test
- **Database service:** PostgreSQL 16 with health check in CI
- **Required to pass before merge:** all jobs green

---

## 12. Test Credentials (demo only)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@crm.local` | `admin12345` |
| Manager | `manager@crm.local` | `manager12345` |
| Realtor | `realtor@crm.local` | `realtor12345` |

---

## 13. Memory Update Protocol

After any significant discussion about architecture, business logic, deployment, or UX decisions, update the relevant file:

| Topic | File |
|-------|------|
| Architecture/ADR | `docs/architecture.md` |
| CRM logic / workflows | `docs/crm_logic.md` |
| Project decisions / history | `PROJECT_MEMORY.md` |
| AI dev guide / standards | `CLAUDE.md` |

Commit message format: `docs: update [filename] — [brief reason]`
