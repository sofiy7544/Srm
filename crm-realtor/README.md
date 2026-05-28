# Realtor CRM

Self-hosted CRM для агентств недвижимости. Multi-language (RU/UK/EN/FR/IT).

## Стек

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui
- **Backend**: NestJS 10 + Prisma 5 + Passport JWT
- **БД**: PostgreSQL 16 + Redis 7 + MinIO (S3-compatible)
- **Инфра**: Docker Compose, GitHub Actions CI/CD

---

## Быстрый старт (локально)

```bash
# 1. Клонировать и перейти в директорию
git clone https://github.com/sofiy7544/Srm.git && cd Srm/crm-realtor

# 2. Установить зависимости
pnpm install

# 3. Создать .env
cp .env.example .env

# 4. Поднять БД, Redis, MinIO
pnpm docker:up          # docker compose up -d

# 5. Собрать shared-пакет, накатить миграции, засеять данные
pnpm --filter @crm/shared build
pnpm db:migrate
pnpm db:seed

# 6. Запустить dev-серверы
pnpm dev
```

| Сервис | URL |
|--------|-----|
| Web | http://localhost:3000 |
| API | http://localhost:3001/api |
| Health | http://localhost:3001/api/health |
| MinIO Console | http://localhost:9001 |

### Тестовые аккаунты

| Роль | Email | Пароль |
|------|-------|--------|
| Admin | admin@crm.local | admin12345 |
| Manager | manager@crm.local | manager12345 |
| Realtor | realtor@crm.local | realtor12345 |

---

## Деплой на Railway + Vercel (рекомендуется)

### Шаг 1 — Railway (API + БД + Redis)

1. Идёшь на [railway.app](https://railway.app) → войти через GitHub
2. **New Project** → **Deploy from GitHub repo** → выбрать `sofiy7544/Srm`
3. В настройках сервиса:
   - **Root Directory**: `crm-realtor`
   - **Dockerfile**: `apps/api/Dockerfile`
4. Добавить плагины: **PostgreSQL** и **Redis** (кнопка `+ New` → Database)
5. Перейти в **Variables** и добавить:

```
NODE_ENV=production
JWT_ACCESS_SECRET=<openssl rand -base64 48>
JWT_REFRESH_SECRET=<openssl rand -base64 48>
MINIO_ENDPOINT=<URL MinIO или оставить пустым для отключения>
RESEND_API_KEY=<ключ с resend.com>
DEFAULT_LOCALE=ru
```

Railway автоматически добавит `DATABASE_URL` и `REDIS_URL` из плагинов.

6. **Deploy** → через ~3 мин получаешь URL вида `https://crm-api-xxx.railway.app`

### Шаг 2 — Vercel (Frontend)

1. Идёшь на [vercel.com](https://vercel.com) → войти через GitHub
2. **New Project** → выбрать `sofiy7544/Srm`
3. Настройки:
   - **Framework**: Next.js
   - **Root Directory**: `crm-realtor/apps/web`
   - **Build Command**: `cd ../.. && pnpm --filter @crm/shared build && pnpm --filter @crm/web build`
   - **Install Command**: `cd ../.. && pnpm install --frozen-lockfile`
4. Environment Variables:
```
NEXT_PUBLIC_API_URL=https://crm-api-xxx.railway.app
NEXT_PUBLIC_DEFAULT_LOCALE=ru
```
5. **Deploy** → получаешь URL вида `https://crm-xxx.vercel.app`

### Шаг 3 — Обновить CORS в Railway

Добавить переменную:
```
WEB_ORIGIN=https://crm-xxx.vercel.app
```

---

## Деплой через Docker Compose (VPS)

```bash
# На сервере (Ubuntu 22+)
git clone https://github.com/sofiy7544/Srm.git && cd Srm/crm-realtor
cp .env.production.example .env
# Заполнить .env реальными значениями
nano .env

# Запуск
docker compose -f docker-compose.prod.yml up -d

# Проверка
curl http://localhost:3001/api/health
```

---

## Полезные команды

```bash
pnpm dev              # dev-серверы (web:3000, api:3001)
pnpm build            # production build всех пакетов
pnpm typecheck        # проверка TS
pnpm lint             # ESLint
pnpm test             # Jest

pnpm docker:up        # поднять инфраструктуру
pnpm docker:down      # остановить
pnpm docker:logs      # логи всех сервисов

pnpm db:migrate       # применить миграции
pnpm db:generate      # перегенерировать Prisma Client
pnpm db:seed          # залить демо-данные
```

---

## Структура проекта

```
crm-realtor/
├── apps/
│   ├── api/              # NestJS 10 backend (25 модулей)
│   └── web/              # Next.js 15 frontend
├── packages/
│   └── shared/           # Общие Zod-схемы и TypeScript enum'ы
├── nginx/                # Конфиг Nginx для продакшна
├── scripts/              # backup.sh, deploy.sh, restore.sh
├── docker-compose.yml    # Dev: postgres + redis + minio
├── docker-compose.prod.yml  # Production
├── render.yaml           # Render Blueprint
└── railway.json          # Railway config
```

---

## Обновление сайта после изменений

```bash
git add .
git commit -m "описание изменений"
git push origin main
# Railway и Vercel автоматически передеплоят через ~2-3 минуты
```

Для ручного передеплоя: Railway → сервис → **Redeploy**.
