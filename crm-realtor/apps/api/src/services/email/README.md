# Email Integration (Resend)

Production-grade transactional email layer for the Realtor CRM, built on top of [Resend](https://resend.com).

## Architecture

```
apps/api/src/services/email/
├── email.config.ts          # Centralized env-driven config + token TTLs
├── email.service.ts         # Public API — template-based + legacy raw HTML
├── email.queue.ts           # BullMQ queue + worker (separate from automation)
├── email-token.service.ts   # Secure token gen / hash / verify
├── email.module.ts          # @Global() Nest module
├── providers/
│   └── resend.provider.ts   # Resend SDK wrapper with timeout
├── templates/
│   ├── template.renderer.ts # Handlebars renderer + plaintext fallback
│   ├── partials/layout.hbs  # Shared premium HTML layout (Apple/Linear style)
│   ├── welcome.hbs
│   ├── verify-email.hbs
│   ├── reset-password.hbs
│   ├── login-alert.hbs
│   └── team-invitation.hbs
└── types/email.types.ts     # Typed template variables
```

## Setup

1. Set `RESEND_API_KEY` and `EMAIL_FROM` in `.env` (see `.env.example`).
2. Run `pnpm db:migrate` — adds `email_logs`, `email_verification_tokens`,
   `password_reset_tokens`, `team_invitations`, and new `User` fields.
3. Run `pnpm --filter @crm/api install` to pull `resend@^4`.
4. Start the API: `pnpm dev`.

If `RESEND_API_KEY` is unset, the service runs in **no-op mode** and logs a
warning — useful for local dev and CI.

## Sending email — preferred API

```ts
// Anywhere a service is injectable:
constructor(private readonly email: EmailService) {}

await this.email.sendTemplate({
  to: 'user@example.com',
  template: 'welcome',
  variables: { fullName: 'Alex', ctaUrl: 'https://app/dashboard' },
});
```

The send is **enqueued** to BullMQ (`crm-email` queue) and processed by a
worker with exponential backoff (5 attempts, 2s base delay). Failures are
logged to the `email_logs` table with the full error message.

Set `EMAIL_SYNC=true` to send inline (useful for tests / scripted flows).

## Available templates

| Template          | Trigger                                                | Variables                                                                |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------------------------ |
| `welcome`         | After registration                                     | `fullName`, `ctaUrl`                                                     |
| `verify-email`    | After registration / on resend                         | `fullName`, `verifyUrl`, `expiresInHours`                                |
| `reset-password`  | `POST /auth/forgot-password`                           | `fullName`, `resetUrl`, `expiresInMinutes`, `requestIp?`                 |
| `login-alert`     | Every login except the first                           | `fullName`, `loginAt`, `ip?`, `userAgent?`, `location?`, `secureUrl`     |
| `team-invitation` | `POST /invitations` (ADMIN)                            | `inviterName`, `inviterEmail`, `inviteeEmail`, `role`, `acceptUrl`, `expiresInDays` |

All templates inherit the shared `layout.hbs` — dark-mode aware, responsive
down to 320px, with both an inline CTA button and a copy-paste URL fallback.

## Endpoints

| Method | Path                          | Auth   | Purpose                                  |
| ------ | ----------------------------- | ------ | ---------------------------------------- |
| POST   | `/auth/register`              | public | Creates user, sends verify + welcome     |
| POST   | `/auth/login`                 | public | Logs in, sends login alert (after 1st)   |
| POST   | `/auth/verify-email`          | public | `{ token }` → marks email verified       |
| POST   | `/auth/resend-verification`   | public | `{ email }` → resends verify email       |
| POST   | `/auth/forgot-password`       | public | `{ email }` → sends reset link           |
| POST   | `/auth/reset-password`        | public | `{ token, password }` → rotates password |
| POST   | `/invitations`                | ADMIN  | `{ email, role }` → invites a teammate   |
| GET    | `/invitations`                | ADMIN  | List all invitations                     |
| DELETE | `/invitations/:id`            | ADMIN  | Revoke pending invitation                |
| POST   | `/invitations/accept`         | public | `{ token, password, fullName }` → joins  |

## Security

- **Tokens**: 256-bit random (`crypto.randomBytes(32).toString('base64url')`),
  only the SHA-256 hash is stored. Comparison uses `timingSafeEqual`.
- **TTLs**: verification 24h, password reset 30 min, invitations 7 days.
- **Single-use**: verify and reset tokens are marked `used_at` after success;
  all other unused tokens for the same user are invalidated.
- **Refresh-token invalidation**: a successful password reset revokes every
  active refresh token, forcing re-login on all devices.
- **No enumeration**: `forgot-password` and `resend-verification` always
  return `202` regardless of whether the address is registered.
- **Rate limiting**: applied via `@nestjs/throttler` on all email endpoints
  (5–30 req/min depending on sensitivity).
- **Validation**: zod schemas at the controller boundary, RFC-ish email
  regex at the provider boundary.
- **Timeout**: 10s hard timeout around every Resend SDK call.
- **Retry**: 3 inline retries with exponential backoff for transient errors,
  plus BullMQ-level retries (5 attempts) for queued sends.

## Observability

Every template send creates an `EmailLog` row:

```sql
SELECT template, status, COUNT(*)
FROM email_logs
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY 1, 2;
```

Statuses: `QUEUED` → `SENT` (with `provider_id`) or `FAILED` (with `error_message`).
The `attempts` counter increments on every retry.

## Adding a new template

1. Add the name to `EmailTemplateName` in `types/email.types.ts`.
2. Add a typed variables interface and wire it into `EmailTemplateVars`.
3. Create `templates/<name>.hbs` (body only — the layout wraps it).
4. Add a subject builder to `SUBJECTS` in `template.renderer.ts`.
5. Add `<name>` to the `templateNames` array in `template.renderer.ts`.

## Domain verification (production)

The default sender `onboarding@resend.dev` is a sandbox address; messages
sent through it may only deliver to your own verified Resend account email.
For production, verify your domain in the Resend Dashboard, then set
`EMAIL_FROM=hello@yourdomain.com` and an appropriate `EMAIL_FROM_NAME`.
