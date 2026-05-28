# CRM Realtor — Refactor (Sprints 1, 1.2, 2.1 applied)

This is the original `crm-realtor` codebase with three sprints of refactoring
applied per the architectural plan in **crm-architecture-analysis.pdf** and
**crm-developer-prompt.pdf**.

The original `README.md` describes the base project setup. This file documents
everything that changed.

---

## What changed

### Sprint 1 — Foundation

| Area                | Before                              | After                                            |
|---------------------|-------------------------------------|--------------------------------------------------|
| Sidebar             | 9 items                             | **7 items** + Settings (Today / Inbox / Pipeline / Contacts / Inventory / Calendar / Insights) |
| Mobile nav          | full menu                           | **5-item bottom nav** (Today / Inbox / Pipeline / Calendar / More) |
| Main screen         | `/dashboard` (KPI cards)            | **`/today`** — Focus Strip + Now/Next-2h + Hot Inbox + Today's Tasks + Pipeline Pulse + Stale |
| Global navigation   | clicking through menu               | **⌘K command palette** + `G+T/I/P/C` go-to + `⌘N/L/O/S` quick-create + `Shift+?` help |
| Modals / dialogs    | `window.prompt`/`confirm`/`alert`   | `<SlideOver>`, `<Dialog>`, `<LostReasonDialog>`, `<ConfirmDialog>` (Radix primitives) |
| Toasts              | none                                | **Sonner** with Undo actions on destructive ops |

### Sprint 1.2 — Stage migration + confirm hygiene

| Area                  | Before                                              | After                       |
|-----------------------|-----------------------------------------------------|-----------------------------|
| LeadStage enum (DB)   | 9 values                                            | **7 values** (NEW / CONTACTED / QUALIFIED / SHOWING / NEGOTIATION / WON / LOST) |
| `window.confirm()`    | 9 call sites                                        | all migrated to `<ConfirmDialog>` + `useConfirm()` hook |
| `window.alert()`      | 3 call sites                                        | migrated to `toast.error()` |
| Lead drag-to-LOST     | `prompt()` for reason                               | `<LostReasonDialog>` with 6 typed reasons + free-text "Other" |
| Activity log metadata | references old stage names                          | rewritten by migration `20260514_reduce_lead_stages_to_six` |

Mapping applied in the migration:
- `FIRST_CONTACT` + `DIALOG` → `CONTACTED`
- `SELECTION` → `QUALIFIED`
- `NEGOTIATION` + `DEAL` → `NEGOTIATION`
- `CLOSED_WON` → `WON`
- `CLOSED_LOST` → `LOST`

### Sprint 2.1 — Real QuickCreate

| Area                  | Before                                              | After                       |
|-----------------------|-----------------------------------------------------|-----------------------------|
| `⌘N/L/O/S` shortcuts  | placeholder "coming soon"                           | **real forms in slide-over** that actually create records |
| `<LeadForm>`          | embedded inline in `/leads/new/page.tsx` (135 LoC)  | **extracted reusable component** — `/leads/new` is now a 14-line shell |
| `<ShowingForm>`       | did not exist                                       | new focused form for QuickCreate |
| `<ClientForm>` /<br>`<PropertyForm>` | hardcoded redirect on save           | new `onSuccess` / `submitLabel` props so they can render anywhere |

### Removed (per dev-prompt §17)

- `apps/web/src/app/(app)/dashboard/page.tsx` — replaced by `/today`. The old URL `/dashboard` 308-redirects via `next.config.mjs`.
- `apps/web/src/app/(app)/leads/pro/` — mock kanban duplicate
- `apps/web/src/app/(app)/calendar/pro/` — mock calendar duplicate
- `apps/web/src/components/kanban-pro/` — mock-only components
- `apps/web/src/components/calendar-pro/` — mock-only components

### Transitional URL aliases

Sprint 1.2 reduces the enum and Sprint 1.2 was supposed to physically rename
the route folders, but to keep this archive low-risk it ships **aliases**
instead:

| Canonical URL (sidebar links here) | Aliased to (server-redirect)         |
|------------------------------------|--------------------------------------|
| `/pipeline`                        | `/leads`                             |
| `/contacts`                        | `/clients`                           |
| `/inventory`                       | `/properties`                        |
| `/insights`                        | `/reports`                           |

A future Sprint 1.3 will move the physical folders. Sidebar/palette/hotkeys
already point at canonical URLs today.

---

## How to boot

Requirements: Node 20+, pnpm 8+, Docker (for Postgres + Redis + MinIO).

```bash
# 1. Install deps
pnpm install

# 2. Boot infra
docker compose up -d  # postgres, redis, minio

# 3. Set env
cp .env.example .env  # adjust if needed (DATABASE_URL etc.)

# 4. Run database migrations
pnpm --filter @crm/api prisma migrate deploy

# 5. (Optional) Seed
pnpm --filter @crm/api prisma db seed

# 6. Start dev servers
pnpm --filter @crm/api dev    # NestJS on :4000
pnpm --filter @crm/web dev    # Next.js on :3000

# Sanity
pnpm --filter @crm/web typecheck
pnpm --filter @crm/api typecheck
```

---

## Verification checklist after boot

- [ ] Open `http://localhost:3000` → lands on `/today` (NOT `/dashboard`).
- [ ] `/dashboard` URL 308-redirects to `/today`.
- [ ] Sidebar shows 7 items: Today / Inbox / Pipeline / Contacts / Inventory / Calendar / Insights.
- [ ] Press `⌘K` → Command Palette opens. Type "lead" → "New lead" suggestion.
- [ ] Press `Shift+?` → Hotkeys help dialog lists all shortcuts.
- [ ] Press `⌘N` → Slide-over opens with the full ClientForm.
- [ ] Press `⌘L` → Slide-over opens with LeadForm.
- [ ] Press `⌘S` → Slide-over opens with ShowingForm.
- [ ] Press `G` then `T` → navigates to `/today`.
- [ ] Open Pipeline. Kanban shows 6 columns (NEW / CONTACTED / QUALIFIED / SHOWING / NEGOTIATION / WON) and a slim LOST drop-zone underneath.
- [ ] Drag a card to a different column → optimistic move + Sonner toast with **Undo**.
- [ ] Drag a card to LOST drop-zone → `<LostReasonDialog>` opens with 6 typed reasons + "Other" free-text.
- [ ] Open any contact's detail → click "Delete" → Radix dialog (NOT browser `confirm()`).
- [ ] On Today: Focus Strip shows actionable counters. Stale section is empty until you have 7+ days inactivity on an open lead.

---

## What's not in this archive (deliberately)

These are next-sprint deliverables documented in the dev-prompt PDF:

- **Sprint 1.3** — physical folder rename `(app)/leads → (app)/pipeline` etc. Currently aliased.
- **Sprint 2.2** — Lead/Client detail split-pane (the major UX overhaul from §6).
- **Sprint 2.3** — server-side autocomplete (`<EntityCombobox>` + `GET /api/search`). Forms currently load first 100 records into a `<Select>`.
- **Phase 2** — Unified Inbox (Conversation model, WhatsApp Cloud API, IG Business Messaging, WebSocket real-time, 3-column UI). Currently `/inbox` shows a Phase-2 stub.
- **Phase 3** — AI layer (Daily Briefing, Smart Reply, Lead Scoring, Property Matching). The `aiBriefingComing` placeholder on `/today` is intentional.
- **Phase 4-8** — Properties Map view, Telephony (Twilio), Calendar 2.0 (drag-reschedule + route view + public booking), Insights 2.0, Mobile PWA.

---

## i18n

All 3 supported locales (`en`, `ru`, `uk`) have been **deep-merged** with the
new keys. The standalone `_sprint*_additions.*.json` files were consumed and
removed.

New top-level namespaces added:
- `nav.today / .inbox / .pipeline / .contacts / .inventory / .insights / .more`
- `today.*` (focus strip + section titles + empty states)
- `palette.*` (command palette labels)
- `hotkeysHelp.*` (shortcut help dialog)
- `quickCreate.*` (slide-over titles + toast labels)
- `lostReason.*` (drag-to-LOST dialog reasons)
- `showings.*` (showing form labels)
- `leads.stages.{NEW,CONTACTED,QUALIFIED,SHOWING,NEGOTIATION,WON,LOST}` (updated)

The old `leads.stages.{FIRST_CONTACT,DIALOG,SELECTION,DEAL,CLOSED_WON,CLOSED_LOST}`
keys are retained so historical activity-log entries still render. Remove them
in a future cleanup once metrics confirm zero traffic.

---

## File-by-file map of changes

```
apps/api/
├── prisma/
│   ├── schema.prisma                                    MODIFIED  — LeadStage enum 9→7
│   └── migrations/
│       └── 20260514_reduce_lead_stages_to_six/
│           └── migration.sql                            NEW       — DB collapse + activity-log rewrite
└── src/modules/
    ├── leads/leads.service.ts                           MODIFIED  — CLOSED_LOST → LOST
    ├── deals/deals.service.ts                           MODIFIED  — DEAL → NEGOTIATION, CLOSED_* → WON/LOST
    ├── reports/reports.service.ts                       MODIFIED  — terminal-stage filter
    └── automation/
        ├── automation.service.ts                        MODIFIED  — terminal-stage skip
        └── scheduler.service.ts                         MODIFIED  — stale-lead filter

apps/web/
├── package.json                                         MODIFIED  — +cmdk, sonner, framer-motion, react-hotkeys-hook
├── next.config.mjs                                      MODIFIED  — /dashboard → /today redirect
└── src/
    ├── app/(app)/
    │   ├── layout.tsx                                   MODIFIED  — mounts HotkeysProvider/CommandPalette/QuickCreate/HotkeysHelpDialog/ConfirmDialogHost
    │   ├── today/page.tsx                               NEW       — main screen replacement
    │   ├── inbox/page.tsx                               NEW       — Phase-2 stub
    │   ├── pipeline/page.tsx + [id]/page.tsx            NEW       — alias → /leads
    │   ├── contacts/page.tsx + [id]/page.tsx            NEW       — alias → /clients
    │   ├── inventory/page.tsx + [id]/page.tsx           NEW       — alias → /properties
    │   ├── insights/page.tsx                            NEW       — alias → /reports
    │   ├── dashboard/                                   DELETED   — replaced by /today
    │   ├── leads/page.tsx                               MODIFIED  — new STAGES (6+LOST), prompt→dialog, Sonner+Undo
    │   ├── leads/[id]/page.tsx                          MODIFIED  — new STAGES, prompt→dialog, confirm→useConfirm
    │   ├── leads/pro/                                   DELETED   — mock dup
    │   ├── leads/new/page.tsx                           MODIFIED  — thin shell using <LeadForm>
    │   ├── deals/[id]/page.tsx                          MODIFIED  — 2× confirm→useConfirm
    │   ├── deals/new/page.tsx                           MODIFIED  — terminal-stage filter
    │   ├── reports/page.tsx                             MODIFIED  — new stage names
    │   ├── settings/automation/page.tsx                 MODIFIED  — confirm→useConfirm
    │   ├── settings/templates/page.tsx                  MODIFIED  — confirm→useConfirm
    │   ├── admin/page.tsx                               MODIFIED  — confirm→useConfirm
    │   ├── clients/[id]/page.tsx                        MODIFIED  — confirm→useConfirm, alert→toast
    │   ├── properties/[id]/page.tsx                     MODIFIED  — confirm→useConfirm
    │   └── calendar/pro/                                DELETED   — mock dup
    ├── components/
    │   ├── sidebar.tsx                                  REPLACED  — 7 items
    │   ├── mobile-nav.tsx                               REPLACED  — 5 items
    │   ├── topbar.tsx                                   REPLACED  — new TITLE_KEY
    │   ├── providers.tsx                                MODIFIED  — mounts Toaster
    │   ├── command-palette.tsx                          NEW
    │   ├── hotkeys-provider.tsx                         NEW
    │   ├── hotkeys-help-dialog.tsx                      NEW
    │   ├── lost-reason-dialog.tsx                       NEW
    │   ├── quick-create.tsx                             NEW
    │   ├── lead-form.tsx                                NEW
    │   ├── showing-form.tsx                             NEW
    │   ├── client-form.tsx                              MODIFIED  — onSuccess / submitLabel props
    │   ├── property-form.tsx                            MODIFIED  — onSuccess / submitLabel props
    │   ├── deals/deals-board.tsx                        MODIFIED  — new STAGES, prompt→dialog
    │   ├── calendar/event-form.tsx                      MODIFIED  — confirm→useConfirm, alert→toast
    │   ├── admin/reset-password-dialog.tsx              MODIFIED  — alert→toast
    │   ├── kanban-pro/                                  DELETED
    │   ├── calendar-pro/                                DELETED
    │   └── ui/
    │       ├── slide-over.tsx                           NEW
    │       ├── dialog.tsx                               NEW
    │       ├── confirm-dialog.tsx                       NEW
    │       └── sonner-toaster.tsx                       NEW
    ├── stores/ui-store.ts                               NEW       — zustand store for overlays
    └── messages/
        ├── en.json                                      MODIFIED  — merged sprint 1/1.2/2.1 additions
        ├── ru.json                                      MODIFIED  — merged sprint 1/1.2/2.1 additions
        └── uk.json                                      MODIFIED  — merged sprint 1/1.2/2.1 additions

packages/
└── shared/src/enums.ts                                  MODIFIED  — LeadStage 7-value const + STAGES_ORDERED + TERMINAL_STAGES
```

---

## Known caveats

1. **The migration is forward-only.** Rolling back would mean splitting `CONTACTED` rows ambiguously between `FIRST_CONTACT` and `DIALOG`. Take a `pg_dump` before production deploy.
2. **`pnpm-lock.yaml` was not regenerated.** Run `pnpm install` after extraction; the lockfile will update.
3. **QuickCreate's `<Select>` lists are capped at 100 records.** Sprint 2.3 ships an autocomplete-backed `<EntityCombobox>`. With <100 clients/properties you won't notice.
4. **Hotkeys hijack browser defaults** (`⌘N` new window, `⌘S` save page, etc.). This is the Linear/Notion/Raycast convention. If you'd rather not steal them, switch to `⌘⇧N`/`⌘⇧L`/etc. in `apps/web/src/components/hotkeys-provider.tsx`.
