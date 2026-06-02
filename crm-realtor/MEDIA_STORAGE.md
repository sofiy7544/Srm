# Хранилище медиа (фото/видео/документы)

## Архитектура
`StorageService` — фасад с авто-выбором провайдера (интерфейс `StorageProvider`):

| Провайдер | Когда выбирается | Где файлы | URL |
|---|---|---|---|
| `S3StorageProvider` | задан `MINIO_ENDPOINT` или `AWS_S3_ENDPOINT` | MinIO/S3/R2 bucket | public-url или signed |
| `LocalStorageProvider` | иначе (дефолт) | диск `UPLOAD_DIR` | `<PUBLIC_BASE_URL>/uploads/<key>` |

Сменить бэкенд = задать env, код не меняется.

## Причина прошлой ошибки «Не удалось загрузить фото»
`StorageService` работал только через MinIO (`localhost:9000`). На Railway
MinIO нет → `PutObjectCommand` падал → 500 → фронт показывал ошибку.
Теперь без MinIO автоматически используется локальный диск.

## Railway — настройка (local storage, рекомендуется на старте)
1. Сервис **`Srm`** → **Variables**:
   ```
   UPLOAD_DIR=/data/uploads
   PUBLIC_BASE_URL=https://srm-production.up.railway.app
   ```
   (НЕ задавайте `MINIO_ENDPOINT` — тогда включится локальный режим)
2. Сервис **`Srm`** → **Settings → Volumes** → **Add Volume**,
   mount path = **`/data`** (тот же корень, что в `UPLOAD_DIR`).
   ⚠️ Без volume файлы исчезнут при следующем редеплое (контейнер эфемерный).
3. Redeploy.

Файлы будут доступны по `https://srm-production.up.railway.app/uploads/<key>`
(API раздаёт `/uploads` статикой; путь вне глобального префикса `/api`).

## Переключение на S3/R2 (когда объём вырастет)
Задать на сервисе `Srm`:
```
AWS_S3_ENDPOINT=https://<account>.r2.cloudflarestorage.com
AWS_REGION=auto
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
MINIO_PUBLIC_BUCKET=crm-public
MINIO_PRIVATE_BUCKET=crm-private
```
Код не меняется — `StorageService` сам поднимет `S3StorageProvider`.

## Лимиты и форматы
- Фото: JPG, PNG, WEBP, GIF, **HEIC/HEIF** (iPhone). Лимит **10 МБ**.
- Видео (`/api/uploads/media`): MP4, WEBM, MOV (quicktime). Лимит 80 МБ.
- Аудио (голосовые): webm/mp4/aac/mpeg/wav/ogg. Лимит 25 МБ.
- Превышение → HTTP 413 (не 500), человеческая ошибка на фронте.
- Пустой/повреждённый файл → 400 «Файл пустой или повреждён».
- Неподдерживаемый формат → 400 «Формат файла не поддерживается…».

## Nginx (если используется reverse proxy)
`client_max_body_size` уже = 50m в `nginx/nginx.conf`. Для видео >50МБ —
поднять до 100m. На Railway (без своего nginx) — лимит задаёт Multer.

## Видео (готово к расширению)
`/api/uploads/media` уже принимает видео через multipart (не base64, не в БД).
Для очень больших файлов — следующий шаг: presigned-upload (S3 multipart),
не входит в текущий фикс.
</content>
