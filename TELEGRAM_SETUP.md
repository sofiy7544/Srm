# Підключення Telegram до CRM

## Як це працює

```
Клієнт пише в Telegram-бота
        ↓
Telegram надсилає webhook на /api/telegram/webhook
        ↓
CRM знаходить або створює клієнта за chat_id
        ↓
Повідомлення з'являється в Lead Workspace → вкладка Telegram
        ↓
Відповідальний ріелтор отримує сповіщення
        ↓
Відповідає прямо з CRM — повідомлення іде назад через бот
```

---

## Крок 1 — Створіть бота

1. Відкрийте Telegram → знайдіть **@BotFather**
2. Надішліть `/newbot`
3. Введіть назву бота (наприклад: `Ваша Агенція Нерухомості`)
4. Введіть username (наприклад: `your_agency_bot`)
5. Скопіюйте **токен** — він виглядає як `1234567890:AAF...`

---

## Крок 2 — Налаштуйте змінні середовища

У файлі `.env` (або `.env.production`):

```env
TELEGRAM_BOT_TOKEN=1234567890:AAF...ваш_токен...
TELEGRAM_WEBHOOK_SECRET=случайная_строка_20_символов
```

Для генерації секрету:
```bash
openssl rand -hex 20
```

---

## Крок 3 — Зареєструйте webhook

Після деплою або локально (якщо є публічний URL), виконайте API-запит від імені адміністратора:

```http
POST /api/telegram/setup
Authorization: Bearer <admin_jwt>
Content-Type: application/json

{
  "webhookUrl": "https://your-crm-domain.com"
}
```

CRM автоматично додасть `/api/telegram/webhook` до URL і зареєструє його в Telegram.

### Перевірка статусу
```http
GET /api/telegram/status
Authorization: Bearer <admin_jwt>
```

Відповідь:
```json
{
  "configured": true,
  "botUsername": "your_agency_bot",
  "webhookUrl": "https://your-crm-domain.com/api/telegram/webhook",
  "pendingUpdateCount": 0
}
```

---

## Локальна розробка (ngrok)

Telegram вимагає HTTPS. Для локального тестування використовуйте [ngrok](https://ngrok.com):

```bash
ngrok http 3001
# → Forwarding: https://abc123.ngrok.io → http://localhost:3001

# Потім зареєструйте webhook:
curl -X POST http://localhost:3001/api/telegram/setup \
  -H "Authorization: Bearer <admin_token>" \
  -H "Content-Type: application/json" \
  -d '{"webhookUrl": "https://abc123.ngrok.io"}'
```

---

## Що відбувається при новому повідомленні

| Ситуація | Поведінка CRM |
|---|---|
| Відомий клієнт (вже є chat_id) | Повідомлення додається до його переписки |
| Новий контакт | Автоматично створюється клієнт + лід зі стадією NEW |
| Медіафайл без тексту | Ігнорується (на Phase 2) |
| Групові чати | Ігноруються (лише приватні повідомлення) |

---

## Відправка відповідей

З Lead Workspace (вкладка Telegram) введіть текст і натисніть Enter.  
Умова: у клієнта має бути збережений `chat_id` в `ClientContact`.  
Для нових клієнтів, що написали через бота, це встановлюється автоматично.

---

## Часті питання

**Клієнт написав, але лід не з'явився?**  
Перевірте `GET /api/telegram/status` → поле `lastError`. Зазвичай це проблема з webhook URL або токеном.

**Хочу прив'язати існуючого клієнта до Telegram?**  
Попросіть клієнта написати боту — CRM автоматично знайде відповідність. Або вручну додайте запис у `ClientContact` з `channel=TELEGRAM, identifier=<chat_id>`.

**Де знайти chat_id клієнта?**  
Він з'являється автоматично, коли клієнт пише боту першим. Також можна використати бота [@userinfobot](https://t.me/userinfobot).
