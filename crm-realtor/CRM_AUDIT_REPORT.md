# CRM Audit Report — агентство недвижимости (5 сотрудников)

> Метод: чтение schema.prisma (37 моделей), 25 API-модулей, 37 страниц web,
> формы. Часть выводов опирается на уже сделанные в прошлых итерациях фичи.

## 1. Текущая структура (факт)
- **Contact = модель `Client`**: fullName, **type (BUYER/SELLER/BOTH)** ✅,
  primaryPhone (unique), email, `ClientContact[]` (мультиканал: WhatsApp/TG/
  Instagram/Viber/Email/Phone) ✅, `ClientPreferences` (бюджет/район/комнаты),
  assignedUser, source, GDPR-согласие. История — `Activity[]` ✅.
- **Lead** (отдельно от Client) ✅: clientId, sourceId, assignedUserId, stage,
  dealIntent (BUY/RENT), interestProperty/Note/Photo, priority, lostReason,
  stageChangedAt, lastActivityAt. Дедуп активного лида на клиента ✅.
- **Deal** ✅: lead/client/property/agent, amount, commission, stage, status.
- **Property** ✅: type, address, district, price, status, sellerClient ✅,
  priceHistory ✅, photos/video.
- **Task** ✅ (CALL/SHOWING/FOLLOWUP/CUSTOM, dueAt, status), **Showing** ✅,
  **Activity** ✅ (журнал), **AuditLog** ✅, **AutomationRule** + SLA-cron ✅.
- **Pool** нераспределённых лидов + claim ✅, **матчинг** клиент↔объект ✅.

## 2. Что работает хорошо
- Чёткое разделение Contact/Lead/Deal/Property/Task/Activity — не смешаны.
- Роли клиента (покупатель/продавец/оба), мультиканальные контакты.
- Пул лидов, claim, ролевое распределение, SLA-эскалация.
- Воронка 6 стадий (NEW→CONTACTED→QUALIFIED→SHOWING→NEGOTIATION→WON/LOST),
  причина проигрыша (lostReason).
- История общения (Activity), аудит мутаций, дедуп лидов.
- Reports: funnel, agents-рейтинг, team-workload, source-roi, lead-health.

## 3. Где нарушена логика / неудобно (находки)

### P0 — критично (ломает процесс создания лида)
| # | Проблема | Где |
|---|---|---|
| P0-1 | **Форма лида заставляет указывать «Интересующий объект»** (Из CRM / Своё описание) как центр. Большинство новых лидов не знают объект — это ошибка продукта. | `lead-form.tsx` |
| P0-2 | **Нет «Цели обращения»** (конкретный объект / подбор / продажа / аренда / консультация / изучает рынок). Сейчас только dealIntent BUY/RENT. | Lead-модель + форма |
| P0-3 | **Нет «срочности» (urgency)** — для продаж важнее адреса. | Lead-модель |
| P0-4 | **Нет бюджета на лиде** — есть только в ClientPreferences (отдельный путь). | Lead-модель |
| P0-5 | **Нет «следующего контакта» (nextActionAt)** — агент не видит «когда перезвонить». | Lead-модель |

### P1 — важно
- Несколько объектов на сделке (сейчас Deal.propertyId — один).
- Связанные контакты (муж/жена/представитель) — модели нет.
- Вероятность/прогноз сделки.
- Причины обращения для консультации (структурно).

### P2 — улучшения
- Saved searches, теги контактов, быстрые действия из карточки (звонок/TG/WA),
  единые пустые состояния (частично сделано), compact-режим списков.

## 4. Рекомендуемая модель (P0-дельта к Lead)
Добавить в `Lead` (всё опционально → старые лиды не ломаются):
- `purpose LeadPurpose?` — enum: SPECIFIC_OBJECT, SELECTION, SALE, RENT_OUT,
  CONSULTATION, BROWSING.
- `urgency LeadUrgency?` — enum: URGENT, THIS_WEEK, THIS_MONTH, THREE_MONTHS, JUST_LOOKING.
- `budgetMin Decimal?`, `budgetMax Decimal?`, `budgetCurrency String?`.
- `nextActionAt DateTime?` — дата следующего контакта (+ индекс для «Сегодня»).

## 5. Сценарии приёмки P0 (после реализации)
1. Новая заявка с телефона → контакт+лид за 30 сек, объект НЕ обязателен.
2. «Просто смотрю рынок» → лид с purpose=BROWSING, без объекта/сделки.
3. Бюджет до 150k EUR + район + срочность + след. звонок → сохраняется на лиде.
4. Лид в пул → любой из 5 берёт claim, руководитель видит (уже работает).
5. Руководитель назначает лид сотруднику (уже работает).

## 6. Риски миграции
- Все новые поля **nullable / с дефолтом** → существующие лиды валидны.
- `interestProperty/Note` сохраняются (purpose=SPECIFIC_OBJECT их использует) —
  обратная совместимость полная, ничего не удаляем.
</content>
