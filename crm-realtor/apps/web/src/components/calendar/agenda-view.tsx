'use client';

import { useTranslations } from 'next-intl';
import { Card } from '@/components/ui/card';
import { CalendarRange } from 'lucide-react';
import { type CalendarEvent } from '@/lib/calendar';
import { EventPill } from './event-pill';
import { formatDayLong, isSameDay } from '@/lib/date-utils';
import { useLocale } from 'next-intl';

interface AgendaViewProps {
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
}

export function AgendaView({ events, onEventClick }: AgendaViewProps) {
  const t = useTranslations('calendar');
  const locale = useLocale();

  if (events.length === 0) {
    return (
      <Card className="p-12 text-center text-sm text-muted-foreground">
        <CalendarRange className="h-8 w-8 mx-auto mb-2 opacity-60" />
        {t('agendaEmpty')}
      </Card>
    );
  }

  const grouped = groupByDay(events);
  const today = new Date();
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);

  return (
    <div className="space-y-5">
      {Array.from(grouped.entries()).map(([key, dayEvents]) => {
        const d = new Date(key);
        let header = formatDayLong(d, locale);
        if (isSameDay(d, today)) header = `${t('today')} · ${header}`;
        else if (isSameDay(d, tomorrow)) {
          const tomorrowLabel = locale === 'uk' ? 'Завтра' : 'Завтра';
          header = `${tomorrowLabel} · ${header}`;
        }

        return (
          <div key={key} className="space-y-2">
            <h3 className="text-xs font-medium uppercase tracking-wide text-muted-foreground sticky top-0 bg-background py-1 z-10">
              {header}
            </h3>
            <div className="grid gap-2">
              {dayEvents.map((ev) => (
                <EventPill key={ev.id} event={ev} variant="inline" onClick={() => onEventClick(ev)} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function groupByDay(events: CalendarEvent[]): Map<string, CalendarEvent[]> {
  const m = new Map<string, CalendarEvent[]>();
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());
  for (const ev of sorted) {
    const key = `${ev.start.getFullYear()}-${String(ev.start.getMonth() + 1).padStart(2, '0')}-${String(ev.start.getDate()).padStart(2, '0')}`;
    const arr = m.get(key) ?? [];
    arr.push(ev);
    m.set(key, arr);
  }
  return m;
}
