# Admin Setup Guide

Step-by-step setup for the agency administrator. Read once after CRM is deployed to make it work for **your** team and **your** market.

## Order of operations

Do these in this order — each step depends on the previous one.

1. [Create users](#1-create-users)
2. [Configure sources](#2-configure-sources)
3. [Configure automation rules](#3-configure-automation-rules)
4. [Configure email templates](#4-configure-email-templates)
5. [Connect Telegram bot](#5-connect-telegram-bot)
6. [Verify backups](#6-verify-backups)
7. [Set the agency's defaults](#7-set-the-agencys-defaults)
8. [Train the team](#8-train-the-team)

---

## 1. Create users

`Settings → Users → Invite`

For each team member:

| Role | When to use |
|---|---|
| **ADMIN** | You. Full system access. Limit to 1–2 trusted people. |
| **MANAGER** | Sales lead / team head. Sees team workload, can reassign leads, runs reports. |
| **REALTOR** | Standard agent. Sees only own leads + the public pool. |
| **ASSISTANT** | Junior agent / support. Like REALTOR but can be linked to a manager via `managerId`. |
| **EMPLOYEE** | Office staff (back-office, accountant). Limited list view. |
| **ANALYST** | Read-only access to reports. |

**Tip**: send the invitation email; the user sets their own password via a one-time token (no need to share passwords).

### Set `managerId` to build a team tree

`Settings → Users → edit user → Manager`. This is how the **Manager workload dashboard** at `/team` groups people. Without it, every realtor appears flat.

### Toggle `isAvailable=false` for vacation

When a realtor is OFF: edit their profile → uncheck **Доступний**. Round-robin will skip them. Their leads stay assigned — manager should reassign manually if urgent.

---

## 2. Configure sources

`Settings → Sources` (or via admin API)

A "source" is where a lead came from. Default seed has:

- Facebook Lead Ads
- Instagram
- Telegram
- WhatsApp
- Сайт (website form)
- Рекомендація (referral)
- Вручну (manual entry)

**Edit names** to match your acquisition channels (e.g. "Google Ads — Listings", "Olx — premium", "Referral from notary partner").

Sources are used in **automation rule conditions** and **Source ROI report** — so name them precisely.

---

## 3. Configure automation rules

`Settings → Automation`. This is where you set how leads get auto-routed.

### Round-robin by source

Example: leads from Facebook go to a specific pool of agents.

| Field | Value |
|---|---|
| Name | `FB → premium realtor pool` |
| Condition: Source type | `FB_LEAD_ADS` |
| Action mode | `Round-robin` |
| Pool | (check 2–3 agents you want on this) |
| Priority | `100` |
| Active | ✓ |

### Route Italian leads to your Italian-speaking agent

| Field | Value |
|---|---|
| Name | `Italian rentals → Sofia` |
| Condition: Призначення | `Оренда` |
| Condition: Source type | (any) |
| Condition: Район contains | `Roma` (or `Milano`, etc.) |
| Action mode | `Fixed user` → Sofia |
| Priority | `200` (higher beats round-robin) |
| Active | ✓ |

### Welcome email on every new lead

| Field | Value |
|---|---|
| Name | `Welcome email → all` |
| Action mode | `Welcome email` |
| Email template | `Вітальний лист клієнту` |
| Priority | `50` |
| Active | ✓ |

### Follow-up after 3 days of silence

The system auto-creates `lead.followup` jobs at 3 and 7 days on every new lead (built-in). No rule needed — just confirm it's running:

- Check `Settings → Automation` for the default rules
- `docker compose logs api | grep followup` should show daily activity

### Priority math

Rules execute in **ascending priority order**. Lower priority = runs first. The first rule that matches takes the action. So:

- `priority: 50` welcome email runs first
- `priority: 100` round-robin runs second
- `priority: 200` Italian-specific override beats general round-robin

---

## 4. Configure email templates

`Settings → Templates`. Three seeded templates:

1. **Welcome letter** — sent automatically (rule above)
2. **Showing reminder** — auto-fires 1h before the showing if Telegram is connected
3. **Post-showing feedback** — your team manually sends from the client page

To customize:

- Click a template → edit content
- Variables available: `{{clientName}}`, `{{agentName}}`, `{{showingTime}}`, `{{address}}`
- Save → next email uses the new content

Keep tone consistent with your brand. The default Ukrainian templates are formal-friendly.

---

## 5. Connect Telegram bot

**Why**: incoming Telegram DMs land in `/inbox`. Outgoing notifications go to your realtors' personal Telegram (you connect their accounts later).

### Step 1: create the bot

```
1. Open Telegram, find @BotFather
2. /newbot
3. Pick a name: "Realtor CRM bot"
4. Pick a username: my_agency_crm_bot (must end with _bot)
5. Copy the token (looks like 7012345678:AAH...)
```

### Step 2: configure on the server

SSH into the server:

```bash
cd /home/crm/crm
nano .env
```

Set:

```
TELEGRAM_BOT_TOKEN=7012345678:AAH...your_real_token
TELEGRAM_WEBHOOK_SECRET=<run: openssl rand -hex 20>
```

Restart API:

```bash
docker compose -f docker-compose.prod.yml up -d api
```

### Step 3: register webhook

Log in as admin in the CRM, get your auth cookie (DevTools → Application → Cookies → `crm_auth`).

```bash
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Cookie: crm_auth=<paste>" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'
# → {"ok": true}
```

### Step 4: test

Send a message to your bot from any Telegram account. Within seconds, a new contact appears in `/inbox`. If not — check `docker compose logs api | grep Telegram`.

### Step 5: link realtor's Telegram for outgoing notifications

For each realtor:

1. They DM the bot `/start`
2. Bot replies with a unique link
3. They click and log in via the link
4. Their `telegramChatId` is saved
5. Going forward, notifications (new lead, SLA, follow-up) arrive in their Telegram

---

## 6. Verify backups

The deploy script schedules a nightly cron at 03:00 dumping the DB to `./backups/`.

**Once a week**:

```bash
ls -lh /home/crm/crm/backups/
# Should see: crm-YYYY-MM-DD_03-00-00.sql.gz (one per day, last 30 kept)
```

**Once a quarter** — do a test restore to verify the dumps are good:

```bash
# On a test VM or local machine:
gunzip -c crm-2026-05-15_03-00-00.sql.gz | psql -U crm -d crm_test
# Verify table counts match production
```

If a backup is corrupted (rare) — restore from the night before; data lost = up to 24h.

For RTO < 4h: set up off-site backup (rsync to AWS S3 or Backblaze B2).

---

## 7. Set the agency's defaults

These tweaks make the CRM feel "yours":

### Theme

`User menu → Theme`. 4 themes: light / dark / sepia / midnight. Set agency default in code: `apps/web/src/app/layout.tsx:36` — change `defaultTheme`.

### Locale

`User menu → Language`. 5 locales: uk / ru / en / fr / it. Set agency default: `.env` → `NEXT_PUBLIC_DEFAULT_LOCALE=fr` (then `docker compose restart web`).

### Currency

Default `UAH`. Per-property is overridable in the form. To change the default for **new** properties: `apps/api/prisma/schema.prisma:381` → `currency String @default("EUR")` → run migration.

### Stale-lead threshold

Currently 7 days of no activity. Change in `apps/api/src/modules/automation/scheduler.service.ts:8` → `const STALE_DAYS = 7;`

### SLA on new leads

Currently 15 min for first contact. Change in `apps/api/src/modules/automation/automation.service.ts:117` → `const dueAt = new Date(Date.now() + 15 * 60_000);`

### Working hours for round-robin

Not implemented out of the box. The system distributes 24/7 to whoever has `isAvailable: true`. If you want office-hours-only: add a cron that toggles `isAvailable` at 9:00 and 18:00 — or set `isAvailable=false` on weekends manually.

---

## 8. Train the team

Give each new realtor:

1. The `USER_GUIDE.md` (point them at the 20-section walkthrough)
2. 15-minute screen share covering:
   - Login + their assigned leads
   - The kanban: drag a card between stages
   - **Ctrl+K** palette — global search + nav
   - **Ctrl+Shift+N** — quick capture (the "night call" flow)
   - The `/today` daily dashboard
   - How to log a call (the disposition modal)
   - How to schedule a showing
   - The `/inbox` for omnichannel messages
3. Have them create one fake lead end-to-end while you watch

Manager training (additional 15 min):

- The `/team` workload dashboard
- How to reassign leads (single + bulk)
- How to merge duplicate contacts
- Reports: funnel, agent activity, lost-reason analysis

Repeat onboarding monthly with new hires.

---

## Admin operations cheat-sheet

| Task | Where |
|---|---|
| Add user | `Settings → Users → Invite` |
| Change someone's role | `Settings → Users → edit` |
| Reassign all of agent X's leads | `Pipeline → filter by agent → Select all → Bulk reassign` |
| Mark agent as on vacation | Their profile → uncheck `Доступний` |
| Add new lead source | `Settings → Sources → New` |
| Set up routing rule | `Settings → Automation → New rule` |
| Customize email template | `Settings → Templates → edit` |
| View audit log | `Settings → Audit log` |
| Re-run nightly backup manually | `./scripts/backup.sh` on server |
| Reset a user's password | `Settings → Users → edit → Reset password` (sends email) OR direct SQL |
| Permanently delete a contact | `Contacts → open → ⋯ → Delete` (admin only) |
| Move data to a new server | See `DEPLOYMENT_GUIDE.md` §11 migration |
| Find why a specific lead didn't auto-assign | `docker compose logs api | grep <leadId>` |
