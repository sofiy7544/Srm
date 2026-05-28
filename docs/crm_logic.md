# CRM Business Logic
> **Realtor CRM** | Complete business rules and workflow reference
> Last updated: 2026-05-28 | Maintained automatically.

---

## 1. Core Entities & Relationships

```
Source ──────────────────────────────────────────────────────┐
                                                              │
Client ──(1:N)── ClientContact                               │
  │                                                           │
  └──(1:N)── Lead ──(1:1)── Deal                             │
               │    │         │                               │
               │    │         └── Payment (commission)        │
               │    │                                         │
               │    ├── assignedTo ── User                    │
               │    ├── property  ── Property ── PropertyPhoto│
               │    ├──(1:N)── Activity                       │
               │    ├──(1:N)── Task                           │
               │    ├──(1:N)── Showing ── Activity            │
               │    └── source ──────────────────────────────┘
               │
               └── ClientPreferences (search criteria)
```

---

## 2. Lead Lifecycle

### 2.1 Lead Stages (7 stages)

```
NEW → CONTACTED → QUALIFIED → SHOWING → NEGOTIATION → WON
                                                     ↘ LOST
```

| Stage | Description | Trigger |
|-------|-------------|---------|
| `NEW` | Lead just captured, not yet contacted | Creation (any source) |
| `CONTACTED` | First meaningful communication logged | First activity (call/message) |
| `QUALIFIED` | Needs confirmed, budget verified | Manual by realtor |
| `SHOWING` | Property visit scheduled or completed | Showing created |
| `NEGOTIATION` | Offer made, documents exchanged | Manual by realtor |
| `WON` | Deal closed successfully | `Deal.stage = CLOSED_WON` |
| `LOST` | Lead dropped with reason | Manual by realtor + reason required |

### 2.2 Stage Transition Rules

- Any forward transition is allowed by the assigned realtor.
- Backward transitions (e.g., `NEGOTIATION → SHOWING`) are allowed only by MANAGER or ADMIN.
- `WON` and `LOST` are terminal — no further transitions except by ADMIN.
- Every stage change writes an `Activity` record with `type = STAGE_CHANGE` (immutable audit trail).
- Stage change to `NEGOTIATION` triggers atomic property hold (see BL-004).

### 2.3 Lead Creation Rules

1. **Deduplication:** If a client with the same phone number already has an active (non-WON, non-LOST) lead, creation is rejected with `409 Conflict`.
2. **Source required:** Every lead must have a `sourceId`; sources are pre-configured by ADMIN.
3. **Assignment:** On creation, automation engine assigns to an available realtor (round-robin) unless manually specified.
4. **SLA timer:** BullMQ delayed job created immediately after assignment (configurable window, default 1h).
5. **`dealIntent` required:** Must be `BUY` or `RENT` — determines which property inventory is shown.

### 2.4 Lead Closing

**WON:**
- Requires linked `Deal` record.
- Closes linked `Deal` as `CLOSED_WON`.
- Property status set to `SOLD` (BUY) or re-set to `AVAILABLE` (RENT, after lease end).
- BullMQ 6-month delayed re-engagement task created (referral follow-up).

**LOST:**
- Requires `lostReason` (used in analytics).
- Unlinks from property (property reverts to `AVAILABLE` if was `RESERVED`).
- Can be re-opened as new lead by MANAGER.

---

## 3. Deal Lifecycle

### 3.1 Deal Stages (6 stages)

```
OFFER → DOCS_REVIEW → DUE_DILIGENCE → CONTRACT → CLOSED_WON
                                               ↘ CLOSED_LOST
```

| Stage | Description |
|-------|-------------|
| `OFFER` | Price agreed verbally or in writing |
| `DOCS_REVIEW` | Client documents under review |
| `DUE_DILIGENCE` | Legal/title check, inspection |
| `CONTRACT` | Contracts signed |
| `CLOSED_WON` | Transaction complete |
| `CLOSED_LOST` | Transaction fell through |

### 3.2 Deal-Lead Relationship

- `Deal` is created from a `Lead` when lead enters `NEGOTIATION` stage.
- `Deal.leadId` is unique — one deal per lead.
- Closing a `Deal` updates the parent `Lead` stage accordingly.

### 3.3 Commission Tracking

- `CommissionPlan` attached to each `User` (percentage or flat fee).
- `Payment` records track actual transfers (type: `COMMISSION`, `BONUS`, `ADJUSTMENT`).
- Commission preview shown in deal creation UI before close.
- MANAGER and ADMIN can view all commission data; REALTOR sees own only.

---

## 4. Client Management

### 4.1 Client Record

A `Client` is a real person. One client can have multiple leads over time (but only one active lead per phone at a time).

**Required fields:** `firstName`, `lastName`, `phone`, `marketingConsent`, `consentTimestamp`, `consentVersion`

### 4.2 Client Contacts

`ClientContact` records additional communication channels:
- `WHATSAPP`, `TELEGRAM`, `INSTAGRAM`, `VIBER`, `EMAIL`, `PHONE`
- Displayed in the omnichannel inbox for quick one-click contact

### 4.3 Client Preferences

`ClientPreferences` stores search criteria:
- `dealIntent` (BUY/RENT), price range, rooms, area range, districts (array), property types

Used by realtors to match incoming properties to interested clients.

### 4.4 GDPR Compliance Rules

- `marketingConsent: boolean` — explicit checkbox at client creation.
- `consentTimestamp: DateTime` — server-stamped at consent capture.
- `consentVersion: String` — version of privacy policy accepted (e.g., `v2024-01`).
- **Anonymization request:** MANAGER+ can anonymize a client: sets name to `[Deleted]`, nulls phone/email, logs to `AuditLog`.
- No marketing communications sent if `marketingConsent = false`.

---

## 5. Property Management

### 5.1 Property Status Flow

```
AVAILABLE → IN_SHOWING → RESERVED → SOLD (for BUY)
          ↘                       ↘ AVAILABLE (for RENT, after lease)
            ARCHIVED (removed from market)
```

| Status | Meaning |
|--------|---------|
| `AVAILABLE` | On market, can be shown |
| `IN_SHOWING` | Currently being shown (soft lock during showing) |
| `RESERVED` | Under negotiation — blocked for other leads |
| `SOLD` | Completed transaction (BUY funnel) |
| `ARCHIVED` | Removed from active inventory |

### 5.2 Property Hold Logic (Atomic)

When lead stage → `NEGOTIATION`:
```typescript
await prisma.$transaction([
  prisma.lead.update({ where: { id }, data: { stage: 'NEGOTIATION' } }),
  prisma.property.update({ where: { id: lead.propertyId }, data: { status: 'RESERVED' } }),
  prisma.activity.create({ data: { type: 'STAGE_CHANGE', ... } }),
])
```
Transaction rollback if any step fails — prevents inconsistent state.

### 5.3 Dual Funnel (BUY vs RENT)

- `Property.dealIntent` field determines which funnel it belongs to.
- Separate Kanban views for BUY and RENT in the frontend.
- Commission structures differ: BUY uses percentage of sale price; RENT uses monthly fee × months.
- Property stays `AVAILABLE` after RENT deal closes (property re-enters inventory).

---

## 6. Showing Management

### 6.1 Showing Workflow

```
Schedule Showing → Property status: IN_SHOWING
      │
      ├── COMPLETED → Activity logged → BullMQ: 2h delayed feedback task
      ├── NO_SHOW   → Activity logged → Task: reschedule follow-up
      └── CANCELLED → Activity logged → Property: back to AVAILABLE
```

### 6.2 Feedback Capture

- Post-showing feedback task auto-created 2h after completion.
- Feedback includes: client reaction, interest level, objections noted.
- Showing photos can be attached (MinIO upload).

---

## 7. Task Management

### 7.1 Task Types

| Type | Description |
|------|-------------|
| `CALL` | Schedule a call with client |
| `WHATSAPP` | Send WhatsApp follow-up |
| `FOLLOW_UP` | General follow-up action |
| `SHOWING` | Arrange a property showing |

### 7.2 SLA Escalation Chain

```
Lead assigned to realtor
    │
    └── BullMQ delayed job (SLA window, default: 1h)
              │
              ├── Activity logged within window → job cancelled ✓
              │
              └── No activity within window:
                      │
                      ├── Notify MANAGER (in-app + Telegram)
                      │
                      └── Still no activity after 2nd window:
                              └── Auto-unassign → Lead returns to pool
```

### 7.3 Stale Lead Alerts

- Cron job: daily check for leads with no activity in >7 days.
- Alert sent to assigned realtor (in-app notification + Telegram).
- If stale >14 days: alert escalated to MANAGER.

---

## 8. Activity Log

All activities are **immutable** — no UPDATE or DELETE on `Activity` records.

### 8.1 Activity Types

| Type | Description |
|------|-------------|
| `CALL` | Phone call (with duration, disposition) |
| `WHATSAPP` | WhatsApp message |
| `EMAIL` | Email sent/received |
| `TELEGRAM` | Telegram message |
| `INSTAGRAM` | Instagram DM |
| `NOTE` | Manual note by realtor |
| `SHOWING` | Showing event reference |
| `STAGE_CHANGE` | Pipeline stage transition (from/to) |
| `ASSIGNMENT` | Lead assigned/reassigned (from/to user) |

### 8.2 Activity Display

- Lead detail page shows chronological timeline of all activities.
- Client card shows unified timeline across all leads for that client.
- Activities shown with actor, timestamp, type badge, and body text.

---

## 9. Communication & Omnichannel

### 9.1 Message Inbox

Single unified inbox collects messages from:
- WhatsApp Business Cloud API
- Telegram Bot
- Instagram Graph API
- Email (parsed incoming)
- Phone (manual log)

Messages are linked to `Lead` or `Client` automatically by phone/username matching.

### 9.2 Message Templates

- Templates have dynamic fields: `{{firstName}}`, `{{propertyAddress}}`, `{{showingTime}}`, etc.
- MANAGER+ can create/edit templates.
- Realtors can select templates when composing messages.
- Templates support all contact channels.

### 9.3 Telegram Bot Integration

- Bot receives messages → creates leads or appends activities.
- Bot sends notifications to assigned realtors (SLA alerts, new leads, task reminders).
- Webhook registered via `TELEGRAM_BOT_TOKEN` + `TELEGRAM_WEBHOOK_SECRET`.

---

## 10. Lead Assignment & Automation

### 10.1 Round-Robin Assignment Algorithm

```
1. Filter users WHERE role IN (REALTOR, EMPLOYEE) AND isAvailable = true
2. Order by lastAssignedAt ASC (least recently assigned first)
3. Apply AutomationRule filters (if configured):
   - source type match
   - dealIntent match
   - district match (from ClientPreferences)
4. Assign to top result → update user.lastAssignedAt = now()
5. If no eligible user: lead goes to pool (assignedToId = null)
```

### 10.2 Automation Rules

ADMIN/MANAGER can configure `AutomationRule` records:
- **Conditions:** `sourceType`, `dealIntent`, `district`
- **Action:** Assign to specific user or team
- Rules evaluated in priority order; first match wins.
- No match → default round-robin.

### 10.3 Pool Management

- `Lead.assignedToId = null` → lead is in the pool.
- MANAGER dashboard shows pool size.
- MANAGER can manually assign pool leads.
- Pool leads do not trigger SLA timers until assigned.

---

## 11. Notification System

### 11.1 In-App Notifications

- Bell icon in header shows unread count.
- Notification types: new lead assigned, SLA breach, task due, showing scheduled, deal closed, message received.
- Mark-as-read per notification or bulk.

### 11.2 Telegram Push Notifications

- Realtor can link their Telegram account in settings.
- Push sent via bot for: SLA alerts, new lead assignments, task reminders.
- MANAGER receives escalation alerts.

---

## 12. Analytics & Reports

### 12.1 Available Reports

| Report | Audience | Data |
|--------|----------|------|
| Lost Reasons breakdown | MANAGER, ADMIN | Pie/bar of `lostReason` distribution |
| Team workload | MANAGER, ADMIN | Active leads, overdue tasks, showings per realtor |
| Funnel conversion | MANAGER, ADMIN | Stage-by-stage drop-off rates |
| Source performance | MANAGER, ADMIN | Leads by source, conversion rate per source |
| Commission summary | ADMIN only | Payments and commission by realtor/period |

### 12.2 Today Dashboard

Visible to all roles (own data for REALTOR, team for MANAGER):
- Hot leads (high-intent, recent activity)
- Today's scheduled showings
- Overdue tasks
- Unread messages count

---

## 13. RBAC Permission Matrix

| Action | ADMIN | MANAGER | REALTOR | ASSISTANT | ANALYST |
|--------|-------|---------|---------|-----------|---------|
| View all leads | ✓ | ✓ | own | ✓ | ✓ |
| Create lead | ✓ | ✓ | ✓ | ✓ | ✗ |
| Reassign lead | ✓ | ✓ | ✗ | ✗ | ✗ |
| Delete lead | ✓ | ✗ | ✗ | ✗ | ✗ |
| View all clients | ✓ | ✓ | own | ✓ | ✓ |
| Anonymize client | ✓ | ✓ | ✗ | ✗ | ✗ |
| Manage properties | ✓ | ✓ | ✓ | ✗ | ✗ |
| View commission data | ✓ | team | own | ✗ | ✗ |
| View analytics | ✓ | ✓ | ✗ | ✗ | ✓ |
| Manage users | ✓ | ✗ | ✗ | ✗ | ✗ |
| System settings | ✓ | ✗ | ✗ | ✗ | ✗ |
| Send team invitations | ✓ | ✓ | ✗ | ✗ | ✗ |

---

## 14. Data Validation Rules

| Field | Rule |
|-------|------|
| `Client.phone` | E.164 format, unique among active leads |
| `Client.email` | Valid email format (optional) |
| `Lead.dealIntent` | Must be `BUY` or `RENT` |
| `Lead.stage` | Enum value; transitions validated server-side |
| `Property.price` | Positive decimal |
| `User.password` | ≥ 8 chars, hashed on receipt |
| `JWT secrets` | ≥ 32 chars |
| `marketingConsent` | Explicit boolean; no default |

---

## 15. Business Rules Quick Reference

| Rule ID | Rule |
|---------|------|
| BL-001 | Only one active lead per client phone |
| BL-002 | Round-robin assignment respects `isAvailable` |
| BL-003 | SLA breach triggers manager notification → auto-unassign |
| BL-004 | `NEGOTIATION` stage atomically sets property to `RESERVED` |
| BL-005 | BUY and RENT are separate funnels (different inventory + commission) |
| BL-006 | GDPR consent required on every client; versioned |
| BL-007 | Post-showing feedback task auto-created 2h after completion |
| BL-008 | 6-month WON re-engagement task for referral capture |
| BL-009 | `lostReason` required when closing lead as LOST |
| BL-010 | Activities are immutable — no edit or delete |
| BL-011 | All multi-model writes use `prisma.$transaction()` |
| BL-012 | Pool leads (unassigned) do not trigger SLA timers |
