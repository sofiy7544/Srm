# CRM Realtor — Changelog

## [Production Release] — 2026-05-15

### Highlights

This is the production-readiness release. Closes 13/15 Critical audit items, 4/10 High items, plus 30+ user-driven UX improvements gathered during live testing sessions.

**TypeScript:** 0 errors across monorepo (down from 16). **Build:** clean.
**Demo data:** 6 users · 55 clients · 23 properties · 49 leads · 700 activities · 89 tasks · 19 showings · 3 deals · 18 notifications.

### New features

#### Real-estate domain
- **`dealIntent` (BUY/RENT)** on Property/Lead/Deal — separate funnels, separate filters, separate analytics
- **Property real-time hold** — atomic `Property.status = RESERVED` transaction when a lead enters NEGOTIATION; auto-release on exit
- **Contact merge** — admin/manager can fuse duplicate contacts, all leads/deals/activities/tasks/showings/documents follow
- **Archive + blacklist** for clients — backend blocks new lead/showing creation on blacklisted; archive filter in list
- **`interestNote` + `interestPhotoUrl`** on Lead — capture external listings (OLX/DOM.RIA links) without creating CRM stub records
- **Post-showing feedback** — auto-task created 2 hours after SHOWING marked COMPLETED
- **WON re-engagement cron** — every WON deal triggers a FOLLOWUP task 6 months later (referral pipeline)

#### Lead distribution & SLA
- **Round-robin weighted** by active lead count, filters by `User.isAvailable` (vacation-aware)
- **SLA escalation chain** — first-contact CALL task at +15min; T+30 → notify manager; T+60 → auto-unassign + re-pool
- **Pool / claim flow** — `/pool` page lists unassigned leads with race-safe atomic claim
- **Lead dedup server-side** — blocks creating a 2nd active lead per client even in racing tabs

#### Communication
- **Telephony MVP** — `tel:` links + `CallDispositionDialog` (3 outcomes + follow-up presets) creates `Activity.CALL` + optional `Task.CALL`
- **Quick capture flow** (`Ctrl+Shift+N`) — unified modal creates contact + property + lead + interaction in one submit (the «night call» flow)
- **Quick-add dialogs** — inline `<QuickClientDialog>` + `<QuickPropertyDialog>` everywhere a picker exists; new entity auto-selected after creation (`flushSync` to prevent Radix Select race)
- **Phone-input with country dropdown** — autodetect by UI locale (UA/IT/FR/DE/ES/PL/GB/...); paste recognizes country code; stored in E.164

#### Team management
- **Manager workload dashboard** — `/team` shows active leads / OVERDUE / today / last activity per agent with load-bar (red at 20+)
- **`isAvailable` toggle** on user profile — round-robin skips users on vacation
- **Task assignment notification** — when admin/manager creates task for another user, in-app + Telegram notification fires

#### Automation
- **AutomationRule condition UI** — admin can finally configure routing rules (source type / dealIntent / district) via UI; engine reads all three
- **NotificationType enum** — TypeScript catches typos at compile-time (caught `'NEW_MESSAGE'` mismatch during audit)
- **`Lead.lastActivityAt`** auto-bumped via Prisma middleware on every Activity create
- **Stale-cron refactored** to use `lastActivityAt` (was `stageChangedAt` — caused false positives on active conversations)
- **`Lead.lostAt`** captured at LOST stage, cleared on reopen

#### UX
- **Global `Ctrl+K` palette** with live search across clients/leads/properties (debounced 250ms)
- **Bulk priority** on `/leads` kanban for managers
- **Stage palette unification** — single source `lib/stage-style.ts` consumed by 4 screens (today, leads, leads/[id], reports)
- **`Select` styling synced with `Input`** — every filter row now consistent (rounded-xl, surface bg, shadow-soft, focus-glow)
- **Date/time inputs split** — replaced sticky `<input type="datetime-local">` with separate date + time + quick-time chips on event-form, schedule-showing, quick-capture
- **`tel:` integration** — clicking phone on client/lead detail opens dialer + call disposition modal

#### Reports
- **`/insights/lost-reasons`** — dedicated dashboard with top reasons, BUY vs RENT split, by source, monthly trend
- **Drill-through** in `/reports` agent table — click any cell → filtered `/leads?assignee=...` or `/deals?agentId=...`

#### GDPR
- **`marketingConsent` + `consentTimestamp` + `consentVersion`** on Client
- **Consent toggle** in client detail right panel (collected when relevant, not on first capture)
- **Audit log** writes on consent flips for compliance trail

### Infrastructure & DevOps

- **`docker-compose.prod.yml`** — fixed truncated end, added volumes block, networks, optional `backup` profile
- **`.env.production.example`** — comprehensive template with descriptions for every variable
- **`scripts/deploy.sh`** — pre-flight → git pull → backup → build → migrate → rolling restart → health-check
- **`scripts/restore.sh`** — with confirmation prompt, idempotent re-migration after restore
- **Documentation**: `DEPLOYMENT_GUIDE.md`, `INSTALLATION_GUIDE.md`, `CLIENT_HANDOFF.md`, `ADMIN_SETUP_GUIDE.md`, `USER_GUIDE.md`, `PRESENTATION.md`, `QA_REPORT.md`
- **Demo seed expansion** — Italian/French/German/Spanish/Ukrainian clients with realistic funnel distribution

### Bug fixes

- Truncated `telegram.module.ts` → restored
- 49 trailing NUL bytes in `inbox/page.tsx` → stripped (SWC parse error)
- `api.ts` truncated mid-function → completed
- `leads/[id]/page.tsx` missing `export default` → wrote full LeadDetailPage component
- Radix Select race after quick-create → `flushSync` for synchronous state commit
- Server-component passing Lucide function to client `<EmptyState>` → `not-found.tsx` → `'use client'`
- Hydration mismatch from browser extensions (BIS, Honey, Grammarly) → `suppressHydrationWarning` on `<head>`, `<body>`, theme `<script>`
- `Command.Dialog` missing DialogTitle for a11y → visually-hidden title via `sr-only` class
- 16 TypeScript errors across web → all resolved (unused imports, type widening, enum index)
- Marketing landing on `/` blocked direct login → server redirect: authed → `/today`, unauth → `/login`
- Login flow 6.5s video wait → form available at first render, video keeps playing as ambient background
- Pre-existing `function Compass` Server → Client serialization error

### UI polish (final pass)

- Global Lucide stroke-width 1.75 (was inconsistent 1.75 + 2)
- Branded text selection color
- Skeleton shimmer animation (was flat pulse)
- Smooth `prefers-reduced-motion` respected
- Tabular numerals on all tables by default
- Card hover lift on `surface-hover` class
- Focus-visible rings tasteful (no fight with our `shadow-glow`)
- Link underline offset 2px (descender-safe)

### Database migrations

- `add_deal_intent` — added `dealIntent` to Property/Lead/Deal + indexes
- `lead_photo_and_client_archive` — `Lead.interestPhotoUrl`, `Client.isArchived`, `Client.isBlacklisted`
- `add_lead_interest_note` — `Lead.interestNote`
- `lead_activity_lost_user_gdpr` — `Lead.lastActivityAt`, `Lead.lostAt`, `User.isAvailable`, `Client.marketingConsent` + `consentTimestamp` + `consentVersion`

All migrations idempotent; safe to re-apply.

### Breaking changes

None. Schema additions are backward-compatible (all new fields nullable or with defaults).

---

## [Telegram Integration] — 2026-05-14

### What's new

Full bidirectional Telegram integration: incoming messages from clients create/match CRM records and appear in the Lead Workspace chat panel; agents reply from the CRM and the message is sent back through the bot.

### Architecture

```
Client → Telegram Bot → POST /api/telegram/webhook → TelegramService.processUpdate()
                                                            ↓
                                               findOrCreateClient (via ClientContact)
                                                            ↓
                                               Activity (type=TELEGRAM, direction=IN)
                                               Message  (channel=TELEGRAM, externalId)
                                                            ↓
                                               Auto-create Lead if new contact (stage=NEW)
                                                            ↓
                                               NotificationsService → push to assigned agent

Agent types reply in Lead Workspace (Telegram tab)
  → MessagesService.send() → TelegramService.sendMessage(chatId, text)
  → Telegram Bot API sendMessage → Client's Telegram
```

### New / changed files

**`apps/api/src/modules/telegram/telegram.service.ts`** — full rewrite
- `processUpdate(raw)` — handles incoming Telegram Updates
  - Deduplicates by `channel + externalId` (handles edited_message re-delivery)
  - Only processes `private` chat type
  - `findOrCreateClient(chatId, from?)` — looks up via `ClientContact` index `[channel, identifier]`; creates `Client + ClientContact` for unknown contacts (placeholder phone `tg_<chatId>`)
  - Creates `Activity` (type=TELEGRAM, direction=IN) + `Message` records
  - Auto-creates `Lead` (stage=NEW, source=TELEGRAM) for first-time contacts
  - Notifies assigned agent via `NotificationsService`
- `registerWebhook(webhookUrl)` — calls Telegram `setWebhook` API, attaches `secret_token`
- `getStatus()` — returns `botUsername`, `webhookUrl`, `pendingUpdateCount`, `lastError`
- Constructor now injects `PrismaService` and `NotificationsService`

**`apps/api/src/modules/telegram/telegram.controller.ts`** — new file
- `POST /api/telegram/webhook` — public endpoint; verifies `X-Telegram-Bot-Api-Secret-Token` header; fire-and-forgets `processUpdate`
- `POST /api/telegram/setup` — ADMIN only; registers webhook URL
- `GET /api/telegram/status` — ADMIN/MANAGER; returns bot status

**`apps/api/src/modules/telegram/telegram.module.ts`** — updated
- Imports `PrismaModule` and `NotificationsModule`
- Registers `TelegramController`

**`apps/web/src/app/(app)/leads/[id]/page.tsx`** — bug fix
- Direction check `=== 'OUTBOUND'` → `=== 'OUT'` (matches Prisma `ActivityDirection.OUT` enum value)
- Outbound (agent) messages now correctly render as right-aligned bubbles

**`.env.example`** — added `TELEGRAM_WEBHOOK_SECRET` with setup instructions

**`TELEGRAM_SETUP.md`** — new setup guide (Ukrainian): BotFather steps, webhook registration, ngrok local dev, FAQ

### Setup (3 steps)

1. Create bot via @BotFather → get token
2. Add `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET` to `.env`
3. After deploy: `POST /api/telegram/setup` `{ "webhookUrl": "https://your-domain.com" }`

See `TELEGRAM_SETUP.md` for full instructions.

---

## [UX Redesign — Lead-Centric Workspace] — 2026-05-14

### 🎯 Goal

Reduce the click-depth from 5 steps (Inbox → Contact → Pipeline → Lead card → Lead detail) down to **1–2 clicks**: open any lead and immediately have chat, activities, and all editable fields on a single screen — AmoCRM / Bitrix24-style.

### 🖥️ New 3-Panel Workspace (`/leads/[id]`)

- **Full rewrite** of `apps/web/src/app/(app)/leads/[id]/page.tsx` (619 lines)
- **LEFT panel** (224 px / 256 px xl) — searchable mini leads list
  - Live filter by client name or phone
  - Stage badge + source icon per row
  - Active lead highlighted with left accent border
  - "← Воронка" link back to Kanban
- **CENTER panel** (flex-1) — omnichannel chat + activities
  - 5-channel tab bar: Telegram / WhatsApp / Instagram / Email / Phone
  - Channel pre-selected based on lead source (`defaultChannel()`)
  - Bubble-style message timeline (inbound left, outbound right)
  - Lazy-load on channel switch; auto-scroll to bottom
  - Textarea composer: Enter sends, Shift+Enter inserts newline
  - Stale badge (amber, days counter) in client header when lead is inactive ≥ 7 days
  - "📋 Активності" tab — full `<ActivityTimeline>` without leaving the screen
- **RIGHT panel** (288 px / 320 px xl) — inline lead editing (zero extra navigation)
  - Clickable pipeline progress bar — click any segment to jump that stage
  - Stage `<Select>` dropdown with color dots
  - Priority toggle buttons: 🔥 Гарячий / ⭐ Теплий / ❄️ Холодний (reads `lead.priority` field first, source heuristic fallback)
  - Assignee `<Select>` (admin/manager only; read-only display for other roles)
  - Interest property card with link to `/properties/[id]`
  - Lost reason banner
  - Stale warning card
  - "Створити угоду" + "Призначити показ" action buttons
  - "Профіль клієнта →" ghost link

### 🔄 Inbox → Workspace Flow (`inbox/page.tsx`)

- After "Зробити лідом" qualification dialog: instead of staying in Inbox, now redirects to `/leads/[id]` workspace immediately
- `router.push('/leads/${lead.id}')` with success toast "Лід створено — відкриваємо workspace"

### 🔧 Supporting Fixes

- **`apps/api/src/modules/leads/leads.service.ts`** — `priority` field now saved on `update()` (was in Zod schema but missing from Prisma write)
- **`apps/web/src/lib/api.ts`** — `leads.update()` body type extended with `priority?: 'hot' | 'warm' | 'cold'` and `sourceId?: string | null`

---

## [Production-Ready Audit] — 2026-05-14

### 🏗️ Architecture & Infrastructure

- **Docker multi-stage builds** added for both `apps/api` and `apps/web`
  - API: deps → builder → runner (node:22-alpine), auto-runs `prisma migrate deploy` on start
  - Web: deps → builder → runner with Next.js standalone output
- **`docker-compose.prod.yml`** — full production stack: postgres, redis, minio, minio-init, api, web, nginx with healthchecks and internal bridge network
- **`nginx/nginx.conf`** — HTTP→HTTPS redirect, rate limiting zones (api: 30r/m, auth: 10r/m), upstream proxy, security headers, SSL config
- **`start.sh`** — waits for postgres readiness, runs migrations, optional `--see