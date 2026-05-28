# Client Handoff Document

You're receiving your Real Estate CRM. This document is everything you need to operate it independently of the development team.

## What you received

1. **Production deployment** on your server, accessible at https://yourdomain.com
2. **Source code** (this repo) — full ownership, on your Git account
3. **Admin credentials** (delivered separately, secure channel)
4. **Database backups** scheduled nightly to `/backups/`
5. **Documentation set** (you're reading one of 5 files):
   - `DEPLOYMENT_GUIDE.md` — how to redeploy on a new server
   - `INSTALLATION_GUIDE.md` — how to run locally for testing
   - `ADMIN_SETUP_GUIDE.md` — managing users, automation rules, integrations
   - `USER_GUIDE.md` — end-user manual for realtors
   - `CLIENT_HANDOFF.md` — this file

## Day 1 checklist

In the first 24 hours after handoff, do these in order:

- [ ] **Log in** at https://yourdomain.com with the admin credentials provided.
- [ ] **Change the admin password** (top-right user menu → Profile → Reset password).
- [ ] **Create one admin account** with your own email (`Settings → Users → New user`). Use this from now on.
- [ ] **Delete or deactivate** the original delivery admin account.
- [ ] **Verify nightly backup** ran: SSH into the server, `ls -la /home/crm/crm/backups/` — there should be `crm-YYYY-MM-DD_*.sql.gz`.
- [ ] **Test password reset flow**: at `/login`, click "Forgot password" — make sure the email arrives.
- [ ] **Invite your first 3 realtors** (`Settings → Users → Invite`). They get an email with a setup link.
- [ ] **Set agency time zone**: `Settings → Profile → Locale` (also edit `.env` `TZ=` on the server if you're outside Kyiv).
- [ ] **Verify SSL** by visiting `https://yourdomain.com` — green padlock, no warnings.

## What's included

| Capability | Status | Notes |
|---|---|---|
| Lead pipeline (Kanban, 6 stages) | ✅ | Drag-and-drop, undo toast |
| Property inventory (BUY/RENT) | ✅ | Multi-currency, photo uploads to MinIO |
| Contact CRM (clients, archive, blacklist) | ✅ | Merge duplicates, GDPR consent toggle |
| Deals + commission tracking | ✅ | Auto-create on stage=WON, commission % calculation |
| Tasks (calls, showings, follow-ups) | ✅ | OVERDUE auto-flag, snooze, bulk assign |
| Calendar (showings + tasks) | ✅ | Week/month view, quick-time chips |
| Reports (funnel, ROI, agent activity) | ✅ | Drill-through to filtered lead list |
| Telephony MVP (tel: + disposition) | ✅ | Captures call outcome → CALL activity + follow-up task |
| Telegram bot (incoming + outgoing) | ✅ | Optional — needs `TELEGRAM_BOT_TOKEN` |
| Email (Resend) | ✅ | Welcome, password-reset, invitations, custom templates |
| WhatsApp / Instagram / FB Lead Ads | 🚧 | Schema ready; webhooks to be implemented when you obtain API credentials |
| Role-based access (ADMIN/MANAGER/REALTOR/ASSISTANT) | ✅ | Realtors see own leads only; managers see team |
| Audit log | ✅ | Every entity change tracked, 90-day retention default |
| GDPR consent management | ✅ | Per-client opt-in, timestamp + version stored |
| Manager team workload dashboard | ✅ | Active leads, OVERDUE tasks, last activity per agent |
| Round-robin lead assignment | ✅ | Configurable via `Settings → Automation`, respects `isAvailable` |
| SLA escalation (first-touch 15 min) | ✅ | Auto-creates CALL task; T+30 → manager; T+60 → re-pool |
| Quick capture flow (one-modal) | ✅ | Contact + property + lead + action in one submit |
| Mobile-friendly | 🟡 | Responsive on tablet; mobile kanban scrollable horizontally |

Legend: ✅ shipped · 🚧 stubbed (needs external credentials) · 🟡 functional, polish-pending

## Operating costs (monthly, estimate)

| Item | Cost |
|---|---|
| VPS (4 vCPU, 8 GB RAM, 80 GB SSD — Hetzner/DigitalOcean/AWS) | €15–40 |
| Domain renewal | €1 |
| SSL (Let's Encrypt) | €0 |
| Resend (3 000 emails/month free, then €20/mo for 50k) | €0–20 |
| Backups (S3 or built-in volume) | €0–5 |
| Telegram bot | €0 |
| **Total** | **€16–66/mo** |

## What we **didn't** include

Things you'll need to add yourself if you want them:

- **WhatsApp Business API** — Meta business verification + Cloud API setup. We can scaffold the webhook for you on request.
- **Instagram / Facebook Lead Ads** — same: Meta business + Page access tokens.
- **Mobile native apps** (iOS/Android) — the web is mobile-responsive but not a PWA/native app.
- **Real-time push notifications** — currently in-app + Telegram only. Web push (browser) is a 1-day add.
- **Multi-tenancy** (multiple agencies on one install) — schema is single-tenant.
- **Public-facing website** — this is internal CRM only. Your marketing site lives separately.
- **Document e-sign integration** (DocuSign, HelloSign) — pluggable but not implemented.

## Support model

After handoff:

- **30-day bug-fix warranty** — any defect introduced by us, free fix.
- **Documentation** — these 5 .md files cover 95% of operational questions.
- **Custom development** — invoiced per feature.

## Where things live on the server

```
/home/crm/crm/                  ← repo, deployed as `crm` user
├─ .env                         ← production secrets (chmod 600)
├─ docker-compose.prod.yml      ← container topology
├─ backups/                     ← nightly DB dumps (rotation: 30 days)
├─ nginx/
│   ├─ nginx.conf               ← reverse proxy config
│   ├─ certs/                   ← SSL (symlinked to /etc/letsencrypt/live/)
│   └─ logs/                    ← access + error logs
└─ scripts/
    ├─ deploy.sh                ← ./scripts/deploy.sh  (run after git pull)
    ├─ backup.sh                ← runs in cron at 3:00
    └─ restore.sh               ← ./scripts/restore.sh <dump.gz>
```

Docker volumes (persistent data):

- `postgres_data` — your entire DB
- `redis_data` — job queue state (ephemeral)
- `minio_data` — uploaded files (photos, documents)

To migrate to a new server: tar these volumes + the `.env` file + the `nginx/certs` symlink target. Detailed steps in `DEPLOYMENT_GUIDE.md`.

## Security notes

The system is hardened by default. Things you should still verify:

1. **`.env` permissions**: `chmod 600 /home/crm/crm/.env` (only the `crm` user can read it).
2. **SSH**: disable password auth, keys only. Set in `/etc/ssh/sshd_config`: `PasswordAuthentication no`, then `systemctl restart ssh`.
3. **Firewall**: `ufw status` should show only ports 22, 80, 443. Everything else closed.
4. **Updates**: `apt update && apt upgrade -y` monthly. Set up unattended-upgrades for security patches.
5. **Backups**: verify restorability quarterly: `./scripts/restore.sh ./backups/latest.sql.gz` to a test VM.
6. **Audit log**: monitor `/api/admin/audit-log` for suspicious changes (especially role changes, bulk deletes).
7. **GDPR**: if you operate in EU, document your data retention policy. Default: 7-year retention for closed deals, 2 years for LOST leads, indefinite for active customers with consent.

## Escalation matrix

| Issue | What to do |
|---|---|
| Login broken / 500 errors | `docker compose -f docker-compose.prod.yml logs api --tail=100` → if no clue, contact us |
| Realtor can't see their leads | Check their role in `Settings → Users`. REALTOR sees only own; MANAGER sees team |
| Email not arriving | https://resend.com/emails → check delivery log; check spam; verify domain in Resend |
| Production server down | 1. Check VPS provider status page  2. SSH in: `docker compose ps`  3. If hung: `docker compose restart` |
| Lost admin password | SSH in: run the SQL in `DEPLOYMENT_GUIDE.md` §6 to reset via password hash |
| Want a new feature | Check `USER_GUIDE.md` first — might already exist. If not, contact us with use case. |

## Contacts

- **Technical lead**: [your dev's name + email]
- **Resend support**: support@resend.com
- **Domain registrar**: [your registrar]
- **Hosting**: [your VPS provider, account login]

Keep this document with the admin credentials. Replace placeholders with your real contacts.
