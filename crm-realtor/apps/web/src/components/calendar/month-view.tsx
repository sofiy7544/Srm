'use client';

import { useTranslations } from 'next-intl';
import {
  daysRange,
  isSameDay,
  isSameMonth,
  monthGridRange,
} from '@/lib/date-utils';
import { isOverdue, type CalendarEvent } from '@/lib/calendar';
import { EventPill } from './event-pill';
import { cn } from '@/lib/utils';

interface MonthViewProps {
  cursor: Date;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  /** Клик по дате — переключиться в режим "День". */
  onDateClick?: (date: Date) => void;
  /** Создать новое событие на этот день. */
  onCreateAt?: (date: Date) => void;
}

export function MonthView({ cursor, events, onEventClick, onDateClick, onCreateAt }: MonthViewProps) {
  const t = useTranslations('calendar');
  const weekdays = t.raw('weekdaysShort') as string[];

  const { from, to } = monthGridRange(cursor);
  const totalDays = Math.round((to.getTime() - from.getTime()) / (24 * 60 * 60 * 1000)) + 1;
  const days = daysRange(from, totalDays);

  // Группируем события по yyyy-mm-dd
  const byDay = new Map<string, CalendarEvent[]>();
  for (const ev of events) {
    const key = dayKey(ev.start);
    const arr = byDay.get(key) ?? [];
    arr.push(ev);
    byDay.set(key, arr);
  }

  const today = new Date();

  return (
    <div className="surface-card overflow-hidden">
      {/* шапка дней недели */}
      <div className="grid grid-cols-7 border-b bg-muted/30">
        {weekdays.map((w, i) => (
          <div
            key={i}
            className={cn(
              'py-2 text-2xs font-medium uppercase tracking-wide text-center text-muted-foreground',
              i >= 5 && 'text-foreground/60',
            )}
          >
            {w}
          </div>
        ))}
      </div>

      {/* сетка дней */}
      <div className="grid grid-cols-7 grid-rows-[repeat(auto-fill,minmax(110px,1fr))]">
        {days.map((d, i) => {
          const inMonth = isSameMonth(d, cursor);
          const isToday = isSameDay(d, today);
          const dayEvents = byDay.get(dayKey(d)) ?? [];
          const visible = dayEvents.slice(0, 3);
          const overflow = dayEvents.length - visible.length;
          const isWeekend = d.getDay() === 0 || d.getDay() === 6;

          return (
            <div
              key={i}
              className={cn(
                'min-h-[110px] border-r border-b p-1.5 flex flex-col gap-1 relative group',
                !inMonth && 'bg-muted/20',
                isWeekend && inMonth && 'bg-muted/10',
                isToday && 'bg-primary/[0.03]',
                (i + 1) % 7 === 0 && 'border-r-0',
              )}
            >
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => onDateClick?.(d)}
                  className={cn(
                    'h-6 min-w-6 px-1.5 rounded-md text-xs font-medium tabular-nums',
                    'hover:bg-muted transition-colors',
                    isToday
                      ? 'bg-primary text-primary-foreground shadow-glow'
                      : inMonth
                        ? 'text-foreground'
                        : 'text-muted-foreground/60',
                  )}
                >
                  {d.getDate()}
                </button>
                {onCreateAt && inMonth && (
                  <button
                    type="button"
                    onClick={() => onCreateAt(d)}
                    className="h-5 w-5 rounded text-muted-foreground opacity-0 group-hover:opacity-100 hover:bg-muted hover:text-foreground transition-all flex items-center justify-center text-base leading-none"
                    aria-label="Создать"
                  >
                    +
                  </button>
                )}
              </div>
              <div className="flex flex-col gap-0.5 overflow-hidden">
                {visible.map((ev) => (
                  <EventPill
                    key={ev.id}
                    event={ev}
                    variant="compact"
                    onClick={() => onEventClick(ev)}
                    className={cn(isOverdue(ev) && 'text-red-700')}
                  />
                ))}
                {overflow > 0 && (
                  <button
                    type="button"
                    onClick={() => onDateClick?.(d)}
                    className="text-3xs text-muted-foreground hover:text-foreground px-1.5 text-left"
                  >
                    {t('more', { count: overflow })}
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
