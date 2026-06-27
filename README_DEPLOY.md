# 🚀 Deployment & Meta setup guide

This guide walks through everything needed to take
`stanley-fitness-audience-crm` from zero to live, legally collecting warm
audiences via official Meta tools.

---

## 0. Prerequisites

- A **Meta Business Manager** account → <https://business.facebook.com>
- A **Facebook Page** (your brand page)
- An **Ad Account** (`act_...`)
- A **Meta App** (type *Business*) → <https://developers.facebook.com/apps>
- A publicly reachable HTTPS URL for webhooks (Render/Railway gives you one)

---

## 1. Environment variables

Copy `.env.example` → `.env` and fill these in:

| Variable | Where to get it |
|----------|-----------------|
| `META_APP_ID` | developers.facebook.com → your App → Settings → Basic |
| `META_APP_SECRET` | same page (keep secret) |
| `META_ACCESS_TOKEN` | a long-lived **System User** token (see §2) |
| `META_AD_ACCOUNT_ID` | Business Settings → Accounts → Ad Accounts (`act_1234…`) |
| `META_PAGE_ID` | Your Page → About → Page ID |
| `META_PIXEL_ID` | Events Manager → Data Sources → your Pixel |
| `VERIFY_TOKEN` | **You invent this.** Any random string; must match what you enter in §4 |
| `SECRET_KEY` | random 32+ char string (admin session signing) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | admin panel login |
| `TELEGRAM_BOT_TOKEN` | from @BotFather (see §7) |
| `TELEGRAM_MANAGER_CHAT_ID` | your Telegram numeric chat id |

Generate a bcrypt hash for the admin password (recommended over plaintext):

```bash
python -m app.core.security hash "your-strong-password"
# put the output in ADMIN_PASSWORD_HASH
```

---

## 2. Create a long-lived access token (System User)

1. **Business Settings → Users → System Users → Add** → create a system user (Admin).
2. **Add Assets** → assign your **Ad Account**, **Page**, and **Pixel** with full control.
3. **Generate New Token** → select your App → check scopes:
   - `ads_management`
   - `ads_read`
   - `leads_retrieval`
   - `pages_manage_metadata`
   - `pages_read_engagement`
   - `business_management`
4. Copy the token into `META_ACCESS_TOKEN`. System-user tokens don't expire.

---

## 3. Create the Meta Pixel

1. **Events Manager** → **Connect Data Sources** → **Web** → **Meta Pixel** → name it.
2. Copy the **Pixel ID** → `META_PIXEL_ID`.
3. The Pixel base code is **already embedded** in the landing templates
   (`app/templates/landing/*.html`) and fires automatically once `META_PIXEL_ID`
   is set — no manual copy/paste needed.
4. (Optional, recommended) For server-side events, the **Conversions API** uses
   the same `META_ACCESS_TOKEN` + `META_PIXEL_ID`; nothing else to configure.

Verify events in **Events Manager → Test Events** by visiting a landing page.

---

## 4. Connect the Lead Ads webhook

1. Deploy the app first (§8) so you have an HTTPS URL, e.g.
   `https://your-app.onrender.com`.
2. **developers.facebook.com → your App → Webhooks → Add Subscription → Page**.
3. **Callback URL:** `https://your-app.onrender.com/webhooks/meta`
4. **Verify Token:** the exact value of your `VERIFY_TOKEN`.
5. Click **Verify and Save** — Meta calls `GET /webhooks/meta`; the app echoes
   the challenge automatically.
6. **Subscribe** to the **`leadgen`** field.
7. In **Business Settings → Integrations → Webhooks**, make sure your Page is
   subscribed to the App.

Now every Lead Ad submission POSTs to `/webhooks/meta`; the app fetches the full
lead via the Graph API, scores it, stores it, and pings your Telegram bot.

You can also **bulk-pull** existing leads from the admin panel or:

```bash
curl -X POST https://your-app/api/meta/sync/leads
```

---

## 5. Custom Audiences (consented only)

1. Seed the audience templates: `python -m scripts.seed_audiences`
   (or they appear after `scripts.seed`).
2. In the **Audiences** page click **Push to Meta** — the app:
   - selects only leads with `consent = true`,
   - SHA-256 hashes email + phone,
   - creates/updates a Custom Audience via the Marketing API.
3. The 8 JSON targeting templates in `/audiences/` (Fitness Stanley UA, Water
   Bottle Buyers, Lookalike Paid Customers, Retargeting 30d, …) can be imported
   in Ads Manager or used as a reference for Saved Audiences. Replace the
   `REPLACE_WITH_*` interest/pixel/form ids with real ones from your account.

---

## 6. Website Custom Audience (Pixel-based)

Use `audiences/retargeting_website_visitors_30d.json` as the rule. In **Audiences
→ Create → Website**, target people who triggered `PageView` / `ViewContent` on
your landing pages in the last 30 days. The landing pages already emit these
events through the Pixel.

---

## 7. Telegram manager bot

1. Open **@BotFather** → `/newbot` → copy the token → `TELEGRAM_BOT_TOKEN`.
2. Get your chat id (message **@userinfobot**) → `TELEGRAM_MANAGER_CHAT_ID`.
3. The `bot` service in `docker-compose.yml` runs it, or locally:
   ```bash
   python -m app.telegram.bot
   ```
4. Commands: `/stats`, `/today`, `/hot`, `/lead <id>`, `/status <id> <status>`,
   `/comment <id> <text>`, `/remind <id> <min> <text>`.

---

## 8. Deploy

### Option A — Render (one click)
1. Push this repo to GitHub.
2. **Render → New → Blueprint** → pick the repo. `render.yaml` provisions the
   web service, Celery worker, Redis and Postgres.
3. Fill the `sync: false` env vars (Meta + Telegram secrets) in the dashboard.
4. Deploy. Health check: `/health`.

### Option B — Railway
1. **Railway → New Project → Deploy from GitHub**.
2. Add **PostgreSQL** and **Redis** plugins (they inject `DATABASE_URL` / `REDIS_URL`).
3. Add the Meta/Telegram env vars. `railway.json` handles build + start.

### Option C — Docker Compose (self-host / VPS)
```bash
cp .env.example .env   # fill secrets
docker compose up -d --build
```

Migrations run automatically on container start (`entrypoint.sh → alembic upgrade head`).

---

## 9. How to run ads (high level)

1. **Create the Pixel & landing audiences** (§3, §5, §6).
2. In **Ads Manager → Create**, choose **Leads** objective for Lead Ads, or
   **Sales/Traffic** to drive traffic to your landing pages.
3. Target a Saved Audience from `/audiences/` or a Custom/Lookalike audience.
4. For Lead Ads, attach your **lead form** — submissions flow into the CRM via
   the webhook (§4).
5. Watch performance under **Campaigns** in the admin panel
   (**Sync from Meta** pulls impressions/clicks/spend).
6. Build a **Lookalike Paid Customers** audience once you have ≥100 paid leads.

---

## 10. Security checklist

- ✅ Secrets only in `.env` / platform env vars — never committed.
- ✅ Admin panel behind login (bcrypt-hashed password supported).
- ✅ Rate limiting (`slowapi`) on the API.
- ✅ Logs redact emails/phones (`PIIRedactingFilter`).
- ✅ Contacts hashed (SHA-256) before any Meta upload.
- ✅ Consent gate before any audience push.
- ✅ No scraping, no protection bypass — official APIs only.
