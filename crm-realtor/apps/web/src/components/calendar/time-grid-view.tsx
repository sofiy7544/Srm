'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  addMinutes,
  daysRange,
  diffMinutes,
  isSameDay,
  snapToMinutes,
  startOfDay,
  startOfWeek,
} from '@/lib/date-utils';
import { type CalendarEvent } from '@/lib/calendar';
import { EventPill } from './event-pill';
import { cn } from '@/lib/utils';

interface TimeGridViewProps {
  cursor: Date;
  /** 1 для day, 7 для week */
  days: 1 | 7;
  events: CalendarEvent[];
  onEventClick: (event: CalendarEvent) => void;
  onCreateAt?: (date: Date) => void;
  /** Колбэк при изменении времени события через drag / resize. */
  onEventChange?: (event: CalendarEvent, next: { start: Date; end: Date }) => void;
}

const HOUR_HEIGHT = 48; // px на час
const SNAP_MIN = 15;
const DAY_START_HOUR = 7; // в сетке показываем с 7 утра
const DAY_END_HOUR = 23; // до 23:00
const TOTAL_HOURS = DAY_END_HOUR - DAY_START_HOUR; // 16ч

type Drag =
  | { kind: 'move'; event: CalendarEvent; offsetY: number }
  | { kind: 'resize'; event: CalendarEvent; startTop: number };

export function TimeGridView({
  cursor,
  days,
  events,
  onEventClick,
  onCreateAt,
  onEventChange,
}: TimeGridViewProps) {
  const t = useTranslations('calendar');
  const weekdaysShort = t.raw('weekdaysShort') as string[];

  const start = days === 1 ? startOfDay(cursor) : startOfWeek(cursor);
  const cols = daysRange(start, days);

  const today = new Date();
  const [now, setNow] = useState(today);

  // Обновляем линию текущего времени каждую минуту.
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60_000);
    return () => window.clearInterval(id);
  }, []);

  // Группировка событий по дню.
  const eventsByDay = useMemo(() => {
    const m = new Map<string, CalendarEvent[]>();
    for (const ev of events) {
      const key = dayKey(ev.start);
      const arr = m.get(key) ?? [];
      arr.push(ev);
      m.set(key, arr);
    }
    return m;
  }, [events]);

  return (
    <div className="surface-card overflow-hidden">
      {/* шапка дней */}
      <div className="grid border-b" style={{ gridTemplateColumns: `56px repeat(${days}, 1fr)` }}>
        <div className="border-r" />
        {cols.map((d, i) => {
          const isToday = isSameDay(d, today);
          return (
            <div
              key={i}
              className={cn(
                'py-2.5 text-center border-r last:border-r-0',
                isToday && 'bg-primary/[0.04]',
              )}
            >
              <div className="text-3xs uppercase tracking-wide text-muted-foreground">
                {weekdaysShort[(d.getDay() + 6) % 7]}
              </div>
              <div
                className={cn(
                  'text-base font-semibold tabular-nums mt-0.5',
                  isToday && 'text-primary',
                )}
              >
                {d.getDate()}
              </div>
            </div>
          );
        })}
      </div>

      {/* тело: время + колонки дней */}
      <div className="relative overflow-auto max-h-[calc(100vh-280px)]">
        <div
          className="grid relative"
          style={{
            gridTemplateColumns: `56px repeat(${days}, 1fr)`,
            height: `${TOTAL_HOURS * HOUR_HEIGHT}px`,
          }}
        >
          {/* колонка времени */}
          <div className="border-r bg-muted/10">
            {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
              <div
                key={h}
                style={{ height: HOUR_HEIGHT }}
                className="text-3xs text-muted-foreground text-right pr-2 -mt-2 first:mt-0 tabular-nums"
              >
                {DAY_START_HOUR + h}:00
              </div>
            ))}
          </div>

          {/* дневные колонки */}
          {cols.map((d, idx) => (
            <DayColumn
              key={idx}
              date={d}
              events={eventsByDay.get(dayKey(d)) ?? []}
              now={now}
              onEventClick={onEventClick}
              onCreateAt={onCreateAt}
              onEventChange={onEventChange}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function DayColumn({
  date,
  events,
  now,
  onEventClick,
  onCreateAt,
  onEventChange,
}: {
  date: Date;
  events: CalendarEvent[];
  now: Date;
  onEventClick: (e: CalendarEvent) => void;
  onCreateAt?: (date: Date) => void;
  onEventChange?: (event: CalendarEvent, next: { start: Date; end: Date }) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [previewTop, setPreviewTop] = useState<number | null>(null);
  const [previewHeight, setPreviewHeight] = useState<number | null>(null);

  // Ref-ы — чтобы handlers внутри useEffect видели свежие preview-значения
  // без переподписки слушателей на каждое движение мыши.
  const previewTopRef = useRef<number | null>(null);
  const previewHeightRef = useRef<number | null>(null);
  useEffect(() => {
    previewTopRef.current = previewTop;
  }, [previewTop]);
  useEffect(() => {
    previewHeightRef.current = previewHeight;
  }, [previewHeight]);

  const isToday = isSameDay(date, now);
  const nowTop = isToday ? minutesToPx(timeOfDay(now)) : null;

  function yToTime(y: number): Date {
    const minutes = Math.max(0, Math.min(TOTAL_HOURS * 60, (y / HOUR_HEIGHT) * 60));
    const d = new Date(date);
    d.setHours(DAY_START_HOUR, 0, 0, 0);
    return snapToMinutes(addMinutes(d, minutes), SNAP_MIN);
  }

  function onMouseDownEvent(e: React.MouseEvent, ev: CalendarEvent, mode: 'move' | 'resize') {
    if (!ev.editable || !onEventChange) return;
    e.stopPropagation();
    e.preventDefault();
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;

    const top = minutesToPx(diffMinutes(dayStart(date), ev.start));
    const height = minutesToPx(diffMinutes(ev.start, ev.end));

    setPreviewTop(top);
    setPreviewHeight(height);
    previewTopRef.current = top;
    previewHeightRef.current = height;

    if (mode === 'move') {
      setDrag({ kind: 'move', event: ev, offsetY: e.clientY - rect.top - top });
    } else {
      setDrag({ kind: 'resize', event: ev, startTop: top });
    }
  }

  useEffect(() => {
    if (!drag) return;
    const currentDrag = drag;

    function onMove(e: MouseEvent) {
      const rect = ref.current?.getBoundingClientRect();
      if (!rect) return;
      const y = e.clientY - rect.top;
      if (currentDrag.kind === 'move') {
        const duration = diffMinutes(currentDrag.event.start, currentDrag.event.end);
        const newTop = snapPx(y - currentDrag.offsetY);
        setPreviewTop(newTop);
        setPreviewHeight(minutesToPx(duration));
        previewTopRef.current = newTop;
        previewHeightRef.current = minutesToPx(duration);
      } else {
        const newH = Math.max(minutesToPx(SNAP_MIN), snapPx(y - currentDrag.startTop));
        setPreviewHeight(newH);
        previewHeightRef.current = newH;
      }
    }
    function onUp() {
      const pt = previewTopRef.current;
      const ph = previewHeightRef.current;
      if (currentDrag.kind === 'move' && pt != null) {
        const start = yToTime(pt);
        const duration = diffMinutes(currentDrag.event.start, currentDrag.event.end);
        onEventChange?.(currentDrag.event, { start, end: addMinutes(start, duration) });
      } else if (currentDrag.kind === 'resize' && ph != null) {
        const newEndMin =
          diffMinutes(dayStart(date), currentDrag.event.start) + (ph / HOUR_HEIGHT) * 60;
        const endBase = new Date(date);
        endBase.setHours(DAY_START_HOUR, 0, 0, 0);
        const snappedEnd = snapToMinutes(addMinutes(endBase, newEndMin), SNAP_MIN);
        onEventChange?.(currentDrag.event, { start: currentDrag.event.start, end: snappedEnd });
      }
      setDrag(null);
      setPreviewTop(null);
      setPreviewHeight(null);
      previewTopRef.current = null;
      previewHeightRef.current = null;
    }
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    return () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag, date, onEventChange]);

  function onClickEmpty(e: React.MouseEvent) {
    if (!onCreateAt) return;
    if (e.target !== e.currentTarget) return;
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const y = e.clientY - rect.top;
    onCreateAt(yToTime(y));
  }

  return (
    <div
      ref={ref}
      onClick={onClickEmpty}
      className={cn('relative border-r last:border-r-0', isToday && 'bg-primary/[0.02]')}
    >
      {/* часовые направляющие */}
      {Array.from({ length: TOTAL_HOURS }).map((_, h) => (
        <div
          key={h}
          style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }}
          className="absolute inset-x-0 border-b border-border/40 pointer-events-none"
        />
      ))}

      {/* линия текущего времени */}
      {nowTop != null && (
        <div
          className="absolute inset-x-0 z-20 pointer-events-none"
          style={{ top: nowTop }}
        >
          <div className="relative h-px bg-red-500/80">
            <div className="absolute -left-1 -top-[3px] h-1.5 w-1.5 rounded-full bg-red-500" />
          </div>
        </div>
      )}

      {/* реальные события — с lane-разкладкой при пересечениях */}
      {layoutEvents(events).map(({ event: ev, lane, lanes }) => {
        if (drag && drag.event.id === ev.id) return null;
        const top = minutesToPx(diffMinutes(dayStart(date), ev.start));
        const height = Math.max(minutesToPx(SNAP_MIN), minutesToPx(diffMinutes(ev.start, ev.end)));
        // Each event occupies 1/lanes of the column width; lane index gives left offset.
        // 2px gutter on the right to keep cards visually separated.
        const widthPct = 100 / lanes;
        const leftPct = lane * widthPct;
        return (
          <div
            key={ev.id}
            className="absolute"
            style={{
              top,
              height,
              left: `calc(${leftPct}% + 2px)`,
              width: `calc(${widthPct}% - 4px)`,
            }}
          >
            <EventPill
              event={ev}
              variant="block"
              onClick={() => onEventClick(ev)}
              style={{ top: 0, bottom: 0, height: '100%', position: 'absolute' }}
            />
            {ev.editable && onEventChange && (
              <>
                <div
                  className="absolute top-0 inset-x-1 h-3 cursor-grab active:cursor-grabbing"
                  onMouseDown={(e) => onMouseDownEvent(e, ev, 'move')}
                />
                <div
                  className="absolute bottom-0 inset-x-1 h-2 cursor-ns-resize"
                  onMouseDown={(e) => onMouseDownEvent(e, ev, 'resize')}
                />
              </>
            )}
          </div>
        );
      })}

      {/* preview во время drag */}
      {drag && previewTop != null && previewHeight != null && (
        <div
          className="absolute inset-x-1 rounded-md border-2 border-primary/60 bg-primary/10 pointer-events-none"
          style={{ top: previewTop, height: previewHeight }}
        />
      )}
    </div>
  );
}

function dayStart(d: Date): Date {
  const out = new Date(d);
  out.setHours(DAY_START_HOUR, 0, 0, 0);
  return out;
}

function timeOfDay(d: Date): number {
  return (d.getHours() - DAY_START_HOUR) * 60 + d.getMinutes();
}

function minutesToPx(min: number): number {
  return (min / 60) * HOUR_HEIGHT;
}

function snapPx(px: number): number {
  const pxPerSnap = (SNAP_MIN / 60) * HOUR_HEIGHT;
  return Math.max(0, Math.round(px / pxPerSnap) * pxPerSnap);
}

function dayKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Lane assignment for overlapping events (Google-Calendar style).
 *
 * 1. Sort events by start time.
 * 2. For each event, find the first lane whose latest end-time is ≤ this start.
 * 3. If none, create a new lane.
 * 4. After pass, every event knows its lane index AND how many lanes its
 *    overlap-cluster needed (so all events in a cluster share the same divisor).
 */
function layoutEvents(events: CalendarEvent[]): { event: CalendarEvent; lane: number; lanes: number }[] {
  if (events.length === 0) return [];
  const sorted = [...events].sort((a, b) => a.start.getTime() - b.start.getTime());

  // Group into clusters of overlapping events.
  type Cluster = { events: CalendarEvent[]; lanes: Date[] };
  const clusters: Cluster[] = [];
  let current: Cluster | null = null;
  for (const ev of sorted) {
    if (current && ev.start.getTime() < Math.max(...current.events.map((e) => e.end.getTime()))) {
      current.events.push(ev);
    } else {
      if (current) clusters.push(current);
      current = { events: [ev], lanes: [] };
    }
  }
  if (current) clusters.push(current);

  // Within each cluster, greedy-assign each event to the first free lane.
  const result: { event: CalendarEvent; lane: number; lanes: number }[] = [];
  for (const cluster of clusters) {
    const laneEnds: number[] = []; // index = lane, value = ms of last event's end
    const assignments: { event: CalendarEvent; lane: number }[] = [];
    for (const ev of cluster.events) {
      const startMs = ev.start.getTime();
      let lane = laneEnds.findIndex((endMs) => endMs <= startMs);
      if (lane === -1) {
        lane = laneEnds.length;
        laneEnds.push(ev.end.getTime());
      } else {
        laneEnds[lane] = ev.end.getTime();
      }
      assignments.push({ event: ev, lane });
    }
    const totalLanes = laneEnds.length;
    for (const a of assignments) {
      result.push({ ...a, lanes: totalLanes });
    }
  }
  return result;
}
