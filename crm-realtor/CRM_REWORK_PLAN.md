# CRM Rework Plan

## Этап 1 — Модель данных (P0)
- enum `LeadPurpose`, `LeadUrgency` в schema.prisma + shared/enums.
- Lead += purpose, urgency, budgetMin/Max, budgetCurrency, nextActionAt (+index).
- Миграция `--create-only` → deploy. Все поля nullable (совместимость).
- shared: createLeadSchema/updateLeadSchema += новые поля.

## Этап 2 — Лиды и контакты (P0)
- leads.service.create/update: принять и сохранить новые поля.
- lead-form.tsx: заменить блок «Интересующий объект» на «Цель обращения»
  (6 опций) с условными полями; добавить срочность, бюджет от/до, источник,
  ответственного, дату следующего контакта. Мобильный layout (без гор. скролла).
- Обратная совместимость: purpose=SPECIFIC_OBJECT использует существующие
  interestProperty/Note/Photo.

## Этап 3 — Сделки (P1, не в этой сессии)
- Несколько объектов на сделке (M2M Deal↔Property), вероятность/прогноз.

## Этап 4 — Объекты (готово ранее)
- sellerClient, priceHistory, матчинг — реализованы.

## Этап 5 — Задачи и календарь (P0-частично)
- nextActionAt на лиде → отображать в «Сегодня» (если останется время).

## Этап 6 — Руководитель (готово ранее)
- team-workload, agents, source-roi — есть.

## Этап 7 — Мобильный UX (P0)
- Форма лида: вертикальный stack, тач-таргеты, без горизонтального скролла.

## Этап 8 — Тестирование
- typecheck/lint/build, unit-тест на сохранение purpose/urgency/budget,
  E2E создания лида без объекта.

## Объём ЭТОЙ сессии: Этап 1 + 2 + 7 (P0), + тесты (Этап 8).
</content>
