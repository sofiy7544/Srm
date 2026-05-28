# PROJECT_MEMORY.md — Living Project Log
> **Realtor CRM** | Persistent context for Claude Code sessions
> Updated automatically after important discussions. Do not edit manually without updating the date.

---

## Project Overview

A production-grade, self-hosted real estate CRM for agencies and individual realtors. Multi-tenant capable, omnichannel communication, dual buy/rent funnel, RBAC, GDPR-compliant. Localized in 5 languages (RU, UK, EN, FR, IT).

- **Repo:** `sofiy7544/srm`
- **Production branch:** `main`
- **Feature branches:** `claude/*`
- **Initial production audit score:** 8.4/10 (23 items fixed)

---

## Session Log

### 2026-05-28 — Initial Memory Setup
**Context:** First Claude Code session on this repository.
**Decisions made:**
- Created `CLAUDE.md`, `PROJECT_MEMORY.md`, `docs/architecture.md`, `docs/crm_logic.md` as the persistent memory layer.
- Branch used: `claude/project-memory-docs-9OQGp`
**Status:** Documentation scaffold created. Ready for ongoing development.

---

## Architecture Decisions Log

> Full detail in `docs/architecture.md`. Summaries logged here for quick recall.

### ADR-001 — Monorepo with pnpm workspaces
- **Date:** Pre-audit (project genesis)
- **Decision:** Single repo for `api`, `web`, `shared` packages
- **Reason:** Type-safe DTO sharing via `packages/shared`, unified CI, coordinated releases

### ADR-002 — NestJS over Express
- **Date:** Pre-audit
- **Decision:** NestJS 10 with decorators for all API logic
- **Reason:** DI container, Guards, Interceptors, Pipes fit the RBAC and audit requirements; BullMQ/Passport/Prisma have first-class NestJS modules

### ADR-003 — Prisma ORM
- **Date:** Pre-audit
- **Decision:** Prisma 5.x with PostgreSQL 16
- **Reason:** Type-safe queries, migration tracking, Prisma Studio for debug; trade-off: slightly verbose for complex joins but acceptable

### ADR-004 — Next.js 15 App Router
- **Date:** Pre-audit
- **Decision:** App Router (not Pages Router)
- **Reason:** RSC for initial page loads, nested layouts for authenticated sections, streaming for slow analytics queries

### ADR-005 — BullMQ for async jobs
- **Date:** Pre-audit
- **Decision:** All side effects (email, notifications, webhooks, SLA cron) go through BullMQ queues backed by Redis
- **Reason:** Reliability (job retries), observability, decoupling API response time from side effects

### ADR-006 — MinIO as default storage
- **Date:** Pre-audit
- **Decision:** MinIO (S3-compatible) as self-hosted default; AWS S3 swappable via env vars
- **Reason:** No cloud vendor lock-in for self-hosted deployments; identical SDK interface

### ADR-007 — Argon2 password hashing
- **Date:** Pre-audit
- **Decision:** Argon2id (not bcrypt)
- **Reason:** Argon2id is winner of Password Hashing Competition; superior against GPU/ASIC attacks

### ADR-008 — Zustand over Redux
- **Date:** Pre-audit
- **Decision:** Zustand 5 for frontend global state
- **Reason:** Minimal boilerplate, React 19 compatible, no provider wrapping required

### ADR-009 — Zod schemas as single DTO source
- **Date:** Pre-audit
- **Decision:** All request/response DTOs defined in `packages/shared` as Zod schemas
- **Reason:** Shared validation between frontend (form validation) and backend (NestJS pipes); single source of truth eliminates drift

---

## Business Logic Decisions Log

> Full detail in `docs/crm_logic.md`.

### BL-001 — Single active lead per phone
- **Rule:** Server rejects creation of a second active lead if the same phone number has an open lead
- **Rationale:** Prevents duplicate work, confusion between realtors
- **Implementation:** `LeadService.create()` checks for existing `ACTIVE` lead by phone before insert

### BL-002 — Round-robin weighted assignment
- **Rule:** New leads distributed round-robin across available realtors; respects `user.isAvailable = true`
- **Rationale:** Fair workload distribution; vacation-aware
- **Implementation:** `AutomationService` selects next eligible realtor by `lastAssignedAt` ascending

### BL-003 — SLA escalation chain
- **Rule:** First contact SLA (configurable) → if missed, notify manager → if still missed, auto-unassign and re-queue
- **Rationale:** No lead goes cold without visibility
- **Implementation:** BullMQ delayed job created at lead assignment; cancelled on first activity

### BL-004 — Property hold on negotiation
- **Rule:** When lead enters `NEGOTIATION`, the linked property's status atomically changes to `RESERVED`
- **Rationale:** Prevents double-booking during active deal
- **Implementation:** `prisma.$transaction()` in `LeadService.updateStage()`

### BL-005 — Dual buy/rent funnels
- **Rule:** `Lead.dealIntent = BUY | RENT` determines which property inventory is shown
- **Rationale:** Buy and rent pipelines have different property types, timelines, and commission structures
- **Implementation:** All property queries filter by `dealIntent`; Kanban boards are separate views

### BL-006 — GDPR consent tracking
- **Rule:** `Client.marketingConsent`, `consentTimestamp`, `consentVersion` required on every client record
- **Rationale:** EU GDPR Article 7 compliance; consent must be explicit, documented, versioned
- **Implementation:** Client creation form enforces consent checkbox; version stored as string (e.g., `v2024-01`)

### BL-007 — Post-showing feedback task
- **Rule:** 2 hours after a showing is marked `COMPLETED`, a `FOLLOW_UP` task is auto-created for the assigned realtor
- **Rationale:** Ensures no showing result goes uncaptured
- **Implementation:** BullMQ delayed job in `ShowingService.complete()`

### BL-008 — WON re-engagement referral task
- **Rule:** 6 months after a deal closes as `CLOSED_WON`, a `FOLLOW_UP` task is created to contact client for referrals
- **Rationale:** Referral channel is highest-LTV source
- **Implementation:** BullMQ delayed job in `DealService.close()`

---

## Deployment Context

- **Self-hosted** via Docker Compose (prod) + Nginx reverse proxy
- **Database:** PostgreSQL 16 (external managed DB recommended for production)
- **Cache/Queue:** Redis 7 (AOF persistence enabled)
- **Storage:** MinIO (or AWS S3)
- **CI/CD:** GitHub Actions → push to `main` triggers full pipeline
- **Health endpoint:** `GET /health` on API
- **Backup scripts:** `scripts/` directory

---

## Integrations Inventory

| Integration | Status | Module |
|-------------|--------|--------|
| Telegram Bot | Ready | `modules/telegram/` |
| Facebook Lead Ads webhook | Ready | `modules/webhooks/` |
| WhatsApp Business Cloud API | Ready | `modules/messages/` |
| Instagram DMs | Ready | `modules/messages/` |
| Email (Resend) | Ready | `modules/email/` |
| Email (SMTP fallback) | Ready | `modules/email/` |
| AWS S3 / MinIO | Ready | `modules/uploads/` |
| Custom webhooks | Ready | `modules/webhooks/` |

---

## Known Constraints & Gotchas

1. `packages/shared` must be built before `apps/api` or `apps/web` — `pnpm --filter @crm/shared run build` first.
2. Prisma client must be regenerated after any schema change: `pnpm db:generate`.
3. `user.isAvailable` must be toggled correctly — automation skips unavailable realtors entirely.
4. MinIO buckets (`public`, `private`) are auto-created by the `minio-init` Docker service on first run.
5. JWT secrets must be different for access and refresh tokens; both ≥ 32 chars.
6. The seed script (`prisma/seed.ts`) is 66KB — do not run in production; use `reset-to-production.ts` before go-live.
7. Prisma migrations are the only approved schema change path — never alter tables directly.

---

## Open Items / Future Discussions

> Add items here during sessions; resolve and move to relevant ADR/BL entry when decided.

- [ ] Multi-agency / multi-tenant architecture (currently single-tenant)
- [ ] Mobile app (React Native or PWA?)
- [ ] WhatsApp Business Cloud API rate limits under high volume
- [ ] Backup strategy for MinIO object storage in production
- [ ] Analytics query performance at scale (>10k leads)

---

## Vocabulary / Domain Glossary

| Term | Meaning |
|------|---------|
| Lead | A prospective buyer/renter who has shown interest |
| Deal | A Lead that has progressed to contract negotiation |
| Showing | A scheduled property visit linked to a Lead |
| Activity | Any interaction logged against a Lead/Client (call, message, note, stage change) |
| Source | The acquisition channel for a Lead (FB Ads, Telegram, WhatsApp, manual, etc.) |
| Pool | Unassigned leads waiting for round-robin distribution |
| SLA | Service Level Agreement — time limit for first contact after lead assignment |
| Commission | Realtor's fee on deal close (percentage or flat, tracked in `CommissionPlan`) |
| Funnel | The stage pipeline (Lead funnel = 7 stages; Deal funnel = 6 stages) |
| Omnichannel | Single inbox unifying WhatsApp, Telegram, Instagram, Email, Phone |
