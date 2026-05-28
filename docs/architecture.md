# Architecture Documentation
> **Realtor CRM** | Technical Architecture Reference
> Last updated: 2026-05-28 | Maintained automatically.

---

## 1. System Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTS                                   │
│         Browser (Next.js)    Mobile PWA    Webhooks (Meta/TG)   │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTPS
                 ┌─────▼──────┐
                 │   Nginx    │  Reverse proxy, SSL termination
                 └─────┬──────┘
          ┌────────────┴─────────────┐
          │                         │
   ┌──────▼──────┐          ┌───────▼──────┐
   │  Next.js 15 │          │  NestJS 10   │
   │  (web:3000) │          │  (api:3001)  │
   │  App Router │          │  REST API    │
   └─────────────┘          └──────┬───────┘
                                   │
              ┌────────────────────┼───────────────────────┐
              │                    │                       │
      ┌───────▼──────┐   ┌────────▼──────┐      ┌────────▼──────┐
      │ PostgreSQL 16 │   │   Redis 7     │      │  MinIO / S3   │
      │  (port 5432)  │   │  (port 6379)  │      │  (port 9000)  │
      │  Primary DB   │   │  Queue/Cache  │      │  File Storage │
      └───────────────┘   └───────────────┘      └───────────────┘
```

---

## 2. Monorepo Structure

```
crm-realtor/                       ← project root
├── apps/
│   ├── api/                       ← NestJS backend
│   │   ├── src/
│   │   │   ├── modules/           ← 25 feature modules
│   │   │   ├── common/            ← guards, interceptors, pipes, decorators
│   │   │   ├── config/            ← typed config (ConfigModule)
│   │   │   └── main.ts            ← bootstrap, global pipes, cors
│   │   ├── prisma/
│   │   │   ├── schema.prisma      ← 700-line schema (30+ models)
│   │   │   ├── migrations/        ← 18 applied migrations
│   │   │   └── seed.ts            ← 66KB demo seed (dev only)
│   │   └── test/                  ← e2e test setup
│   └── web/                       ← Next.js frontend
│       ├── src/
│       │   ├── app/               ← App Router routes
│       │   │   ├── (app)/         ← protected route group
│       │   │   └── login/         ← public auth page
│       │   ├── components/        ← 132 component files
│       │   ├── stores/            ← Zustand global state
│       │   ├── locales/           ← i18n JSON (ru, uk, en, fr, it)
│       │   ├── hooks/             ← React custom hooks
│       │   ├── lib/               ← API client, utils
│       │   └── middleware.ts      ← Auth + locale detection
│       └── public/                ← Static assets
└── packages/
    └── shared/                    ← Shared TypeScript + Zod
        └── src/
            ├── enums/             ← UserRole, LeadStage, etc.
            ├── schemas/           ← Zod validation schemas
            └── index.ts           ← Re-exports
```

---

## 3. Backend (NestJS API) Architecture

### 3.1 Module Map

| Module | Responsibility |
|--------|---------------|
| `auth` | JWT issue/refresh, login, logout, password reset, email verify |
| `users` | User CRUD, role assignment, availability toggle |
| `invitations` | Team invitation flow (email → accept → user creation) |
| `clients` | Client records, contacts, preferences, GDPR consent |
| `leads` | Lead lifecycle, stage transitions, deduplication, pool management |
| `deals` | Deal creation from lead, stage progression, close workflow |
| `properties` | Property CRUD, photo management, availability hold |
| `showings` | Showing scheduling, feedback capture, photo upload |
| `activities` | Immutable activity log per lead/client |
| `tasks` | Task assignment, SLA tracking, completion |
| `messages` | Omnichannel inbox (WhatsApp, Telegram, Instagram, Email, Phone) |
| `notifications` | In-app + Telegram push notifications |
| `automation` | Lead routing rules, assignment engine, SLA cron |
| `sources` | Lead source tracking, UTM/webhook origin |
| `documents` | Document storage, signature workflow |
| `email` | Email queue, template rendering, Resend/SMTP dispatch |
| `templates` | Reusable message/email templates with dynamic fields |
| `telegram` | Telegram bot integration, webhook ingestion |
| `webhooks` | Meta (FB/IG), Telegram, custom webhook receivers |
| `uploads` | File upload to MinIO/S3, pre-signed URL generation |
| `reports` | Analytics: lost reasons, team performance, funnel metrics |
| `queue` | BullMQ dashboard, job management |
| `audit` | AuditLog write on every mutation |
| `ai` | AI-powered features (lead scoring, message suggestions) |
| `health` | `GET /health` — liveness probe |

### 3.2 Request Lifecycle

```
HTTP Request
    │
    ▼
Global Rate Limiter (@nestjs/throttler)
    │
    ▼
JWT Auth Guard (Passport)
    │
    ▼
Role Guard (RBAC)
    │
    ▼
Validation Pipe (Zod / class-validator)
    │
    ▼
Controller → Service
    │         │
    │         ├── Prisma (DB)
    │         ├── BullMQ (async jobs)
    │         └── Redis (cache / pub-sub)
    │
    ▼
Response Interceptor (transform + audit log)
    │
    ▼
HTTP Response
```

### 3.3 Authentication Flow

```
POST /auth/login
    │
    ├── Argon2.verify(password, hash)
    ├── Issue JWT access token (15 min)
    ├── Issue JWT refresh token (7 days) → stored in RefreshToken table
    └── Set httpOnly cookie (refresh token)

POST /auth/refresh
    ├── Validate refresh token from cookie
    ├── Rotate refresh token (invalidate old)
    └── Issue new access token

POST /auth/logout
    └── Delete RefreshToken record → invalidates all sessions for device
```

### 3.4 Async Job Queues (BullMQ)

| Queue | Jobs |
|-------|------|
| `email` | Send transactional emails (invite, reset, verification) |
| `notifications` | Deliver in-app + Telegram push |
| `sla` | Delayed SLA breach check per lead assignment |
| `automation` | Lead routing evaluation after creation/update |
| `showings` | Post-showing feedback task creation (2h delay) |
| `deals` | WON re-engagement task (6-month delay) |
| `webhooks` | Process incoming FB/Telegram/custom webhook payloads |

---

## 4. Frontend (Next.js) Architecture

### 4.1 Route Structure

```
app/
├── (app)/                         ← Protected layout (requires auth)
│   ├── layout.tsx                 ← Auth check, sidebar, notification bell
│   ├── today/                     ← Dashboard: hot leads, today's tasks, showings
│   ├── clients/                   ← Client directory with CRM cards
│   ├── properties/                ← Property inventory (Buy / Rent tabs)
│   ├── leads/
│   │   ├── page.tsx               ← Kanban board (dnd-kit drag-drop)
│   │   └── [id]/                  ← Lead detail: timeline, right panel, quick actions
│   ├── deals/                     ← Deal tracker, commission management
│   ├── tasks/                     ← Task board + calendar
│   ├── team/                      ← Manager workload view
│   ├── insights/                  ← Analytics (lost reasons, team reports)
│   ├── settings/                  ← Profile, notifications, integrations
│   └── admin/                     ← User management, system settings (ADMIN only)
└── login/                         ← Public auth page
```

### 4.2 State Management

| Layer | Tool | Purpose |
|-------|------|---------|
| Server cache | TanStack React Query 5 | API data fetching, cache, background refetch |
| Global client state | Zustand 5 | Auth user, active filters, notification count |
| Form state | React Hook Form + Zod | Form validation, submit handling |
| URL state | Next.js `searchParams` | Filters, pagination, active tab |

### 4.3 Component Categories

```
components/
├── ui/              ← Radix UI primitives (Button, Input, Dialog, Select, etc.)
├── admin/           ← User mgmt, team invites, integration config panels
├── calendar/        ← Event calendar (lane layout for showing overlaps)
├── deals/           ← Deal creation wizard, commission preview
├── leads/           ← Kanban card, lead form, stage badge
└── shared/          ← Common layouts, page headers, empty states
```

### 4.4 Data Fetching Pattern

```typescript
// Standard pattern: React Query + API client
const { data, isLoading } = useQuery({
  queryKey: ['leads', filters],
  queryFn: () => api.leads.list(filters),
  staleTime: 30_000,  // 30s
})

// Mutations with optimistic updates
const mutation = useMutation({
  mutationFn: api.leads.updateStage,
  onMutate: async (vars) => {
    // optimistic update to query cache
  },
  onError: (err, vars, context) => {
    // rollback
  },
})
```

---

## 5. Database Architecture

### 5.1 Model Groups

**Identity & Auth**
- `User` — system user with role and availability
- `RefreshToken` — device-bound refresh tokens
- `PasswordResetToken`, `EmailVerificationToken` — time-limited one-use tokens
- `TeamInvitation` — pending invite records
- `EmailLog` — delivery audit trail

**CRM Core**
- `Client` — real person (1:N leads possible; 1 active lead per phone)
- `ClientContact` — additional contact channels (WhatsApp, Telegram, etc.)
- `ClientPreferences` — search criteria (rooms, area, price, district)
- `Source` — acquisition channel record
- `Property` — listing (buy or rent, status-tracked)
- `PropertyPhoto` — ordered gallery with cover flag

**Pipeline**
- `Lead` — central CRM entity; links Client ↔ Property ↔ User ↔ Source
- `Deal` — created from Lead at negotiation; tracks financial close

**Operations**
- `Activity` — immutable log entry (call, message, note, stage change, showing)
- `Task` — assigned action item with SLA due date
- `Notification` — in-app notification record
- `Showing` — property visit event with feedback
- `Payment` — commission/bonus payment record
- `CommissionPlan` — user-level commission configuration
- `Document` — attached files with signature status
- `AuditLog` — compliance log (actor, model, recordId, action, diff)

### 5.2 Key Indices (performance)

```sql
-- Lead lookup hot paths
@@index([assignedToId, stage])    -- realtor's pipeline
@@index([clientId])               -- client's lead history
@@index([sourceId, createdAt])    -- source performance reports
@@index([stage, createdAt])       -- funnel analytics

-- Property availability
@@index([status, dealIntent])     -- inventory filters

-- Activity timeline
@@index([leadId, createdAt])      -- lead timeline
@@index([clientId, createdAt])    -- client history
```

### 5.3 Prisma Schema Conventions

- All models have `id String @id @default(cuid())`
- All models have `createdAt DateTime @default(now())`
- Mutable models have `updatedAt DateTime @updatedAt`
- Soft delete: `deletedAt DateTime?` (where applicable)
- Relation names use camelCase (e.g., `assignedTo`, `createdBy`)
- Enums defined in `packages/shared` are mirrored in `schema.prisma`

---

## 6. Infrastructure

### 6.1 Docker Compose (Dev)

```yaml
services:
  postgres:   # postgres:16-alpine, port 5432, healthcheck
  redis:      # redis:7-alpine, port 6379, AOF persistence
  minio:      # minio:latest, ports 9000+9001
  minio-init: # one-shot bucket creation (public, private)
```

### 6.2 Production Topology

```
Internet → Nginx (SSL + rate limit) → Next.js (port 3000)
                                    → NestJS API (port 3001)
NestJS API → PostgreSQL (managed or self-hosted)
           → Redis (managed or self-hosted)
           → MinIO (self-hosted) | AWS S3
           → Resend API (email)
           → Telegram Bot API
```

### 6.3 Nginx Configuration

- SSL termination
- `proxy_pass` to Next.js for `/` and API for `/api/`
- `proxy_set_header X-Forwarded-For` (required: `TRUST_PROXY=1` in API)
- Rate limiting zones per IP

### 6.4 CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
on: [push to main, PR to main]

jobs:
  ci:
    services:
      postgres: postgres:16
    steps:
      - checkout
      - setup pnpm 11 + Node 22
      - pnpm install --frozen-lockfile
      - prisma generate
      - prisma migrate deploy
      - typecheck
      - lint
      - build
      - test
```

---

## 7. Security Architecture

| Layer | Control |
|-------|---------|
| Passwords | Argon2id (memory-hard, configurable cost via `ARGON2_*` env vars) |
| Authentication | JWT (HS256); access 15 min, refresh 7 days; httpOnly cookie |
| Authorization | NestJS Guards: `JwtAuthGuard` + `RolesGuard` on every protected route |
| Transport | HTTPS only in production (Nginx terminates TLS) |
| File storage | Pre-signed URLs for private bucket; public bucket for property photos only |
| Rate limiting | `@nestjs/throttler` — configurable per route |
| Audit | `AuditLog` table — every mutation logged with actor, IP, diff |
| GDPR | `marketingConsent` + `consentTimestamp` + `consentVersion` on `Client` |
| Input validation | Zod schemas via `nestjs-zod` pipe — all request bodies validated |
| SQL injection | Prisma parameterized queries — raw SQL prohibited without typed wrapper |
| XSS | Next.js RSC/CSR escaping; no `dangerouslySetInnerHTML` usage |

---

## 8. Performance Considerations

- **React Query** staleTime tuned per data type (leads: 30s, reports: 5min)
- **Prisma** select projections used — avoid `findMany` without field selection on large tables
- **BullMQ** for all non-critical async operations — keeps API response time <200ms
- **Redis** used for session cache and job queues — not used for primary data cache (DB indices handle that)
- **Prisma indices** — 18 compound indices on hot query paths
- **Next.js** — static generation for marketing pages; SSR for authenticated data; streaming for analytics

---

## 9. Scalability Path

| Concern | Current | Path to Scale |
|---------|---------|---------------|
| Database | Single PostgreSQL | Read replicas, then PgBouncer pooling |
| Queue | Single Redis | Redis Cluster for BullMQ |
| Files | Single MinIO | Horizontal MinIO or migrate to S3 |
| API | Single NestJS instance | Horizontal scaling (stateless JWT, Redis sessions) |
| Frontend | Single Next.js | Vercel or CDN-backed deployment |
| Multi-tenancy | Single-tenant | Schema-per-tenant or row-level security TBD |

---

## 10. ADR Index

| ID | Decision | Date |
|----|----------|------|
| ADR-001 | pnpm workspaces monorepo | Pre-launch |
| ADR-002 | NestJS over raw Express | Pre-launch |
| ADR-003 | Prisma ORM | Pre-launch |
| ADR-004 | Next.js 15 App Router | Pre-launch |
| ADR-005 | BullMQ for all async | Pre-launch |
| ADR-006 | MinIO default storage | Pre-launch |
| ADR-007 | Argon2id passwords | Pre-launch |
| ADR-008 | Zustand over Redux | Pre-launch |
| ADR-009 | Zod as DTO source of truth | Pre-launch |

> New ADRs are appended to `PROJECT_MEMORY.md` and referenced here.
