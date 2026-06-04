# Real-Estate CRM — Product Specification

**Author:** Principal PM / UX Architect / CRM System Designer
**Status:** Design proposal for review (NO implementation in this document)
**Scope:** Rethink the CRM logic around a realtor's daily work on a **mobile phone**. Ground every recommendation in the current codebase and call out where the code already does the right thing vs. where it diverges.
**Benchmarks:** Follow Up Boss, HubSpot CRM, Salesforce, Pipedrive, kvCORE, LionDesk, Zoho CRM.

> **One-line thesis:** The database already treats the **Client (Person)** as the center of the system, but the UI was built around **Lead** and **Property** as separate destinations. Re-center the entire product on the **Client**, make one **Universal Client Card** the single place all work happens, and make the same actions available from everywhere. Everything else (Lead, Deal, Showing) becomes a *state on the person*, not a separate place to remember.

---

## 0. TL;DR for reviewers

- **Center of the system = the Client (Person).** Not Lead, not Deal, not Property. The schema already enforces this (`Activity.clientId` is required; `leadId` is nullable). The UI does not. This is the root cause of the "illogical" feeling.
- **A Lead is not a person.** A Lead is **one opportunity/pipeline-run for a person** (`Lead.clientId` is required, one Client → many Leads). The UI currently presents Lead as if it were the person, then presents Client as a *second, weaker* version of the same person.
- **The fix is architectural, not cosmetic:** collapse `/leads/[id]` and `/clients/[id]` into **one Universal Client Card**; merge duplicate destinations (`/contacts`≈`/clients`, `/inventory`≈`/properties`, `/insights`≈`/reports`, `/pipeline`/`/leads`/`/pool` overlap); guarantee a **fixed Quick-Action bar** (Call / WhatsApp / Note / Task / Schedule) on every person, from every entry point.
- **Mobile-first:** primary actions live in a **thumb-reachable bottom action bar on the Client Card** and a **global FAB** for "create anything"; the bottom tab bar is for *navigation between work modes*, never for record actions.

---

## 1. Core entities — what is the system actually about?

### 1.1 The entities that exist today (from `apps/api/prisma/schema.prisma`)

| Entity | What it really is | Key relations (actual) |
|---|---|---|
| **Client** | **The person.** Buyer / Seller / Both (`ClientType`). | owns `contacts[]`, `preferences`, `leads[]`, `deals[]`, `activities[]`, `tasks[]`, `showings[]`, `documents[]`, `listedProperties[]` |
| **ClientContact** | A reachable channel for the person (phone/telegram/whatsapp/email/instagram + identifier, `isPrimary`). | belongs to Client |
| **ClientPreferences** | The buyer's search brief (type, intent, districts, rooms, price, area). | 1:1 with Client |
| **Lead** | **One opportunity / pipeline-run** for a person. Stage `NEW→…→WON/LOST`, `purpose/urgency/budget`, `nextActionAt`. | `clientId` **required**; `interestProperty?`, `source?`, `assignedUser?`, `deal?` (1:1), `activities[]`, `tasks[]` |
| **Deal** | A **closing** — a Lead that converted on a specific property. | `leadId` **unique** (1:1), `clientId`, `propertyId`, `agentId`, money + `stage`/`status` |
| **Property** | A listing in the catalog. | `sellerClient?` (PropertySeller), `photos[]`, `showings[]`, `deals[]`, `leads[]` (interest) |
| **Showing** | A viewing event. | links **Property + Client + Agent** directly (note: *not* through Lead) |
| **Activity** | The timeline event (call/note/email/system…). | `clientId` **required**, `leadId` **optional** |
| **Task** | A to-do with a due date. | `userId` required; `clientId?` and `leadId?` both optional |
| **Message** | Channel message (messaging now disabled behind `INTEGRATIONS_ENABLED`). | — |
| Supporting | `Source`, `User`, `Document`, `Payment`, `CommissionPlan`, `Notification`, `AutomationRule`, `AuditLog`, `ContractTemplate` | — |

### 1.2 Which entity is the CENTER — and why

**The Client (Person) is the center.** Three independent arguments:

1. **The data model already says so.** `Activity.clientId` is **non-nullable** and `Activity.leadId` is **nullable** (`schema.prisma`). Every call, note, and email is hung on the *person*, and only *optionally* on a lead. The entire history of interaction is natively client-scoped. The Client model is the only entity with a direct relation to *all* work objects (`activities`, `tasks`, `showings`, `deals`, `leads`, `documents`, `preferences`, `contacts`). **The backend is already client-centric; the UI is not.** → *Code already does the right thing.*
2. **The agent's mental model.** A realtor does not think "I will open Lead #4821." They think "I'm calling **Olena**." The person is the stable, memorable object; leads and deals come and go *under* that person. (This is exactly the brief's CORE PRINCIPLE.)
3. **The benchmarks agree.** Follow Up Boss, HubSpot, kvCORE, LionDesk are all **contact-centric**: the contact record is the hub; pipeline stage, deals, and appointments are *facets* of the contact. Pipedrive is deal-centric (it sells to sales teams with discrete deals), but even Pipedrive attaches activities to a Person. For a *real-estate agent* who nurtures the same person across years and multiple transactions, **contact-centric wins.**

**Therefore:** Lead = *"this person's current pipeline opportunity."* Deal = *"this person's transaction in progress."* Property = a **separate catalog** that *connects to* people via interest, showings, and deals. The Client Card is the home base; Lead/Deal/Showing are **states and sub-records shown on it**.

> **Divergence to fix:** Today the app has both a strong **Lead card** (`/leads/[id]`) and a separate, weaker **Client card** (`/clients/[id]`) for the *same human being*. That is the central contradiction (see §4).

---

## 2. Current-state audit (grounded in the code)

### 2.1 Routes that exist (`apps/web/src/app/(app)/*/page.tsx`)
`today`, `pool`, `qualify` (→ redirects to `/pool`), `inbox` (→ redirects to `/pool`), `leads` + `leads/[id]`, `clients` + `clients/[id]`, `contacts`, `deals`, `pipeline`, `inventory`, `properties` + `properties/[id]`, `calendar`, `insights`, `reports`, `tasks`, `team`, `insights`, `settings`, `profile`, `admin`.

### 2.2 Navigation surfaces
- **Desktop sidebar** (`sidebar.tsx`): `today · pool · pipeline · contacts · inventory · calendar · insights` (7).
- **Mobile bottom nav** (`mobile-nav.tsx`): `today · pool · pipeline · calendar` (4).
- **Mobile drawer** (`mobile-drawer.tsx`): the 7 + `settings`.
- **Quick-create** components exist: `quick-create.tsx`, `quick-client-dialog.tsx`, `quick-property-dialog.tsx`, `quick-capture-dialog.tsx`, plus `command-palette.tsx` (desktop ⌘K).

### 2.3 What the two person-cards actually offer today

| Capability | Lead card `/leads/[id]` | Client card `/clients/[id]` |
|---|---|---|
| Activity timeline | ✅ (`ActivityTimeline source="lead"`) | ✅ (client-scoped) |
| Notes (text + voice) | ✅ `NotesPanel` | ✅ `NotesPanel` |
| Log Call (disposition) | ✅ `CallDispositionDialog` | ✅ `ClientActions` (call mode) |
| Add Note | ✅ | ✅ |
| WhatsApp / Telegram / Email | (gated, was chat tabs) | (gated `ClientActions`) |
| **Pipeline stage** (NEW…WON/LOST) | ✅ inline stage control | ❌ **absent** |
| **Priority** (hot/warm/cold) | ✅ | ❌ **absent** |
| **Assignee** | ✅ | ✅ (assign) |
| **Purpose / urgency / budget** | ✅ (lead fields) | ❌ **absent** |
| **Contacts (multi-channel)** | partial (phone only) | ✅ `ClientContactsCard` + channel badges |
| **Preferences (search brief)** | ❌ | ✅ |
| Schedule showing | ✅ (`schedule-showing-dialog`) | partial |
| Deals on this person | ❌ | partial |
| Edit person data | partial | ✅ |

**Observation:** Neither card is complete. The agent must **remember** that *stage/priority/budget live on the Lead* but *contacts/preferences/edit live on the Client* — for the **same person**. This is the "illogical UX" the brief describes, and it is verifiable in the two page files.

### 2.4 Where the code already does the right thing (keep these)
- **Client-centric timeline** (`Activity.clientId` required). ✅
- **Lead correctly belongs to a Client** (`Lead.clientId` required; 1 Client → many Leads). ✅
- **Deal correctly links Lead + Client + Property** (1:1 with Lead). ✅
- **Manual call logging & notes** (incl. voice) are first-class and not coupled to any integration. ✅
- **Source/origin is metadata, not an action** (`source-badge`, `Source` enum) — preserved correctly. ✅
- **Messaging is cleanly behind a flag** (`INTEGRATIONS_ENABLED` / `NEXT_PUBLIC_INTEGRATIONS_ENABLED`) — no dead send buttons. ✅
- **`client-form` already redirects to `/clients/<id>`** after create (not to a chat). ✅

---

## 3. Ideal user journey (stage by stage)

The agent's funnel maps to existing `LeadStage` (`NEW · CONTACTED · QUALIFIED · SHOWING · NEGOTIATION · WON · LOST`) plus `Deal.stage` after conversion. For each stage: **what the agent sees / actions available / data that matters.**

### Stage 1 — New request arrives (`NEW`)
- **Sees:** the person at the top of the **Pool** (`/pool`, unassigned) or in **Today**; a single line: name, source badge, intent, "X min ago," and a **Claim/Assign** button.
- **Actions:** *Claim*, *Call*, *WhatsApp*, *Add note*, *Create task ("call back")*. The very first tap should be **Call** or **Claim**.
- **Data that matters:** source, phone, the raw inquiry note, *time since arrival* (speed-to-lead is the #1 metric — Follow Up Boss's core promise).

### Stage 2 — First contact (`NEW → CONTACTED`)
- **Sees:** the **Universal Client Card** opened directly from the pool row.
- **Actions:** *Call* (→ auto-prompt **Log Call** disposition on return), *WhatsApp*, *Add note*, *Set next action / task*, *Move stage → CONTACTED* (or automatic on first logged call).
- **Data:** outcome of the call, next-action date (`Lead.nextActionAt`), preferred channel.

### Stage 3 — Qualification (`CONTACTED → QUALIFIED`)
- **Sees:** the card's **Brief block** (Preferences + Lead purpose/urgency/budget) front-and-center.
- **Actions:** *Edit preferences* (type, districts, rooms, price, area), *Set budget/urgency/purpose*, *Move → QUALIFIED*, *Create follow-up task*.
- **Data:** `ClientPreferences` + `Lead.purpose/urgency/budgetMin/Max`. This is the bridge to matching.

### Stage 4 — Property selection / matching (`QUALIFIED`)
- **Sees:** **Matches** — properties from the catalog that fit the brief (the app already has a matching endpoint, `properties.matchForProperty`/client matching). A shortlist attached to the person.
- **Actions:** *Add property to shortlist*, *Send/share property* (manual link share while integrations are off), *Schedule showing*, *Add note*.
- **Data:** shortlisted `Property[]`, fit score, `interestPropertyId`.

### Stage 5 — Showing (`SHOWING`)
- **Sees:** upcoming **Showing** card (date, property, address) on the person and in **Calendar/Today**.
- **Actions:** *Confirm/Reschedule*, *Navigate (maps)*, *Call*, *Log feedback* (`Showing.feedback`), *Move → SHOWING/NEGOTIATION*.
- **Data:** `Showing.scheduledAt/status/feedback`, the property.

### Stage 6 — Negotiation (`NEGOTIATION`)
- **Sees:** the offer/price thread as notes + the property + the (single) **Deal** forming.
- **Actions:** *Create Deal* (amount, commission), *Log call/note*, *Create task*, *Attach document*.
- **Data:** offer amount, `Deal.amount/commissionPercent`, `PropertyPriceHistory`.

### Stage 7 — Deal / Close (`WON` + `Deal.stage OFFER→…→CLOSED_WON`)
- **Sees:** the **Deal block** on the person: stage, amount, commission, documents, payments.
- **Actions:** *Advance deal stage*, *Add document/contract*, *Record payment*, *Mark WON*.
- **Data:** `Deal`, `Payment`, `Document`, `commissionAmount`.

### Stage 8 — Repeat business / nurture (post-WON, or `LOST`)
- **Sees:** the person remains in **Contacts** with full history; past deals visible; a *nurture* reminder.
- **Actions:** *Create new Lead on the same person* (second opportunity), *Set nurture task*, *Archive/Blacklist* if needed.
- **Data:** the **whole client history** — which is exactly why the timeline must be client-scoped, not lead-scoped.

> **Why this matters for architecture:** stages 1–6 are *Lead*, 7 is *Deal*, all of them are *the same Person*. If the timeline and actions live on the Lead, then at stage 8 (new lead) the agent loses the previous history's continuity in the UI. Client-scoping fixes this for free.

---

## 4. Logical contradictions (problem → consequence → solution)

> The brief asks for **all** contradictions where a function exists in one place but not another, context is lost, navigation is redundant, or predictability breaks. Each is grounded in the current code.

**C1 — Two cards for one person (the core bug).**
- *Problem:* `/leads/[id]` and `/clients/[id]` are different screens for the same human, with different capabilities (stage/priority/budget only on Lead; contacts/preferences/edit only on Client — see §2.3).
- *Consequence:* the agent must remember where each function lives; half the actions are one navigation away; the "person" is split in two.
- *Solution:* **One Universal Client Card** (§6). Open from anywhere → same card. The "lead" is a **block + stage selector** on that card, not a separate page.

**C2 — Client vs Contacts: duplicate destinations.**
- *Problem:* nav points to `/contacts`, the list lives at `/clients`, cards are `/clients/[id]`; `contacts/page.tsx` also exists.
- *Consequence:* two mental names for one entity; unpredictable URLs; the user "loses context" switching between them.
- *Solution:* **One destination = People.** Pick a single route (`/people`, alias `/clients`), retire `/contacts` as a duplicate (redirect).

**C3 — Inventory vs Properties: duplicate destinations.**
- *Problem:* nav → `/inventory`; both `/inventory` and `/properties` (+ `/properties/[id]`) exist.
- *Consequence:* same duplication problem as C2 for listings.
- *Solution:* one **Properties** section; `/inventory` redirects to `/properties`.

**C4 — Insights vs Reports: duplicate analytics.**
- *Problem:* both `/insights` and `/reports` exist; nav shows `insights`.
- *Consequence:* unclear where a number lives.
- *Solution:* one **Insights** destination; `/reports` redirects/merges.

**C5 — Pool vs Leads vs Pipeline vs Deals: a 4-way fragmented funnel.**
- *Problem:* `/pool` (unassigned), `/leads` (list), `/pipeline` (kanban), `/deals` (won pipeline) are four separate places for one funnel.
- *Consequence:* the agent navigates redundantly to "see my pipeline"; no single source of truth for "where is everyone."
- *Solution:* a single **Pipeline** work-mode with views/segments: *Unassigned (Pool) · My Active · By Stage (kanban) · Deals*. One screen, switchable lens. (Keep Pool as a *filter/tab*, not a separate top-level place.)

**C6 — Lead-scoped vs client-scoped timeline.**
- *Problem:* the lead card renders `ActivityTimeline source="lead"`; the client card renders the client timeline. Same underlying `Activity` rows (clientId required, leadId optional) shown two ways.
- *Consequence:* the agent sees a *partial* history on the lead card and a *different* history on the client card; context is lost across a person's multiple leads.
- *Solution:* **always render the client-scoped timeline**, with an optional per-lead filter chip. One history, filterable.

**C7 — Action asymmetry / unpredictability.**
- *Problem:* *Change stage* exists only on Lead; *Edit person / preferences* only on Client; *Schedule showing* is on Lead and Property but not consistently on Client; *Create Deal* path is unclear from the person.
- *Consequence:* the predictability principle breaks — the same person offers different buttons depending on which door you came through.
- *Solution:* a **fixed Quick-Action set** (§5) present on every person card, plus contextual actions that *appear when relevant* (e.g., "Advance deal" only when a deal exists) but always in the same place.

**C8 — Showing is client+property in data, but scheduled from lead/property in UI.**
- *Problem:* `Showing` links Property+Client+Agent (no leadId), yet the schedule action lives on the lead card and property page.
- *Consequence:* scheduling a viewing from the *person* is awkward; feedback isn't surfaced on the person's timeline prominently.
- *Solution:* Schedule Showing is a **Quick Action on the Client Card** (pick property → time); the showing appears on the person's timeline, Calendar, and Today.

**C9 — "Create contact" vs "create lead" ambiguity.**
- *Problem:* a person can exist as a Client with zero leads, or be created via a lead flow; the brief notes a Lead is auto-created with `clientId`.
- *Consequence:* agents are unsure whether they're making a "contact" or a "lead"; two creation mental models.
- *Solution:* **Always create a Person first** (one "Add" flow). Adding a Person *optionally* starts a Lead (intent/budget). "Lead" becomes "this person has an active opportunity," never a separate object the user creates by hand.

**C10 — Dead/!legacy concepts still in the IA.**
- *Problem:* `/inbox` and `/qualify` redirect to `/pool` but still exist as concepts/routes (and `_legacy-inbox.tsx.bak`).
- *Consequence:* residual confusion, dead URLs in muscle memory.
- *Solution:* keep redirects (already done), remove from any remaining nav/labels, and document them as retired.

**C11 — Mobile bottom nav mixes a *segment* (Pool) with *modes*.**
- *Problem:* `mobile-nav` = `today · pool · pipeline · calendar`. *Pool* is a subset of *Pipeline*; it shouldn't be a peer tab.
- *Consequence:* a top-level tap spent on a niche filter; "People" (the most-used object) is **not** in the bottom bar at all.
- *Solution:* bottom nav = `Today · People · Pipeline · Calendar` + center **FAB**. Pool becomes a tab inside Pipeline. (See §7.4/§8.)

**C12 — No single "create anything" affordance on mobile.**
- *Problem:* creation is scattered across `quick-*` dialogs and the desktop-only command palette.
- *Consequence:* on a phone, "add a person / task / showing right now" is several taps and not where the thumb is.
- *Solution:* a **global FAB** (center of bottom bar) → *New person · New task · New showing · Log call · Quick note*.

---

## 5. Always-available actions (the contract)

**Hypothesis (from brief):** *If I open a client from anywhere in the system, I must have the same key actions.* → **Validated. This is the right principle and the benchmarks all implement it.** Below is the concrete contract.

### 5.1 The fixed action set (must exist on EVERY person, everywhere)
1. **Call** (`tel:` + auto **Log Call** disposition on return) — always.
2. **WhatsApp** (deep link) — *only when `INTEGRATIONS_ENABLED`*; otherwise hidden (not greyed).
3. **Email** (`mailto:` / composer) — gated like WhatsApp; `mailto:` may stay as a plain link.
4. **Add note** (text + voice) — always.
5. **Create task** (with due date / next action) — always.
6. **Schedule showing** — always (pick property + time).
7. **View history** (client-scoped timeline) — always.
8. **Edit person** (name, contacts, preferences/brief) — always.
9. **Change stage** (pipeline) — always (acts on the person's active Lead; if none, "Start opportunity").
10. **Set priority** (hot/warm/cold) — always.
11. **Assign / reassign** (role-permitting) — always.
12. **Advance deal** — *contextual:* visible only when a Deal exists, but always in the same slot.

### 5.2 From which screens these must be reachable
The fixed set (1, 4, 5, 6, 7 at minimum — Call/Note/Task/Schedule/History) must be reachable **without opening the full card** from:
- **Pool** rows, **Pipeline** cards, **People** list rows, **Today** items, **Calendar** events, **Search results**, **Deal** rows, and **Property → interested people** rows.

**Architecture to guarantee this (single source of truth):**
- A **`<PersonQuickActions personId>`** component (one implementation) that renders the fixed action bar. Used by: the Client Card (full), every list row (swipe/long-press menu), and the global search result. *This replaces the current divergent `ClientActions` (client page) and the lead card's bespoke action cluster with one shared component.*
- A **`<PersonContext>`** loader that, given a `personId`, fetches the person + active lead + open deal + next task, so any surface can render the same actions with the same data. (The API already exposes `clients.get`, `leads`, `activities`, `tasks`, `showings` — this is composition, not new backend.)

> **Divergence today:** actions are implemented twice (lead card cluster vs `ClientActions`) and unevenly. The fix is *one* `PersonQuickActions` used everywhere — this is the highest-leverage change in the whole spec.

---

## 6. The Universal Client Card

One card, identical whether opened from a lead, a contact, a deal, a showing, or search. **`personId` is the only input.** Lead/Deal/Showing render as **blocks** that appear when they exist.

### 6.1 Blocks
- **Header:** avatar, full name, **type chip** (Buyer/Seller/Both), **stage pill** (the active lead's stage), **priority dot**, assignee, source badge. Tapping stage/priority edits inline.
- **Pinned Quick-Action bar** (the §5.1 set) — sticky, thumb-reachable on mobile.
- **Contacts block:** primary phone (`tel:`), email (`mailto:`), channel identifiers (`ClientContact[]`); add/edit.
- **Status/Brief block:** active Lead (purpose, urgency, **budget**) + **Preferences** (type, districts, rooms, price, area). The qualification data in one place.
- **Activity block:** **client-scoped** timeline (calls, notes, emails, system, showings, stage changes), filter chip "This opportunity / All."
- **Tasks block:** open tasks with due dates; "next action" highlighted; quick-complete.
- **Notes block:** persistent notes (text + voice) — already exists (`NotesPanel`).
- **Properties block:** shortlist / matches / interested property; schedule showing from here.
- **Deals block:** current Deal (stage, amount, commission, documents, payments); appears only when a deal exists; "Create deal" CTA when in NEGOTIATION.
- **(Footer) Admin block:** archive, blacklist, consent — low-frequency, collapsed.

### 6.2 Text wireframe (mobile, top → bottom)

```
┌─────────────────────────────────────────────┐
│ ‹ Back            Olena Koval        ⋮  more │   header
│  (avatar)  Buyer · ● Hot · QUALIFIED ▾       │   type · priority · stage(tap=change)
│            Source: Instagram · You (agent)   │
├─────────────────────────────────────────────┤
│ [ Call ] [ WhatsApp* ] [ Note ] [ Task ] [+] │   ← PINNED Quick-Action bar (sticky)
├─────────────────────────────────────────────┤
│ CONTACTS                                     │
│  📞 +380 67 123 4567        (tap = call)     │
│  ✉️  olena@mail.com         (tap = mail)     │
│  Telegram @olenak                            │
├─────────────────────────────────────────────┤
│ BRIEF / QUALIFICATION              [ Edit ]  │
│  Wants: 2-room apartment · Buy                │
│  Budget: $80k–$95k · Urgency: This month     │
│  Districts: Center, Lukyanivka               │
├─────────────────────────────────────────────┤
│ NEXT ACTION                                  │
│  ☐ Call back re: viewing — Today 17:00       │
│                                  [ + Task ]  │
├─────────────────────────────────────────────┤
│ PROPERTIES (shortlist / matches)   [ + Add ] │
│  • Center, 2r, $88k   [Schedule showing]     │
│  • Lukyanivka, 2r, $92k                       │
├─────────────────────────────────────────────┤
│ DEAL                              (if exists) │
│  Stage: OFFER ▾ · $88,000 · 3% = $2,640      │
│  Docs (1) · Payments (0)                      │
├─────────────────────────────────────────────┤
│ ACTIVITY  ( This opportunity | All )         │
│  ▸ Call logged · 4 min · "interested" · 2h   │
│  ▸ Stage NEW→QUALIFIED · today                │
│  ▸ Note (voice 0:12) · yesterday             │
├─────────────────────────────────────────────┤
│ NOTES  (text + voice)             [ + Note ] │
├─────────────────────────────────────────────┤
│ ⌄ Archive · Blacklist · Consent (collapsed)  │
└─────────────────────────────────────────────┘
  * WhatsApp/Email shown only when INTEGRATIONS_ENABLED
```

Desktop is the same blocks in a **3-column** layout (left: contacts/brief/tasks; center: activity/notes; right: properties/deal), but the **action bar and block set are identical** — predictability across form factors.

---

## 7. Ideal architecture (don't be limited by current code)

### 7.1 Entities & relationships (target)
*No schema change required for v1 — the current schema already supports this.* Conceptual model:

```
Source ──< Client(Person) >── ClientContact (channels)
                 │   └────────── ClientPreferences (brief)
                 ├──< Lead (opportunity; stage)  ──1:1── Deal ──< Payment
                 │                                   │        └─< Document
                 ├──< Activity (timeline; clientId required, leadId optional)
                 ├──< Task
                 ├──< Showing >── Property
                 └──< Deal >── Property
Property ──< PropertyPhoto ; Property.sellerClient → Client
User(Agent) owns assignments, deals, showings ; roles via UserRole
```

Reading: **Person is the hub; Lead/Deal/Showing/Activity/Task all hang off the Person; Property is a parallel catalog joined via interest/showings/deals.** This is already true in the DB.

### 7.2 Screens (target set)
- **Today** — agenda: overdue/next tasks, today's showings, new pool items, hot follow-ups.
- **People** — the contact list (search-first); replaces `/clients` **and** `/contacts`.
- **Person Card** — the Universal Client Card (§6); replaces `/leads/[id]` **and** `/clients/[id]`.
- **Pipeline** — one funnel screen with lenses: *Unassigned (Pool) · Mine · Kanban by stage · Deals*; replaces `/pool` + `/leads` + `/pipeline` + `/deals` as separate destinations.
- **Properties** — catalog + `Property` card; replaces `/inventory` + `/properties`.
- **Calendar** — showings + tasks.
- **Insights** — analytics; replaces `/reports` + `/insights`.
- **Settings/Team/Profile/Admin** — unchanged.

### 7.3 Actions (target) — see §5; one shared `PersonQuickActions`.

### 7.4 Navigation (target)
- **Desktop sidebar:** `Today · People · Pipeline · Properties · Calendar · Insights` (+ Settings/Team for admins).
- **Mobile bottom nav (4 + FAB):** `Today · People · Pipeline · Calendar` with a **center FAB** for create.
- Pool, Leads-list, Deals are **tabs/segments inside Pipeline**, not top-level.

### 7.5 User roles (from `UserRole`)
- **Agent:** owns their people/leads/deals; sees Pool to claim; full actions on assigned people.
- **Manager:** all-team visibility; reassign; Pool distribution; team Insights.
- **Admin:** settings, templates, automations, audit, integrations flag.
*(Role gating already exists in nav via `role` on `NAV_ITEMS`; keep and extend.)*

---

## 8. Mobile UX (one-handed, minimum taps)

**Principles:** thumb zone = bottom; never bury a primary action behind a menu; every list row exposes the top actions via swipe/long-press; the same action sits in the same place on every screen.

**Action placement decision:**
- **Bottom of the Person Card (sticky action bar):** `Call · WhatsApp* · Note · Task · (+ more)` — the record's primary actions. *(Record actions, not navigation.)*
- **Global FAB (center of bottom nav):** *create anything* → `New person · Log call · New task · Schedule showing · Quick note`. One thumb tap from any screen.
- **Inside the Person Card (contextual, in-block):** `Edit brief`, `Add property / Schedule showing`, `Advance deal`, `Change stage` (header pill), `Set priority` (header dot).
- **App bottom navigation (modes only):** `Today · People · Pipeline · Calendar`. **Never** put record actions here.
- **List rows:** swipe-left = `Call`; swipe-right = `Task`; long-press = full `PersonQuickActions` sheet — so the agent acts without opening the card.

**Tap budget targets:** new inbound → first call ≤ **2 taps** (Pool row → Call). Log a call outcome ≤ **2 taps** after hangup (auto-prompt). Schedule showing ≤ **3 taps**. Move stage ≤ **2 taps** (header pill → pick).

---

# FULL PRODUCT SPECIFICATION

## NEW INFORMATION ARCHITECTURE
- **Object model:** **Person (Client) is the center.** Lead = the person's active opportunity (stage); Deal = the person's transaction; Showing/Activity/Task hang off the person; Property is a parallel catalog.
- **Destinations (7):** `Today · People · Pipeline · Properties · Calendar · Insights · Settings`.
- **Merges/retire:** `/contacts → /people` (alias `/clients`); `/inventory → /properties`; `/reports → /insights`; `/pool`, `/leads`(list), `/deals` become **tabs inside Pipeline**; `/inbox`,`/qualify` stay redirected to Pipeline/Pool and are removed from all labels.
- **One card:** `/leads/[id]` and `/clients/[id]` collapse into **`/people/[id]`** (Universal Client Card), opened identically from every entry point.
- **Already correct (keep):** client-scoped `Activity`, `Lead.clientId`, `Deal(lead,client,property)`, gated integrations, post-create redirect to the person card.

## LEAD WORKFLOW
1. Inbound lands in **Pipeline ▸ Pool** (unassigned) and **Today**. 2. Agent **Claims** → person assigned. 3. Open **Person Card** → **Call** (auto **Log Call**) → stage auto/explicit `NEW→CONTACTED`. 4. **Qualify:** fill Brief (purpose/urgency/budget + preferences) → `QUALIFIED`. 5. **Match & shortlist** properties → **Schedule showing** → `SHOWING`. 6. **Feedback** logged on timeline → `NEGOTIATION`. 7. **Create Deal** → `WON`. A lead is *never created by hand as a separate object*; it is "this person now has an active opportunity." One person may run **multiple sequential leads** (repeat business) — all under one Person Card, filterable by opportunity.

## CONTACT WORKFLOW
- **People** is the home list (search-first; recently-active first). 2. Every person is the **same Universal Card** regardless of whether they currently have a lead/deal. 3. A contact with **no active lead** shows the Brief/Contacts/History and a **"Start opportunity"** CTA (creates a Lead in `NEW`). 4. **All §5 actions always present.** 5. Sellers (ClientType SELLER/BOTH) additionally show **Listed properties** block. 6. Archive/Blacklist/Consent live in the collapsed admin footer.

## DEAL WORKFLOW
- A **Deal** is created from a Person in `NEGOTIATION` (amount, commission%, property). 2. It renders as the **Deal block** on the Person Card and as a card in **Pipeline ▸ Deals**. 3. Advance `Deal.stage` (`OFFER→DOCS_REVIEW→DUE_DILIGENCE→CONTRACT→CLOSED_WON/LOST`) from the same slot on the card. 4. Attach **Documents/Contracts**, record **Payments**, compute **commission**. 5. `CLOSED_WON` sets `Lead WON` + `Deal.closedAt`; the person stays in **People** for nurture/repeat. 6. Deal actions are **contextual but in a fixed location** (never a hunt).

## MOBILE NAVIGATION
- **Bottom tab bar (modes):** `Today · People · Pipeline · Calendar`. **Center FAB** = create anything.
- **Person Card sticky action bar:** `Call · WhatsApp* · Note · Task · (+)`.
- **List rows:** swipe = Call / Task; long-press = full quick-action sheet.
- **No record actions in the tab bar; no navigation in the action bar.** Pool is a Pipeline tab, not a tab-bar peer.
- `*` channel actions appear only when `INTEGRATIONS_ENABLED`.

## GLOBAL QUICK ACTIONS
- **`PersonQuickActions(personId)`** — ONE shared component rendering the §5.1 fixed set; used by the card, every list row, search results, Today, Calendar, Deal rows.
- **Global FAB** — `New person · Log call · New task · Schedule showing · Quick note`.
- **Command palette (desktop ⌘K)** — same actions + jump-to-person/property.
- **Contract:** the fixed actions are present and in the same position on every surface; contextual actions (Advance deal) appear when relevant but never move.

## IMPLEMENTATION PRIORITY

**P0 — Quick wins (low risk, high clarity; days):**
1. Extract **`PersonQuickActions`** as one shared component; render it on both current cards (kills the action asymmetry C7 immediately).
2. Make the lead card's timeline **client-scoped** with an opportunity filter (C6) — reuse the client `ActivityTimeline`.
3. Add **stage / priority / budget** to the client card (or vice-versa) so both cards reach parity *before* the merge (C1 interim).
4. Collapse duplicate **nav labels/routes**: `/contacts`→People, `/inventory`→Properties, `/reports`→Insights via redirects (C2–C4); remove retired labels (C10).
5. Mobile bottom nav: swap **Pool→People**, add **center FAB** (C11–C12).

**P1 — High-impact changes (the real fix; 1–3 weeks):**
6. **Universal Client Card** at `/people/[id]`; point `/leads/[id]` and `/clients/[id]` at it (param = personId; resolve active lead/deal server-side). This *is* the cure for the core contradiction (C1).
7. **Pipeline** unified screen with Pool/Mine/Kanban/Deals lenses (C5).
8. **"Always create a Person first"** unified create flow; "Start opportunity" CTA (C9).
9. Schedule-showing + deal actions promoted to first-class **Quick Actions on the person** (C8, deal slot).

**P2 — Polish:** matching surfaced as a card block; seller-mode card variant; nurture automations on `WON`/`LOST`; consent UX.

## HIGH-IMPACT CHANGES (the five that matter most)
1. **One Universal Client Card** (`/people/[id]`) replacing the lead/client split — removes the "remember where it lives" tax.
2. **One `PersonQuickActions`** used everywhere — guarantees predictability (the validated hypothesis).
3. **Client-scoped history everywhere** — one continuous person story across multiple leads/deals.
4. **Collapse duplicate destinations** (People/Properties/Insights/Pipeline) — fewer places, no ambiguity.
5. **Mobile: People in the tab bar + global FAB + sticky card action bar** — first call in ≤2 taps, create anything in 1.

---

## Appendix A — Mapping: current file/route → target
| Current | Target |
|---|---|
| `/clients`, `/contacts` (+`contacts/page.tsx`) | **People** (`/people`, alias `/clients`) |
| `/clients/[id]`, `/leads/[id]` | **Universal Client Card** (`/people/[id]`) |
| `/pool`, `/leads`, `/pipeline`, `/deals` | **Pipeline** (one screen, 4 lenses) |
| `/inventory`, `/properties` | **Properties** |
| `/insights`, `/reports` | **Insights** |
| `/inbox`, `/qualify` | retired (redirect to Pipeline/Pool) |
| `ClientActions` + lead action cluster | **`PersonQuickActions`** (shared) |
| `ActivityTimeline source="lead"` | client-scoped timeline + opportunity filter |

## Appendix B — Open product decisions (for the review meeting)
- Final top-level name: **People** vs keep **Contacts/Clients**?
- Does Pool stay a Pipeline tab, or remain a peer for managers who distribute leads?
- Multiple simultaneous opportunities per person — show as stacked lead blocks or a switcher?
- Seller-side workflow depth (listings management) — in scope for this pass or separate?

*(End of specification. No code, schema, routes, or config were changed by this document.)*
