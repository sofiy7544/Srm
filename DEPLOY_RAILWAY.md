# Деплой Realtor CRM на Railway

> ⚠️ **Сначала про триал.** Если в дашборде висит «Trial expired / Trial Ended»
> и «0/2 services online» — сервисы не запустятся, пока не нажмёшь **Upgrade now**
> (план Hobby, ~$5/мес). Это ограничение аккаунта Railway, а не конфига. Нужен
> полностью бесплатный домен — смотри `DEPLOY_RENDER.md` (Render free tier).

В репозитории уже есть всё для Railway:
- `apps/api/railway.json` и `apps/web/railway.json` — сборка через Dockerfile;
- Dockerfile'ы собирают из **корня репозитория** (там лежит pnpm-воркспейс).

## Архитектура проекта в Railway

Один проект, внутри 4 сервиса:

| Сервис    | Что это            | Источник                          |
|-----------|--------------------|-----------------------------------|
| Postgres  | БД                 | плагин Railway                    |
| Redis     | очереди BullMQ     | плагин Railway                    |
| `crm-api` | backend (NestJS)   | GitHub-репо, Dockerfile API       |
| `crm-web` | frontend (Next.js) | GitHub-репо, Dockerfile web       |

У тебя в проекте `superb-healing` уже есть Postgres и подключённый GitHub —
добавь Redis и второй сервис из того же репо.

## Настройка каждого сервиса (важно для монорепо)

Оба сервиса деплоятся из **одного** репозитория, поэтому в настройках каждого:

1. **Settings → Source → Root Directory** оставь `/` (корень репо — это и есть
   контекст сборки Docker; Dockerfile'ы делают `COPY` из корня).
2. **Settings → Config-as-code → Railway Config File**:
   - для backend-сервиса → `apps/api/railway.json`;
   - для frontend-сервиса → `apps/web/railway.json`.
3. **Settings → Networking → Generate Domain** — получишь
   `*.up.railway.app`. Для `crm-api`, если домен не цепляется,
   укажи target port вручную: `3001`.

## Переменные окружения

**crm-api** (Variables):
```
DATABASE_URL = ${{Postgres.DATABASE_URL}}
REDIS_URL    = ${{Redis.REDIS_URL}}
NODE_ENV     = production
JWT_ACCESS_SECRET  = <openssl rand -base64 48>
JWT_REFRESH_SECRET = <другой openssl rand -base64 48>
JWT_ACCESS_TTL  = 15m
JWT_REFRESH_TTL = 30d
WEB_ORIGIN = https://<домен crm-web>.up.railway.app
NEXT_PUBLIC_DEFAULT_LOCALE = ru
```
> Railway сам задаёт `PORT` — приложение его подхватывает (см. `main.ts`).

**crm-web** (Variables):
```
NEXT_PUBLIC_API_URL = https://<домен crm-api>.up.railway.app
NODE_ENV = production
```
> `NEXT_PUBLIC_API_URL` вшивается в сборку Next.js — после смены сделай Redeploy.

## Порядок

1. Подними Postgres и Redis (плагины).
2. Задеплой `crm-api`, сгенерируй домен.
3. Пропиши `NEXT_PUBLIC_API_URL` в `crm-web`, задеплой его, сгенерируй домен.
4. Впиши домен `crm-web` в `WEB_ORIGIN` у `crm-api`, Redeploy api (для CORS).
5. Открой домен `crm-web` — это твой адрес CRM.
</content>
</invoke>
