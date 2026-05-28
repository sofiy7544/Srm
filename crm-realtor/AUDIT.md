# AUDIT — CRM Realtor Full Merge Report

**Date:** 14 May 2026
**Scope:** Full project diff-audit + merge + targeted code-quality and UX improvements on top of accumulated Sprint 1 / 1.2 / 2.1 work.

---

## 1. Merge audit

### Findings

The uploaded `crm-realtor-full-package` contains the **original baseline** of the project plus two reference markdown documents (`crm-architecture-analysis.md` and `crm-developer-prompt.md`). It does **not** contain custom modifications beyond what was already in the original repository.

The accumulated working tree at `/home/claude/final/` (carried over from prior sessions) is a strict superset of the uploaded baseline:

- baseline = original code
- final = baseline + Sprint 1 (foundation) + Sprint 1.2 (stage migration + confirm dialog) + Sprint 2.1 (real QuickCreate) + AuditModule

### Conflicts

**None.** No two sources modify the same line in incompatible ways. The merge is trivially `final/` as the chosen winner.

### Files removed during merge

Already pruned from the working tree in earlier sessions:
- `apps/web/src/app/(app)/dashboard/` → replaced by `/today` with a Next.js redirect from `/dashboard`
- `apps/web/src/app/(app)/leads/pro/` — mock duplicate
- `apps/web/src/app/(app)/calendar/pro/` — mock duplicate
- `apps/web/src/components/kanban-pro/` — mock-only components
- `apps/web/src/components/calendar-pro/` — mock-only components
- All `tsconfig.tsbuildinfo` files (stale incremental caches caused silent empty builds)

### Files added during merge

- `apps/api/src/modules/audit/` (audit.module.ts, audit.service.ts) — from the audit-enabled fork
- Audit hooks in `auth.service.ts` (login events) and `deals.service.ts`

---

## 2. Code-quality improvements added this pass

### New components

| Path | Purpose |
|---|---|
| `apps/web/src/components/ui/skeleton.tsx` | `<Skeleton>` + `<PageSkeleton>` with `detail` / `list` / `kanban` / `form` variants. Standardizes loading states. |
| `apps/web/src/components/ui/empty-state.tsx` | `<EmptyState icon title description action variant>` — single source of truth for "no data" panels. |
| `apps/web/src/app/error.tsx` | Root-level Next.js App Router error boundary. Inline-styled, dependency-free (renders even if theme provider crashed). |
| `apps/web/src/app/(app)/error.tsx` | (app)-segment error boundary. Keeps sidebar/topbar visible. Logs digest to console for debugging. |
| `apps/web/src/app/(app)/not-found.tsx` | Graceful 404 inside (app). |

### Modified files

| Path | Change |
|---|---|
| 8× page.tsx (deals, leads, leads/[id], clients/[id], clients/[id]/edit, properties/[id], properties/[id]/edit, deals/[id], profile, reports) | Replaced `<p className="animate-pulse">{tCommon('loading')}</p>` with `<PageSkeleton variant="…" />` |
| `apps/web/src/components/mobile-drawer.tsx` | Updated nav from old 9-item list (`/dashboard`, `/leads`, `/clients`, `/deals`, …) to new 7-item canonical list (`/today`, `/inbox`, `/pipeline`, `/contacts`, `/inventory`, `/calendar`, `/insights`) + Settings. Was the last place referencing legacy routes. |
| `apps/web/src/messages/{en,ru,uk}.json` | Added `errors.*` namespace (somethingBroke, weLoggedIt, retry, goHome, notFound.title, notFound.description). |

---

## 3. CRM logic audit

Spot-check against the audit checklist in your prompt:

| Area | Status | Notes |
|---|---|---|
| **Pipeline** | ✅ | 7-value enum (NEW → CONTACTED → QUALIFIED → SHOWING → NEGOTIATION → WON, plus LOST as drag-target). Migration `20260514_reduce_lead_stages_to_six` rewrites activity-log JSON metadata. |
| **Client cards** | ⚠️ | Functional but **not** Pipedrive-style split-pane yet. Single-column scrolling layout. Listed as the biggest remaining UX win (Sprint 2.2). |
| **Stages** | ✅ | Consistent across leads kanban, deals kanban, reports funnel, today/pulse. |
| **Notifications** | ✅ | Sonner toasts wired via `<Toaster />` in providers. Undo actions on stage drag. Notification bell in topbar is functional. |
| **Tasks** | ✅ | `/tasks` page exists; today/page surfaces top tasks via `/api/reports/today-tasks`. |
| **Roles** | ✅ | ADMIN / MANAGER / EMPLOYEE / REALTOR / ASSISTANT / ANALYST. Enforced server-side in NestJS guards + client-side `useAuthStore` checks. |
| **Auth** | ✅ | JWT + refresh + cookie. AuditService logs login events with IP + user-agent + first-login flag. |
| **Mobile responsiveness** | ⚠️ | Sidebar collapses to bottom-nav at md breakpoint. Tables (admin, reports) wrapped in `overflow-x-auto` — work, but not card-view ideal. Detail pages scroll OK. |
| **Forms UX** | ✅ | ClientForm / LeadForm / PropertyForm / ShowingForm all support `onSuccess`/`submitLabel`/`bare` props for reuse inside QuickCreate slide-overs. |
| **Loading states** | ✅ | All cheap `<p>Loading…</p>` now use `<PageSkeleton>`. |
| **Error handling** | ✅ | App Router `error.tsx` + `not-found.tsx` added. Sonner `toast.error()` everywhere `alert()` used to be. |

---

## 4. UI/UX assessment

**What feels HubSpot-y already:**
- Command Palette (⌘K) with grouped sections + keyboard shortcuts visible inline
- Sonner toasts with Undo on optimistic updates
- Slide-overs for create flows (Pipedrive pattern)
- Hotkeys help dialog
- Focus Strip on Today screen (actionable counters with tone-coded icons)

**What still looks generic vs. HubSpot/Pipedrive:**

1. **Card detail pages are single-column.** Pipedrive's killer UX is 3-pane (stage stepper left, timeline center, context right). The current `/leads/[id]` and `/clients/[id]` cram everything vertically. — *Sprint 2.2, estimated 5-7 days*

2. **Spacing inconsistency.** Some cards use `p-4`, others `p-5`, others `p-6`. Should standardize via design tokens. — *0.5 day*

3. **Tables on mobile.** `/admin` and `/reports` need responsive card-view. — *1-2 days each*

4. **Hover micro-interactions.** Linear's "this small thing animates when you touch it" polish — Linear uses framer-motion + spring physics. Adding it everywhere is a separate ~2-day project.

5. **Empty states inconsistent.** Some pages use ad-hoc empty divs (`/clients` has a custom one). The new `<EmptyState>` primitive is the path forward but not yet adopted everywhere. — *0.5 day to migrate all sites*

6. **Sidebar branding.** Hardcoded "MaybSrm Premium" — should be replaced with the actual product name + logo.

---

## 5. Mobile assessment

| Surface | Mobile-friendly? | Notes |
|---|---|---|
| Sidebar | ✅ | Hidden below md, replaced by bottom MobileNav (5 items) + MobileDrawer (full nav). Bottom nav uses `env(safe-area-inset-bottom)` for notch handling. |
| Today page | ⚠️ | Focus Strip is 4-col on desktop, 2-col on mobile (works). "Next 2h" and "Hot Inbox" cards stack vertically below lg. |
| Kanban | ⚠️ | `@dnd-kit` works on touch with `PointerSensor`. But 6 columns side-by-side don't fit on mobile — need horizontal scroll or column-picker. Currently you get horizontal scroll. |
| Tables | ❌ | `/admin` and `/reports` have `<table>` wrapped in `overflow-x-auto`. Functional, but ugly. Card-view rewrite outstanding. |
| Forms | ✅ | All forms are vertical and adapt naturally. SlideOver is `w-[92vw]` on mobile. |
| Command Palette | ✅ | Works on mobile but ⌘K hard to invoke without a keyboard. Should add a topbar search button on mobile that opens it. — *0.25 day* |
| Hotkeys | ⚠️ | Useless on mobile. Should hide the hotkey hints in the palette on touch devices. — *0.25 day* |

---

## 6. Build / Docker / Env

| Item | Status |
|---|---|
| Docker compose | ✅ | postgres + redis + minio + minio-init. No changes needed. |
| `.env.example` | ✅ | All necessary vars present. APP_NAME / EMAIL_FROM_NAME = "MaybSrm" |
| Prisma migrations | ✅ | 10 migrations in order, latest is `20260514_reduce_lead_stages_to_six`. |
| `@crm/shared` build | ✅ | Now compiles to `dist/` (start-local scripts wipe stale tsbuildinfo before each build to prevent silent empty output). |
| API `dev` script | ⚠️ | Still bash-syntax `& sleep 3 && node --watch & wait`. Works on macOS/Linux. **On Windows, start-local.bat launches tsc and node in separate windows** — recommend updating `apps/api/package.json` to use `concurrently` in a follow-up. |
| TypeScript imports | ✅ | All 59 `@/...` imports resolve. Zero TS2307. |
| Browser dialogs (alert/confirm/prompt) | ✅ | Zero remaining in production code. All replaced with Sonner toasts and Radix dialogs. |
| Stale stage references | ✅ | Only present in backward-compat comments and `today/page.tsx`'s `stageDotClass` (intentional — handles historical activity-log entries that pre-date the migration). |

---

## 7. Potential issues

1. **`apps/api/package.json` `dev` script** is bash-only. macOS/Linux users are fine. Windows users **must** use `start-local.bat` which works around it. Long-term fix: install `concurrently` and rewrite as `"dev": "concurrently \"tsc -p tsconfig.json --watch\" \"sleep 3 && node --watch dist/main.js\""`.

2. **No tests beyond the seed.** Some `*.spec.ts` files exist in modules but no `vitest` / `jest` config visible at root. Coverage zero. Production-blocking for a CRM at scale.

3. **`pnpm-lock.yaml` not regenerated**. The first `pnpm install` after extraction will update it (and may pick newer minor versions than locked).

4. **`engines.node: ">=22"`** in root `package.json`. You're running Node 24, which works. CI might pin to 22.

5. **Engine warnings for pnpm 11**. Your `pnpm 11.0.9` shows an update notice to `11.1.1` — harmless.

6. **TypeScript `strict` flag**. Not verified to be on in `tsconfig.base.json` — strict-mode tightening + targeted `any` purge would help. ~1 day.

7. **Hardcoded English/Russian strings**. A few component files contain Russian comments and labels that aren't going through i18n (e.g. PRIORITY_BADGE in leads/[id] page has Russian labels in code). Should be migrated to i18n keys.

8. **MinIO bucket policy.** `crm-private` bucket created on boot but ACL/CORS not configured. Direct browser uploads from `/api/uploads/image` should work via presigned URLs; verify that on first photo upload.

---

## 8. What to improve next (priority-ordered)

1. **Lead detail split-pane** (5-7 days, highest UX impact). 3-column layout: stage stepper + quick actions left, timeline center, contact/properties right.
2. **`<EntityCombobox>` for server-side autocomplete** (2-3 days). Replace the `<Select>` lists in lead/showing forms — currently fetches first 100 records.
3. **Mobile card-view for tables** (1-2 days). admin + reports.
4. **Adopt `<EmptyState>` everywhere** (0.5 day).
5. **`concurrently` for api dev** (0.25 day).
6. **CommandPalette mobile entry point in topbar** (0.25 day).
7. **Properties map view** (Phase 4 of dev-prompt, ~3 days).
8. **Unified Inbox** (Phase 2, big — 2-3 weeks).
9. **AI layer** (Phase 3 — daily briefing, smart reply, lead scoring).

---

## Files changed in this pass

### New
- `apps/web/src/components/ui/skeleton.tsx`
- `apps/web/src/components/ui/empty-state.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/(app)/error.tsx`
- `apps/web/src/app/(app)/not-found.tsx`

### Modified
- `apps/web/src/components/mobile-drawer.tsx` (nav items)
- `apps/web/src/app/(app)/deals/page.tsx` (loading)
- `apps/web/src/app/(app)/leads/page.tsx` (loading)
- `apps/web/src/app/(app)/leads/[id]/page.tsx` (loading)
- `apps/web/src/app/(app)/clients/[id]/page.tsx` (loading)
- `apps/web/src/app/(app)/clients/[id]/edit/page.tsx` (loading)
- `apps/web/src/app/(app)/properties/[id]/page.tsx` (loading)
- `apps/web/src/app/(app)/properties/[id]/edit/page.tsx` (loading)
- `apps/web/src/app/(app)/deals/[id]/page.tsx` (loading)
- `apps/web/src/app/(app)/profile/page.tsx` (loading)
- `apps/web/src/app/(app)/reports/page.tsx` (loading)
- `apps/web/src/messages/en.json` (errors.*)
- `apps/web/src/messages/ru.json` (errors.*)
- `apps/web/src/messages/uk.json` (errors.*)

### Deleted (in earlier sessions, included for completeness)
- `apps/web/src/app/(app)/dashboard/`
- `apps/web/src/app/(app)/leads/pro/`
- `apps/web/src/app/(app)/calendar/pro/`
- `apps/web/src/components/kanban-pro/`
- `apps/web/src/components/calendar-pro/`
- All `tsconfig.tsbuildinfo`

---

## How to boot

| OS | Command |
|---|---|
| macOS / Linux | `./start-local.sh` |
| Windows | `start-local.bat` |

Scripts find free ports automatically, sync env, repair half-migrated DB state, build `@crm/shared` (with anti-stale-incremental safeguards), apply migrations, seed demo users, launch both servers, wait for `/api/health`, open browser.

**Default URLs:** Web `http://localhost:3000`, API `http://localhost:3001/api`.
**Login:** `admin@crm.local` / `admin12345`.
