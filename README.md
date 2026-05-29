# Realtor CRM

Self-hosted CRM для агентств недвижимости. Single-tenant MVP.

## Стек

- **Frontend**: Next.js 15 (App Router) + React 19 + Tailwind + shadcn/ui + next-intl (RU/UK)
- **Backend**: NestJS 10 + Prisma + Passport (JWT)
- **БД**: PostgreSQL 16 + Redis 7 + MinIO
- **Инфра**: Docker Compose, OrbStack (dev), GitHub Actions CI

## Структура

```
realtor-crm/
├── apps/
│   ├── api/              # NestJS backend
│   └── web/              # Next.js frontend
├── packages/
│   └── shared/           # Общие типы и zod-схемы
├── scripts/
│   └── backup.sh         # Резервное копирование БД
├── docker-compose.yml    # Postgres + Redis + MinIO
└── .env.example          # Переменные окружения
```

## Первый запуск

```bash
# 1. Создать .env из примера
cp .env.example .env

# 2. Установить зависимости
pnpm install

# 3. Поднять БД, Redis, MinIO
pnpm docker:up

# 4. Применить миграции и сидировать тестовые данные
pnpm --filter @crm/api run prisma:migrate
pnpm --filter @crm/api run prisma:seed

# 5. Запустить dev (web + api параллельно)
pnpm dev
```

После старта:

- Веб: http://localhost:3000
- API: http://localhost:3001/api
- API health: http://localhost:3001/api/health
- MinIO консоль: http://localhost:9001 (`minioadmin` / `minioadmin_dev`)

## Тестовые учётки (из сидов)

| Роль     | Email              | Пароль        |
|----------|--------------------|---------------|
| Админ    | admin@crm.local    | admin12345    |
| Риелтор  | realtor@crm.local  | realtor12345  |

## Полезные команды

```bash
pnpm dev                  # запуск web + api в dev режиме
pnpm build                # сборка всех приложений
pnpm typecheck            # проверка типов
pnpm lint                 # линтер

pnpm docker:up            # запуск контейнеров
pnpm docker:down          # остановка
pnpm docker:logs          # логи

pnpm db:migrate           # новая миграция Prisma
pnpm db:generate          # перегенерация Prisma Client
pnpm db:seed              # сидирование тестовых данных

./scripts/backup.sh       # бэкап БД в ./backups
```

## Поддержка языков

UI по умолчанию на русском. В правом верхнем углу — переключатель RU / UK.
Локали хранятся в `apps/web/src/messages/{ru,uk}.json`.

## Дорожная карта

Этап 0 (фундамент) — текущий. Дальше:

1. **Этап 1**: Аутентификация и роли — JWT, профиль, навигация
2. **Этап 2**: Клиенты + Объекты + фото + импорт CSV
3. **Этап 3**: Лиды + канбан + задачи + календарь показов
4. **Этап 4**: Коммуникации — Telegram, IG, FB Lead Ads, email
5. **Этап 5**: Автоматизации — автоназначение, напоминания
6. **Этап 6**: Сделки + комиссии + PDF-договоры
7. **Этап 7**: Аналитика + полировка + продакшн

Полный план: `~/.claude/plans/senior-full-stack-refactored-gray.md`
