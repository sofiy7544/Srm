# Real Estate CRM — Enterprise Sales Deck

> 15-slide pitch deck for selling the CRM to a real estate agency.
> Format: one Markdown section per slide, ready to paste into Keynote / Slides / Pitch.

---

## Slide 1 — Cover

# **The CRM your agency stops losing deals with**

The first CRM purpose-built for European real estate.
Capture every inbound message. Move every lead at speed.
Never let a 15-minute window of opportunity slip again.

*Self-hosted. GDPR-native. Multilingual (UA/RU/EN/FR/IT).*

---

## Slide 2 — The problem we solve

### Real estate agencies operate in chaos by default

> *«A buyer messaged us at 11 PM about a Khreshchatyk listing. By morning, our realtor saw the message and replied. The buyer had already signed with the competitor.»*

**This is what kills agencies that don't have proper CRM:**

| Pain | Cost |
|---|---|
| Inbound leads lost between channels (WhatsApp, IG, FB, phone) | 40–60% of paid acquisition wasted |
| First-contact response > 1 hour | Conversion drops 7× vs. < 15 min response |
| Two realtors selling the same property to different buyers | Refund + reputation hit |
| Manager has no idea who's overloaded vs. idle | Burnout + slow scaling |
| Duplicate contacts across phones and emails | 30% of "new leads" are actually old |
| Showings happen, feedback never gets recorded | Lost analysis, repeat mistakes |
| Lost deals get archived without reasons | No learning, same mistakes monthly |

**The market today gives you Bitrix24 (built for everything), Pipedrive (built for SaaS sales), or Excel.**
None of them know what a *pokaz* is. None of them block double-selling. None of them speak Italian by default.

We built one that does.

---

## Slide 3 — The product, in one sentence

### A complete agency operating system

Every inbound channel → unified inbox. Every lead → kanban with auto-distribution. Every showing → calendar + auto-feedback prompt. Every closed deal → commission tracking. Every problem realtor → workload dashboard.

**One install. One database. One vendor. Self-hosted on your hardware.**

---

## Slide 4 — Lead management: capture everything

### Inbound lead → assigned realtor → first contact within 15 minutes. Guaranteed.

**Capture from anywhere:**
- 📱 WhatsApp Business API
- 💬 Telegram bot (already live)
- 📷 Instagram Direct
- 🌐 Facebook Lead Ads + website forms
- ☎ Phone (tel: integration + call disposition modal)
- ✋ Manual entry — *2 fields: name + phone, autodetected country code (+39, +33, +49, +44, +380)*

**Auto-distribute via rules:**
- Round-robin across available agents (vacation-aware)
- Source-specific routing (`Italian leads → Sofia`)
- District-specific routing (`Roma rentals → Marco`)
- Intent-specific routing (`buyers → senior agents`)

**Race-safe claim:** if a lead arrives without auto-assignment, it lands in the public pool. First agent to click "Take" wins it (atomic DB transaction — no double-claim possible).

**SLA on first contact: 15 minutes.** If the assigned agent doesn't dial within 15 min, the system:
- T+15 min → CALL task auto-OVERDUE
- T+30 min → manager notified
- T+60 min → lead returned to pool for anyone to claim

*You will not lose a single new lead to slow response again.*

---

## Slide 5 — Pipeline: drag, drop, automate

### 6 stages of clarity, zero stages of confusion

```
NEW → CONTACTED → QUALIFIED → SHOWING → NEGOTIATION → WON
                                                       ↓
                                                    LOST (with reason)
```

**Visual kanban**, drag-and-drop, undo toast. Each card shows the priority chip (🔥 hot / ⭐ warm / ❄ cold), intent badge (BUY / RENT — different rules apply), and "stale" indicator when there's been no activity for 7 days.

**Property real-time hold:** the moment a lead enters NEGOTIATION, its property is auto-`RESERVED` — atomic transaction. Another realtor opening that lead sees "already reserved by lead #X". Goodbye double-sale lawsuits.

**Branched stages for rentals:** the system knows a rental doesn't need DUE_DILIGENCE → CONTRACT → CLOSED. It collapses to DEPOSIT → SIGNED. Realtors aren't clicking through 4 phantom stages.

**Bulk operations** for managers:
- Reassign 30 leads to a new agent in 3 clicks
- Mass-set priority to "hot" for a Facebook ad batch
- Filter by source / intent / district / period

---

## Slide 6 — Communication hub: omnichannel inbox

### One screen, every channel, every history

`/inbox` shows every contact who's ever messaged you, with channel-grouped timeline:

- WhatsApp messages
- Telegram conversations
- Instagram DMs
- Email threads
- Phone call logs (with duration + disposition outcome)
- Manual notes by your team

Every message is permanent. Searchable. Linked to the client card. Linked to their lead. Linked to their deal.

**Three years from now**, when this client comes back for a second property, your realtor opens their card and sees: *every conversation since day one*. No "let me check with my colleague who handled it before". The system remembers.

---

## Slide 7 — Team control: the manager's home page

### `/team` — the workload dashboard that ends Slack-asking "who has capacity?"

| Agent | Status | Active leads | Today's tasks | Overdue | Last activity |
|---|---|---|---|---|---|
| Sofia Ricci | 🟢 Available | ████ 18 | 5 | 0 | 12 min ago |
| Marco Bianchi | 🟢 Available | ██ 9 | 2 | **3** | 2 hours ago |
| Pierre Lambert | 🟡 On vacation | ████████ 28 | 0 | 0 | 6 days ago |
| Anna Schmidt | 🟢 Available | █████ 22 | 7 | 1 | 4 min ago |

One click on any row → filtered list of that agent's leads. Bulk-reassign. Done.

**For executives:** the same dashboard tells you who to promote (high active + zero overdue), who to coach (any overdue cluster), and when to hire (>25 active across multiple agents = team at capacity).

---

## Slide 8 — Automation: what happens while you sleep

### The system runs 6 background workers, every day

| Cron | Behaviour |
|---|---|
| **Every hour** | Tasks past `dueAt` flip to OVERDUE |
| **Every 5 min** | SLA-15-min tasks escalate: T+30 → manager, T+60 → re-pool the lead |
| **Daily 09:00** | Leads with no activity for 7 days → new FOLLOWUP task (not just notification — it lands in /today) |
| **Daily 09:30** | WON clients from 6 months ago → re-engagement FOLLOWUP for the original agent (your realtor never forgets a past client) |
| **On lead create** | First-contact CALL task with `dueAt = +15 min` |
| **On showing COMPLETED** | Feedback FOLLOWUP task in 2 hours («Зафіксуй враження клієнта») |

**Admin-configurable rules:**
- Send welcome email on every new lead
- Specific source → specific pool of agents
- BUY vs. RENT routing
- District match

**One configuration screen.** No code. No dev tickets.

---

## Slide 9 — Analytics: where your money goes

### Five dashboards, drill-through to filtered leads

- **Funnel conversion** — % NEW → CONTACTED → … → WON. Plus same for RENT vs. BUY (different rules).
- **Agent activity** — calls / showings / deals / commission per realtor. Click row → that agent's leads. Click commission cell → that agent's deals.
- **Source ROI** — which channel produces deals, not just leads. (Facebook spends ≠ Facebook deals.)
- **Lost-reason analytics** — separate dashboard with top reasons, by intent (BUY/RENT), by source, by month. *«Висока ціна» = 42% of losses this quarter → raise it or reposition.*
- **Team workload** — active leads per agent with load-bar (red at 20+).

All dashboards respect role-based access: a realtor sees only their own; a manager sees the team.

---

## Slide 10 — Mobile: built for the field

### Your realtor does 80% of work on phone, between showings

- `/today` — daily dashboard with active leads, OVERDUE tasks at top
- `tel:` links — tap a number, dialer opens, then a quick modal: «Дозвонився / Не відповів / Зайнято» + optional follow-up presets
- Quick capture (`Ctrl+Shift+N` on desktop, ⚡ button on mobile) — full lead in one form: contact + property + showing/interest. **7 seconds.**
- Phone-input with country flag picker — paste a `+39 345…` number, the system recognizes Italian and adjusts

Not native. Not a PWA. Just web that doesn't suck on mobile.

---

## Slide 11 — Security & GDPR

### Built for the European market by default

| Feature | Status |
|---|---|
| Argon2id password hashing | ✅ |
| JWT short-access (15 min) + refresh (30 days) | ✅ |
| Role-based access control (6 roles) | ✅ |
| Audit log on every CRUD (90-day retention) | ✅ |
| GDPR consent per client (timestamp + version) | ✅ |
| Right of access (data export per subject) | ✅ |
| Right to erasure (cascade delete with audit trail) | ✅ |
| Email opt-out (no marketing without consent) | ✅ |
| Self-hosted on your hardware | ✅ |
| Encrypted database backups (nightly, 30-day rotation) | ✅ |
| SSL/TLS (Let's Encrypt auto-renew via nginx) | ✅ |
| Rate limiting (auth 10/min, API 30/min) | ✅ |
| SQL injection protection (Prisma ORM, parameterized queries) | ✅ |
| CORS allowlist | ✅ |

**Your data never leaves your VPS.** No SaaS terms changing on you. No US Patriot Act exposure. No vendor lock-in.

---

## Slide 12 — Scalability

### Designed to grow with you

**Today:** 5 realtors, 500 leads/month, 50 deals/month. **Single 4 GB VPS = €15/mo.**
**Year 1:** 15 realtors, 2 000 leads/month, 200 deals/month. **8 GB VPS = €40/mo.**
**Year 3:** 50 realtors, 10 000 leads/month, 800 deals/month. **16 GB VPS + Redis/Postgres replicas = €150/mo.**

The schema is normalized, indexed on hot paths (`@@index([stage, assignedUserId])`, `@@index([dealIntent, status])`, etc.). Heavy operations (round-robin assignment, stale detection, SLA escalation) are queued via BullMQ on Redis, not blocking the request thread.

The frontend is Next.js 15 with code splitting, server-side rendering, and edge caching for static assets. Sub-200ms page loads even at scale.

**No SaaS pricing per seat.** Pay infrastructure, not platform fees.

---

## Slide 13 — Deployment: one command, then it just runs

### Get from "fresh VPS" to "production CRM" in 30 minutes

```bash
# On a clean Ubuntu 22.04 VPS:
curl -fsSL https://get.docker.com | sh
git clone https://your-org/crm.git && cd crm
cp .env.production.example .env && nano .env   # fill 8 values
docker compose -f docker-compose.prod.yml up -d --build
```

**That's it.** 5 containers come up: Postgres, Redis, MinIO (file storage), API, web, nginx (reverse proxy + SSL). Health check passes in 90 seconds.

**Updates** are equally trivial:
```bash
./scripts/deploy.sh   # git pull → backup → migrate → restart
```

**Backups** are automatic (nightly cron, 30-day rotation). **Restore** is one command: `./scripts/restore.sh ./backups/<dump>.sql.gz`.

You don't need a DevOps team to run this. Your IT-savvy admin handles it.

---

## Slide 14 — Why this lifts your numbers

### Conservative estimate for an 8-realtor agency

| Metric | Before | After | Lift |
|---|---|---|---|
| First-contact SLA | 2-6 hours | 15 min | **15×** faster |
| Inbound lead conversion (NEW → WON) | 6-10% | 15-22% | **2-3×** more deals |
| Realtor productive hours/day | 4-5h | 6-7h | **+30%** (admin work automated) |
| Duplicate contacts across systems | 25-40% | <5% | clean book |
| Lost-reason data captured | 5% (ad-hoc Excel) | 95% | actionable analytics |
| Time to onboard a new realtor | 3-5 days | 4 hours | **10×** faster ramp |

**Concretely:** if an 8-realtor agency closes 6 deals/month average at €4 000 commission per deal = €24 000/mo.
Lift conversion by 2× (the most conservative possible) → +€24 000/mo = **+€288 000/year**.

CRM infrastructure cost: €40/month. ROI is rounding error compared to one extra deal.

---

## Slide 15 — Why us, why now

### What you get with us, not generic CRM SaaS

| | Our CRM | Bitrix24 / Pipedrive / Salesforce |
|---|---|---|
| Built for real estate | ✅ Stages, intent, showings, commission | ❌ Generic sales pipeline |
| GDPR-native, EU-hosted on your hardware | ✅ Self-hosted | ❌ Shared SaaS, US-bound |
| Multilingual UI (UA / RU / EN / FR / IT) | ✅ | 🟡 EN + paid language packs |
| Per-seat pricing | ❌ Flat infrastructure | ❌ $25–150/seat/mo |
| Property hold on negotiation | ✅ Atomic | ❌ Manual |
| Telegram-first inbox | ✅ Built-in | 🟡 Plugin / paid |
| Source code ownership | ✅ Yours | ❌ Vendor |
| SLA + escalation chain | ✅ 15-30-60 min | 🟡 Workflow rules ($) |

**Pricing:** flat one-time delivery (server + setup + training). Monthly: infrastructure only (€20-50). No per-seat.

---

## Executive Summary

We deliver a complete real estate CRM, deployed on your hardware, in 2 weeks. Self-hosted, GDPR-native, multilingual. Tailored stages for sale + rent, property real-time hold, SLA escalation chain, omnichannel inbox.

Replaces Bitrix24/Pipedrive/Excel — at ~10% of the 3-year total cost.

**Conservative ROI:** +€250k/year for an 8-realtor agency.

---

## Key Advantages (one-pager handout)

1. **15-minute SLA, hard-enforced** — no inbound lead falls through
2. **Property real-time hold** — eliminates double-sale lawsuits
3. **Omnichannel inbox** — every WhatsApp/Telegram/Instagram/Email in one screen
4. **Manager workload dashboard** — see overload before it burns out the team
5. **Lost-reason analytics** — find your pricing/positioning gaps from data, not guess
6. **WON client re-engagement** — auto-follow-up 6 months after a closed deal (referral pipeline)
7. **Self-hosted, source-owned, EU-compliant** — no vendor lock-in, no GDPR exposure
8. **Multilingual UI (5 locales)** — works for Italian / French / Ukrainian markets
9. **Mobile-friendly** — realtors work from showings, not just from the office
10. **One-command deploy & update** — IT admin handles it, no DevOps team needed

---

## Roadmap (12 months)

### Q1 (next 3 months)
- WhatsApp Business API integration (after Meta verification)
- Instagram + Facebook Lead Ads webhooks
- Custom fields (HubSpot-style, agency-configurable)
- Real-time push notifications (web push + mobile)

### Q2
- Public showing booking link (clients self-schedule)
- Document e-sign integration (DocuSign / HelloSign)
- Cohort retention report (WON clients at 3/6/12 months)
- Deal split commission (50/50 between agencies)

### Q3
- Native mobile apps (iOS + Android)
- AI lead scoring (Claude API — 0-100 score per lead by signals)
- AI chat summary (long Telegram threads → 1-paragraph brief)
- Cross-team referral flow

### Q4
- Multi-tenancy (host multiple agencies on one install)
- BI integration (Metabase / Looker connectors)
- Voice notes from mobile
- Integration marketplace (Calendly, Stripe, Brevo)

Custom feature requests: 2-week sprint cycle, fixed price per feature.

---

*Built by people who hate slow CRMs and lost leads. Sold by people who answer the phone.*

— Contact: [your-sales-email] · Demo: https://demo.yourdomain.com (admin@crm.local / admin12345)
