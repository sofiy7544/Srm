'use client';

import {
  showings,
  tasks,
  deals,
  type ShowingRow,
  type TaskRow,
  type DealRow,
  type PaymentRow,
} from '@/lib/api';

/**
 * Унифицированный тип события календаря.
 *
 * События — это проекция уже существующих сущностей CRM:
 *   SHOWING  ← Showing             (просмотр объекта)
 *   TASK     ← Task (CUSTOM/FOLLOWUP/SHOWING/CALL)
 *   CALL     ← Task type=CALL       (звонок)
 *   DEADLINE ← Task где dueAt < now и status != DONE (overdue) — выделяется отдельно
 *   MEETING  ← Task type=CUSTOM/FOLLOWUP с продолжительностью в notes
 *   CONTRACT ← Deal.closedAt        (договор закрыт)
 *   PAYMENT  ← Payment.paidAt       (оплата)
 *
 * Это даёт сразу 7 типов событий без новых таблиц в БД,
 * без новых endpoint-ов и без расхождения с остальной CRM.
 */
export type CalendarEventKind =
  | 'SHOWING'
  | 'MEETING'
  | 'CALL'
  | 'TASK'
  | 'DEADLINE'
  | 'CONTRACT'
  | 'PAYMENT';

export type CalendarEventStatus =
  | 'SCHEDULED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW'
  | 'PENDING'
  | 'DONE'
  | 'OVERDUE'
  | 'IN_PROGRESS';

export type CalendarSource = 'showing' | 'task' | 'deal' | 'payment';

export interface CalendarEvent {
  id: string;
  source: CalendarSource;
  /** id оригинальной записи (showing/task/deal/payment) */
  refId: string;
  kind: CalendarEventKind;
  title: string;
  start: Date;
  end: Date;
  status: CalendarEventStatus;
  notes?: string | null;
  /** Может ли календарь самостоятельно править событие (drag/edit/resize). */
  editable: boolean;
  client?: { id: string; fullName: string } | null;
  property?: { id: string; address: string; district: string } | null;
  manager?: { id: string; fullName: string } | null;
  /** Связанная сделка/лид — для прохода в детальную страницу. */
  relatedDealId?: string | null;
  relatedLeadId?: string | null;
  amount?: number | null;
  currency?: string | null;
}

export const EVENT_KIND_TONE: Record<
  CalendarEventKind,
  { bg: string; text: string; dot: string; border: string }
> = {
  // Используем те же оттенки, что и канбан leads — единый язык цвета.
  SHOWING: {
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    dot: 'bg-amber-500',
    border: 'border-amber-200',
  },
  MEETING: {
    bg: 'bg-violet-50',
    text: 'text-violet-700',
    dot: 'bg-violet-500',
    border: 'border-violet-200',
  },
  CALL: {
    bg: 'bg-blue-50',
    text: 'text-blue-700',
    dot: 'bg-blue-500',
    border: 'border-blue-200',
  },
  TASK: {
    bg: 'bg-sky-50',
    text: 'text-sky-700',
    dot: 'bg-sky-500',
    border: 'border-sky-200',
  },
  DEADLINE: {
    bg: 'bg-red-50',
    text: 'text-red-700',
    dot: 'bg-red-500',
    border: 'border-red-200',
  },
  CONTRACT: {
    bg: 'bg-emerald-50',
    text: 'text-emerald-700',
    dot: 'bg-emerald-500',
    border: 'border-emerald-200',
  },
  PAYMENT: {
    bg: 'bg-indigo-50',
    text: 'text-indigo-700',
    dot: 'bg-indigo-500',
    border: 'border-indigo-200',
  },
};

export function isOverdue(ev: CalendarEvent): boolean {
  if (ev.kind === 'DEADLINE') return true;
  const isOpen =
    ev.status === 'SCHEDULED' || ev.status === 'PENDING' || ev.status === 'IN_PROGRESS';
  return isOpen && ev.end.getTime() < Date.now();
}

/* ─── маппинг из API-сущностей в события ──────────────────────────── */

function showingToEvent(s: ShowingRow): CalendarEvent {
  const start = new Date(s.scheduledAt);
  const end = new Date(start.getTime() + s.durationMin * 60_000);
  return {
    id: `showing:${s.id}`,
    source: 'showing',
    refId: s.id,
    kind: 'SHOWING',
    title: s.property?.address ?? 'Показ',
    start,
    end,
    status: s.status,
    notes: s.feedback,
    editable: true,
    client: s.client ? { id: s.client.id, fullName: s.client.fullName } : null,
    property: s.property ?? null,
    manager: s.agent ? { id: s.agent.id, fullName: s.agent.fullName } : null,
    relatedDealId: null,
    relatedLeadId: null,
    amount: null,
    currency: null,
  };
}

function taskToEvent(t: TaskRow): CalendarEvent {
  const start = new Date(t.dueAt);
  // Задача — точечное событие. Для отображения в сетке времени дадим 30 мин слот.
  const end = new Date(start.getTime() + 30 * 60_000);

  // Маппим TaskType (CALL/SHOWING/FOLLOWUP/CUSTOM) на тип события календаря.
  let kind: CalendarEventKind;
  if (t.status === 'OVERDUE') kind = 'DEADLINE';
  else if (t.type === 'CALL') kind = 'CALL';
  else if (t.type === 'SHOWING') kind = 'SHOWING';
  else if (t.type === 'FOLLOWUP') kind = 'MEETING';
  else kind = 'TASK';

  return {
    id: `task:${t.id}`,
    source: 'task',
    refId: t.id,
    kind,
    title: t.title,
    start,
    end,
    status: t.status,
    notes: t.description,
    editable: true,
    client: t.client ?? null,
    property: null,
    manager: t.user ?? null,
    relatedDealId: null,
    relatedLeadId: t.lead?.id ?? null,
    amount: null,
    currency: null,
  };
}

function dealToEvent(d: DealRow): CalendarEvent | null {
  if (!d.closedAt) return null;
  const start = new Date(d.closedAt);
  const end = new Date(start.getTime() + 60 * 60_000);
  return {
    id: `deal:${d.id}`,
    source: 'deal',
    refId: d.id,
    kind: 'CONTRACT',
    title: d.property?.address ?? 'Договор',
    start,
    end,
    status: d.status,
    notes: null,
    editable: false, // дата закрытия сделки правится только в карточке сделки
    client: d.client ? { id: d.client.id, fullName: d.client.fullName } : null,
    property: d.property ?? null,
    manager: d.agent ? { id: d.agent.id, fullName: d.agent.fullName } : null,
    relatedDealId: d.id,
    relatedLeadId: d.leadId ?? null,
    amount: typeof d.amount === 'string' ? parseFloat(d.amount) : d.amount,
    currency: 'EUR',
  };
}

function paymentToEvent(p: PaymentRow, deal?: DealRow): CalendarEvent {
  const start = new Date(p.paidAt);
  const end = new Date(start.getTime() + 30 * 60_000);
  const amountNum = typeof p.amount === 'string' ? parseFloat(p.amount) : p.amount;
  return {
    id: `payment:${p.id}`,
    source: 'payment',
    refId: p.id,
    kind: 'PAYMENT',
    title: deal?.property?.address
      ? `${deal.property.address}`
      : p.note ?? 'Платёж',
    start,
    end,
    status: 'COMPLETED',
    notes: p.note,
    editable: false,
    client: deal?.client ? { id: deal.client.id, fullName: deal.client.fullName } : null,
    property: deal?.property ?? null,
    manager: p.user ? { id: p.user.id, fullName: p.user.fullName } : null,
    relatedDealId: p.dealId,
    relatedLeadId: deal?.leadId ?? null,
    amount: amountNum,
    currency: 'EUR',
  };
}

/* ─── публичный загрузчик ────────────────────────────────────────── */

export async function fetchCalendarEvents(range: {
  from: Date;
  to: Date;
}): Promise<CalendarEvent[]> {
  const fromIso = range.from.toISOString();
  const toIso = range.to.toISOString();

  // Параллельные запросы. Если какой-то модуль вернёт 5xx — пусть не валит весь календарь.
  const [showingsRes, tasksRes, dealsRes] = await Promise.allSettled([
    showings.list({ from: fromIso, to: toIso }),
    tasks.list({}),
    deals.list({ pageSize: 100 }),
  ]);

  const events: CalendarEvent[] = [];

  if (showingsRes.status === 'fulfilled') {
    events.push(...showingsRes.value.map(showingToEvent));
  }

  if (tasksRes.status === 'fulfilled') {
    for (const t of tasksRes.value.items) {
      const due = new Date(t.dueAt);
      // фильтруем по диапазону на клиенте (у tasks нет from/to в API)
      if (due >= range.from && due <= range.to) {
        events.push(taskToEvent(t));
      }
    }
  }

  // Сделки и платежи: closedAt и paidAt должны попадать в диапазон
  if (dealsRes.status === 'fulfilled') {
    const allDeals = dealsRes.value.items;
    for (const d of allDeals) {
      const evt = dealToEvent(d);
      if (evt && evt.start >= range.from && evt.start <= range.to) {
        events.push(evt);
      }
      for (const p of d.payments ?? []) {
        const paid = new Date(p.paidAt);
        if (paid >= range.from && paid <= range.to) {
          events.push(paymentToEvent(p, d));
        }
      }
    }
  }

  return events.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/* ─── обновления (drag/resize) ───────────────────────────────────── */

export async function updateEventTiming(
  ev: CalendarEvent,
  next: { start: Date; end: Date },
): Promise<void> {
  if (!ev.editable) return;
  if (ev.source === 'showing') {
    const durationMin = Math.max(
      5,
      Math.round((next.end.getTime() - next.start.getTime()) / 60_000),
    );
    await showings.update(ev.refId, {
      scheduledAt: next.start.toISOString(),
      durationMin,
    });
  } else if (ev.source === 'task') {
    await tasks.update(ev.refId, { dueAt: next.start.toISOString() });
  }
}

export async function deleteEvent(ev: CalendarEvent): Promise<void> {
  if (ev.source === 'showing') await showings.remove(ev.refId);
  else if (ev.source === 'task') await tasks.remove(ev.refId);
}
