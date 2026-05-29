'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations, useLocale } from 'next-intl';
import {
  Plus,
  ChevronLeft,
  ChevronRight,
  Calendar as CalendarIcon,
  Filter as FilterIcon,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { MonthView } from '@/components/calendar/month-view';
import { TimeGridView } from '@/components/calendar/time-grid-view';
import { AgendaView } from '@/components/calendar/agenda-view';
import { EventForm } from '@/components/calendar/event-form';
import {
  fetchCalendarEvents,
  updateEventTiming,
  EVENT_KIND_TONE,
  type CalendarEvent,
  type CalendarEventKind,
} from '@/lib/calendar';
import { EVENT_KIND_ICON } from '@/components/calendar/event-pill';
import {
  addDays,
  addMonths,
  endOfWeek,
  monthGridRange,
  startOfWeek,
} from '@/lib/date-utils';
import { cn } from '@/lib/utils';

type ViewMode = 'month' | 'week' | 'day' | 'agenda';

const ALL = '__ALL__';

const ALL_KINDS: CalendarEventKind[] = [
  'SHOWING',
  'MEETING',
  'CALL',
  'TASK',
  'DEADLINE',
  'CONTRACT',
  'PAYMENT',
];

export default function CalendarPage() {
  const t = useTranslations('calendar');
  const tCommon = useTranslations('common');
  const locale = useLocale();

  const [view, setView] = useState<ViewMode>('month');
  const [cursor, setCursor] = useState<Date>(() => new Date());

  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterKind, setFilterKind] = useState<CalendarEventKind | typeof ALL>(ALL);

  const [formOpen, setFormOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [creatingAt, setCreatingAt] = useState<Date | null>(null);

  // Диапазон для загрузки — широкий, чтобы покрывал текущий view с запасом.
  const range = useMemo(() => {
    if (view === 'month') return monthGridRange(cursor);
    if (view === 'week') return { from: startOfWeek(cursor), to: endOfWeek(cursor) };
    if (view === 'day') return { from: cursor, to: cursor };
    // agenda — ближайший месяц с сегодня
    return { from: new Date(), to: addDays(new Date(), 30) };
  }, [view, cursor]);

  // Грузим события с небольшим запасом по краям диапазона.
  function reload() {
    setLoading(true);
    const padded = {
      from: addDays(range.from, -2),
      to: addDays(range.to, 2),
    };
    fetchCalendarEvents(padded)
      .then(setEvents)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [range.from.getTime(), range.to.getTime()]);

  const visibleEvents = useMemo(() => {
    if (filterKind === ALL) return events;
    return events.filter((e) => e.kind === filterKind);
  }, [events, filterKind]);

  const titleLabel = useMemo(() => {
    const monthsLong = (t.raw('monthsLong') as string[]) ?? [];
    if (view === 'month') {
      return `${monthsLong[cursor.getMonth()] ?? ''} ${cursor.getFullYear()}`;
    }
    if (view === 'week') {
      const ws = startOfWeek(cursor);
      const we = endOfWeek(cursor);
      const sameMonth = ws.getMonth() === we.getMonth();
      const fmt: Intl.DateTimeFormatOptions = sameMonth
        ? { day: 'numeric' }
        : { day: 'numeric', month: 'short' };
      const localeTag = locale === 'uk' ? 'uk-UA' : 'ru-RU';
      const from = ws.toLocaleDateString(localeTag, fmt);
      const to = we.toLocaleDateString(localeTag, { day: 'numeric', month: 'short', year: 'numeric' });
      return `${from} – ${to}`;
    }
    if (view === 'day') {
      const localeTag = locale === 'uk' ? 'uk-UA' : 'ru-RU';
      return cursor.toLocaleDateString(localeTag, {
        weekday: 'long',
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      });
    }
    return t('views.agenda');
  }, [view, cursor, locale, t]);

  function goPrev() {
    if (view === 'month') setCursor((c) => addMonths(c, -1));
    else if (view === 'week') setCursor((c) => addDays(c, -7));
    else if (view === 'day') setCursor((c) => addDays(c, -1));
  }
  function goNext() {
    if (view === 'month') setCursor((c) => addMonths(c, 1));
    else if (view === 'week') setCursor((c) => addDays(c, 7));
    else if (view === 'day') setCursor((c) => addDays(c, 1));
  }
  function goToday() {
    setCursor(new Date());
  }

  function openCreate(at?: Date) {
    setEditingEvent(null);
    setCreatingAt(at ?? defaultCreateSlot());
    setFormOpen(true);
  }
  function openEvent(ev: CalendarEvent) {
    setEditingEvent(ev);
    setCreatingAt(null);
    setFormOpen(true);
  }

  async function onEventChange(ev: CalendarEvent, next: { start: Date; end: Date }) {
    // оптимистично
    setEvents((prev) =>
      prev.map((e) => (e.id === ev.id ? { ...e, start: next.start, end: next.end } : e)),
    );
    try {
      await updateEventTiming(ev, next);
    } catch {
      reload();
    }
  }

  const counts = useMemo(() => {
    const m: Record<CalendarEventKind | 'ALL', number> = {
      ALL: events.length,
      SHOWING: 0,
      MEETING: 0,
      CALL: 0,
      TASK: 0,
      DEADLINE: 0,
      CONTRACT: 0,
      PAYMENT: 0,
    };
    for (const e of events) m[e.kind] += 1;
    return m;
  }, [events]);

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('total', { count: visibleEvents.length })}
          </p>
        </div>
        <Button onClick={() => openCreate()}>
          <Plus className="h-4 w-4" />
          {t('addNew')}
        </Button>
      </div>

      {/* Тулбар: навигация + переключатель режимов */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={goPrev}
            className="h-9 w-9 rounded-xl surface-card flex items-center justify-center hover:bg-muted transition-colors"
            aria-label={t('nav.prev')}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="h-9 px-3 rounded-xl surface-card text-xs font-medium tracking-tightish hover:bg-muted transition-colors"
          >
            {t('nav.today')}
          </button>
          <button
            type="button"
            onClick={goNext}
            className="h-9 w-9 rounded-xl surface-card flex items-center justify-center hover:bg-muted transition-colors"
            aria-label={t('nav.next')}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="ml-1 font-semibold tracking-tight2 text-base sm:text-lg first-letter:uppercase">
          {titleLabel}
        </div>

        <div className="ml-auto flex items-center gap-2">
          {/* Фильтр по типу */}
          <Select
            value={filterKind}
            onValueChange={(v) => setFilterKind(v as CalendarEventKind | typeof ALL)}
          >
            <SelectTrigger className="h-9 min-w-[160px]">
              <FilterIcon className="h-3.5 w-3.5 text-muted-foreground" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>
                {t('filters.allTypes')} · {counts.ALL}
              </SelectItem>
              {ALL_KINDS.map((k) => (
                <SelectItem key={k} value={k}>
                  {t(`types.${k}`)} · {counts[k]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Переключатель режимов */}
          <div className="flex gap-1 p-1 surface-card rounded-xl">
            {(['month', 'week', 'day', 'agenda'] as ViewMode[]).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                className={cn(
                  'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all whitespace-nowrap',
                  view === v
                    ? 'bg-primary text-primary-foreground shadow-glow'
                    : 'text-foreground/70 hover:bg-muted hover:text-foreground',
                )}
              >
                {t(`views.${v}`)}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Легенда типов событий — компактная под тулбаром */}
      <div className="flex items-center gap-3 flex-wrap text-2xs text-muted-foreground">
        {ALL_KINDS.map((k) => {
          const tone = EVENT_KIND_TONE[k];
          const Icon = EVENT_KIND_ICON[k];
          return (
            <div key={k} className="inline-flex items-center gap-1.5">
              <span className={cn('h-2 w-2 rounded-full', tone.dot)} />
              <Icon className={cn('h-3 w-3', tone.text)} />
              <span>{t(`types.${k}`)}</span>
            </div>
          );
        })}
      </div>

      {loading && events.length === 0 ? (
        <div className="surface-card p-12 text-center text-sm text-muted-foreground">
          <CalendarIcon className="h-8 w-8 mx-auto mb-2 opacity-60" />
          {tCommon('loading')}
        </div>
      ) : (
        <>
          {view === 'month' && (
            <MonthView
              cursor={cursor}
              events={visibleEvents}
              onEventClick={openEvent}
              onDateClick={(d) => {
                setCursor(d);
                setView('day');
              }}
              onCreateAt={(d) => openCreate(withTime(d, 10, 0))}
            />
          )}
          {view === 'week' && (
            <TimeGridView
              cursor={cursor}
              days={7}
              events={visibleEvents}
              onEventClick={openEvent}
              onCreateAt={openCreate}
              onEventChange={onEventChange}
            />
          )}
          {view === 'day' && (
            <TimeGridView
              cursor={cursor}
              days={1}
              events={visibleEvents}
              onEventClick={openEvent}
              onCreateAt={openCreate}
              onEventChange={onEventChange}
            />
          )}
          {view === 'agenda' && <AgendaView events={visibleEvents} onEventClick={openEvent} />}
        </>
      )}

      <EventForm
        open={formOpen}
        onClose={() => setFormOpen(false)}
        event={editingEvent}
        initialDate={creatingAt}
        onSaved={reload}
      />
    </div>
  );
}

function defaultCreateSlot(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function withTime(d: Date, h: number, m: number): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}
