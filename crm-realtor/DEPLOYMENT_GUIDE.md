# Deployment Guide

Production deployment of Real Estate CRM. Linux server (Ubuntu 22.04+ recommended) with Docker.

## 0. Prerequisites

- **Server**: 2 vCPU, 4 GB RAM, 40 GB SSD (handles ~10 realtors / 50 000 leads). Scale linearly from there.
- **OS**: Ubuntu 22.04 LTS (Debian 12 also works).
- **Domain**: pointed at the server's public IP (A-record).
- **Open ports**: 80, 443 (HTTP/HTTPS), 22 (SSH).
- **Email provider**: account at [Resend.com](https://resend.com) (free tier = 3 000 mails/month).

## 1. Server prep (10 min)

```bash
# As root or with sudo
apt update && apt upgrade -y
apt install -y curl git ufw

# Firewall
ufw allow ssh
ufw allow http
ufw allow https
ufw --force enable

# Docker
curl -fsSL https://get.docker.com | sh
systemctl enable --now docker

# Non-root user for deploy
adduser --gecos "" --disabled-password crm
usermod -aG docker crm
mkdir -p /home/crm/.ssh
cp ~/.ssh/authorized_keys /home/crm/.ssh/
chown -R crm:crm /home/crm/.ssh
chmod 600 /home/crm/.ssh/authorized_keys
```

Verify:

```bash
su - crm
docker run hello-world      # should print "Hello from Docker"
exit
```

## 2. Clone the repo

```bash
su - crm
cd ~
git clone https://github.com/YOUR_ORG/crm_project.git crm
cd crm
```

## 3. Configure environment

```bash
cp .env.production.example .env
nano .env
```

**Must fill** (everything marked `CHANGE_ME` / `REPLACE_WITH`):

| Variable | How to get it |
|---|---|
| `POSTGRES_PASSWORD` | `openssl rand -base64 32` |
| `MINIO_ROOT_PASSWORD` | `openssl rand -base64 32` |
| `JWT_ACCESS_SECRET` | `openssl rand -base64 48` |
| `JWT_REFRESH_SECRET` | `openssl rand -base64 48` *(different from access)* |
| `DATABASE_URL` | Match the `POSTGRES_PASSWORD` you set |
| `APP_URL` / `NEXT_PUBLIC_API_URL` / `WEB_ORIGIN` | All `https://yourdomain.com` |
| `RESEND_API_KEY` | From [resend.com/api-keys](https://resend.com/api-keys) |
| `EMAIL_FROM` | `noreply@yourdomain.com` (verify domain in Resend) |
| `TELEGRAM_BOT_TOKEN` / `TELEGRAM_WEBHOOK_SECRET` | Optional, can add later |

## 4. SSL certificates (Let's Encrypt)

```bash
# As root (or with sudo)
apt install -y certbot
certbot certonly --standalone -d yourdomain.com -d www.yourdomain.com \
  --email admin@yourdomain.com --agree-tos --no-eff-email

# Symlink certs into the repo's nginx/certs
mkdir -p /home/crm/crm/nginx/certs
ln -sf /etc/letsencrypt/live/yourdomain.com/fullchain.pem /home/crm/crm/nginx/certs/fullchain.pem
ln -sf /etc/letsencrypt/live/yourdomain.com/privkey.pem   /home/crm/crm/nginx/certs/privkey.pem
chown -R crm:crm /home/crm/crm/nginx/certs

# Auto-renew (already a systemd timer with certbot; double-check)
systemctl status certbot.timer
```

**Auto-reload nginx on renewal** — add this hook:

```bash
mkdir -p /etc/letsencrypt/renewal-hooks/deploy
cat >/etc/letsencrypt/renewal-hooks/deploy/reload-crm-nginx.sh <<'EOF'
#!/bin/sh
cd /home/crm/crm && docker compose -f docker-compose.prod.yml exec nginx nginx -s reload
EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-crm-nginx.sh
```

Edit `nginx/nginx.conf` and replace `yourdomain.com` (line 44) with your real domain.

## 5. First deploy

```bash
su - crm
cd ~/crm

# Build images + start everything
docker compose -f docker-compose.prod.yml up -d --build

# Wait for postgres healthcheck, then run migrations + seed
docker compose -f docker-compose.prod.yml exec api sh -c "cd apps/api && npx prisma migrate deploy"

# Optional: seed demo data (skip for empty production!)
# docker compose -f docker-compose.prod.yml exec api sh -c "cd apps/api && pnpm run prisma:seed"

# Health-check
curl -sf https://yourdomain.com/api/health
# → {"status":"ok","db":"ok","uptime":...,"timestamp":"..."}
```

## 6. Create first admin user

The seed creates `admin@crm.local` / `admin12345`. **Change immediately** in production:

1. Log in at https://yourdomain.com as `admin@crm.local`.
2. Go to **Settings → Users** → edit your row → set real email + reset password.
3. (Recommended) Disable the default admin: keep one real admin only.

For a fresh production install without seed data, create the first admin via Prisma directly:

```bash
docker compose -f docker-compose.prod.yml exec postgres psql -U crm -d crm <<'SQL'
INSERT INTO users (id, email, password_hash, full_name, role, locale, is_active, is_available, created_at, updated_at)
VALUES (
  gen_random_uuid(),
  'admin@yourdomain.com',
  -- argon2 hash of "ChangeMe123!" — generate your own with `node -e "require('argon2').hash('your-pwd').then(console.log)"`
  '$argon2id$v=19$m=65536,t=3,p=4$EXAMPLE_REPLACE_ME',
  'Admin User',
  'ADMIN',
  'uk',
  true,
  true,
  now(),
  now()
);
SQL
```

## 7. Set up nightly backups

```bash
crontab -e
```

Add:

```
0 3 * * * cd /home/crm/crm && ./scripts/backup.sh >> /home/crm/crm/backups/backup.log 2>&1
```

Or use the built-in compose profile:

```bash
docker compose -f docker-compose.prod.yml --profile backup run --rm backup
```

To restore from a dump:

```bash
./scripts/restore.sh ./backups/crm-2026-05-15_03-00-00.sql.gz
```

## 8. Telegram bot (optional, can do later)

```bash
# 1. Talk to @BotFather → /newbot → save token to .env as TELEGRAM_BOT_TOKEN
# 2. Generate secret:
openssl rand -hex 20      # paste to TELEGRAM_WEBHOOK_SECRET

# 3. Restart api with new env
docker compose -f docker-compose.prod.yml up -d api

# 4. Register webhook (admin only):
curl -X POST https://yourdomain.com/api/telegram/setup \
  -H "Content-Type: application/json" \
  -H "Cookie: $YOUR_AUTH_COOKIE" \
  -d '{"webhookUrl": "https://yourdomain.com/api/telegram/webhook"}'
```

## 9. Common operations

### Daily

```bash
# Tail logs
docker compose -f docker-compose.prod.yml logs -f api web --tail=100

# Health check
curl -sf https://yourdomain.com/api/health

# Restart a single service
docker compose -f docker-compose.prod.yml restart api
```

### Deploy an update (zero-downtime-ish)

```bash
cd ~/crm
./scripts/deploy.sh
```

This script: pulls git → pre-backup → builds → migrates → rolling restart → health-check.

### Roll back

```bash
# Stop everything
docker compose -f docker-compose.prod.yml down

# Restore the pre-deploy backup
./scripts/restore.sh ./backups/pre-deploy/crm-PRE-DEPLOY_*.sql.gz

# Check out the previous commit
git reset --hard HEAD~1

# Bring it back
docker compose -f docker-compose.prod.yml up -d --build
```

## 10. Monitoring

Minimum-viable monitoring (free):

1. **Uptime**: [UptimeRobot](https://uptimerobot.com) → monitor `https://yourdomain.com/api/health`, alert on non-200.
2. **Disk space**: cron `df -h | mail -s "Disk" admin@yourdomain.com` weekly.
3. **Logs**: `docker compose logs api web | grep ERROR` weekly.

Better:

- **Sentry** — set `SENTRY_DSN` in `.env`, errors go to your Sentry dashboard.
- **Grafana + Prometheus** — see `ADMIN_SETUP_GUIDE.md`.

## 11. Production checklist before going live

- [ ] All `CHANGE_ME` / `REPLACE_WITH` placeholders in `.env` are filled
- [ ] SSL cert is installed and `https://yourdomain.com` loads green-lock
- [ ] `curl https://yourdomain.com/api/health` returns `{"status":"ok"}`
- [ ] Default `admin@crm.local` password is changed or the user is deleted
- [ ] At least one real admin user is created
- [ ] Nightly backup cron is scheduled and verified once manually
- [ ] Resend domain is verified (so emails don't go to spam)
- [ ] Firewall is enabled (`ufw status`)
- [ ] Server time zone is correct (`timedatectl`) — matches `TZ` in `.env`
- [ ] Telegram webhook is registered (if using bot)

## 12. Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `curl /api/health` returns 502 | API container crashed | `docker compose -f docker-compose.prod.yml logs api --tail=80` |
| Postgres won't start | Old data dir permission | `docker compose -f docker-compose.prod.yml down -v` (wipes data!) then re-deploy. Restore from backup. |
| Emails not delivered | Resend domain not verified | https://resend.com/domains → verify yourdomain.com (DNS records) |
| Telegram bot silent | Webhook not set | Re-run step 8.4 above |
| `502 Bad Gateway` from nginx | Web container not ready | Wait 30s after first deploy; subsequent restarts are faster |
| SSL cert expired | Certbot timer failed | `certbot renew --force-renewal` then `docker compose exec nginx nginx -s reload` |
