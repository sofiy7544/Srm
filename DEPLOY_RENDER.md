# Деплой Realtor CRM на Render (получение домена)

Это full-stack приложение (Next.js + NestJS + PostgreSQL + Redis), поэтому на
GitHub Pages оно работать не может — Pages отдаёт только статику. Самый быстрый
способ получить рабочий **домен бесплатно** — Render по готовому blueprint
(`render.yaml` в корне репозитория).

## Шаги

1. Зарегистрируйтесь на https://render.com (можно войти через GitHub).
2. **New +** → **Blueprint**.
3. Подключите репозиторий `sofiy7544/srm` и ветку `claude/crm-github-deploy-domain-M1cqq`
   (или `main`, если изменения уже влиты).
4. Render прочитает `render.yaml` и предложит создать сразу 4 ресурса:
   - `crm-db` — PostgreSQL 16 (free);
   - `crm-redis` — Redis (free);
   - `crm-api` — backend (Docker);
   - `crm-web` — frontend (Docker) — **это и есть ваш домен**.
5. Нажмите **Apply**. Первая сборка занимает ~5–10 минут.

## Ваш домен

После деплоя фронтенд будет доступен по адресу вида:

```
https://crm-web.onrender.com
```

(точный адрес показан в дашборде сервиса `crm-web`; если имя занято, Render
добавит суффикс, например `crm-web-ab12.onrender.com`).

## Если URL получился с суффиксом — поправьте 2 переменные

Адреса сервисов вшиваются в сборку/CORS, поэтому при нестандартном адресе:

1. В сервисе **crm-api** → Environment → `WEB_ORIGIN` = реальный URL `crm-web`.
2. В сервисе **crm-web** → Environment → `NEXT_PUBLIC_API_URL` = реальный URL `crm-api`,
   затем **Manual Deploy** (значение применяется только при пересборке Next.js).

## Первый вход

Заведите первого пользователя через сид или endpoint регистрации
(см. `ADMIN_SETUP_GUIDE.md`). Для прод-сида можно временно выполнить
`prisma:reset-to-production` в Shell сервиса `crm-api`.

## Своё доменное имя

В сервисе `crm-web` → **Settings → Custom Domains** добавьте свой домен и
пропишите CNAME у регистратора. Не забудьте обновить `WEB_ORIGIN` и
`NEXT_PUBLIC_API_URL` под новый адрес.

## Что не входит в этот blueprint

Загрузка файлов (MinIO/S3) не настроена — ядро CRM работает без неё. Для файлов
подключите внешний S3-совместимый бакет и добавьте соответствующие `AWS_*` /
`MINIO_*` переменные в сервис `crm-api`.

## Альтернативы

- **Railway** (`*.up.railway.app`) — тоже читает Docker, деплой из репозитория.
- **Vercel** для фронтенда (`*.vercel.app`) + Render для API — фронт быстрее,
  но настройка в два места.
- **Свой VPS** — через `docker-compose.prod.yml` + `nginx/` (см. `DEPLOYMENT_GUIDE.md`).
</content>
</invoke>
