# tg-sms-relay

Watches a **Telegram group** (no bot — it reads Telegram Web like a person
with the window open) for a trigger keyword, then sends an **SMS via a
browser-automated web panel** and reports the result back into the group.

> **Scope:** internal company notifications only. Do not use it to message
> people who haven't agreed to receive SMS, and only use a sender identity you
> are authorised to use.

## How it works

```
Telegram Web tab ──▶ trigger parser ──▶ SMS panel tab ──▶ report back to group
   (reads group)     (phone/text/from)   (fills & sends)     ("✅ SMS отправлен на …")
```

One persistent Chrome (Playwright) holds both tabs, so your Telegram and panel
logins are saved between runs.

## Stack

- **Express + TypeScript** — control/observability API
- **Playwright** — drives Chrome (Telegram Web + the SMS panel)
- **Zod** — validates configuration

## Setup

```bash
npm install
npx playwright install chromium      # first time only
cp .env.example .env                 # then edit .env (see below)
npm run login                        # opens Chrome: scan Telegram QR + log into the panel
npm run dev                          # starts watching
```

## Configuration (`.env`)

Everything panel- and message-specific lives in `.env` so no code changes are
needed to adapt it:

| Variable | What to set |
|----------|-------------|
| `TG_GROUP_TITLE` | Exact visible title of the group to watch |
| `TRIGGER_KEYWORD` | Word that must appear for a message to count (e.g. `SMS`) |
| `TRIGGER_REGEX` | Regex with named groups `<phone>`, `<from>`, `<text>` — match how your team writes messages |
| `SMS_PANEL_URL` | The send-SMS page of your panel |
| `SMS_SEL_PHONE` / `SMS_SEL_FROM` / `SMS_SEL_TEXT` / `SMS_SEL_SUBMIT` | CSS selectors for those form fields (**fill in for your panel**) |
| `SMS_SEL_SUCCESS` | Optional selector that only appears on success |
| `DRY_RUN` | `true` = run everything **except** the final submit (test safely) |

### Example trigger message

With the default `TRIGGER_REGEX`, a group message like this is matched:

```
SMS
Номер: +79991234567
От: Иван
Текст: Ваш заказ готов
```

## HTTP control API

| Method | Path | Purpose |
|--------|------|---------|
| GET | `/health` | Liveness check |
| GET | `/status` | Live stats (processed / sent / failed / last error) |
| POST | `/start` | Start the watcher pipeline |
| POST | `/stop` | Stop it |

## Notes on brittleness

- Telegram Web and SMS-panel markup change over time. If it stops seeing
  messages or filling fields, the selectors in `src/telegram/*.ts` and your
  `SMS_SEL_*` env values are the first place to look.
- Keep `DRY_RUN=true` until you've confirmed the form fills correctly, then
  flip it off to send for real.
