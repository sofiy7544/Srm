'use client';

import { useTranslations } from 'next-intl';
import { Phone, Eye, FileText, FileSignature, Wallet, Users, AlertTriangle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { EVENT_KIND_TONE, isOverdue, type CalendarEvent, type CalendarEventKind } from '@/lib/calendar';
import { formatTime } from '@/lib/date-utils';

export const EVENT_KIND_ICON: Record<CalendarEventKind, React.ComponentType<{ className?: string }>> = {
  SHOWING: Eye,
  MEETING: Users,
  CALL: Phone,
  TASK: FileText,
  DEADLINE: AlertTriangle,
  CONTRACT: FileSignature,
  PAYMENT: Wallet,
};

interface EventPillProps {
  event: CalendarEvent;
  variant?: 'block' | 'inline' | 'compact';
  onClick?: () => void;
  className?: string;
  /** Если задан, отображается как absolute-блок (для week/day грид-сетки) */
  style?: React.CSSProperties;
}

/**
 * Универсальная "пилюля" события — используется в month, week, day и agenda.
 * Цветовая схема и форма одинаковая, меняется только плотность.
 */
export function EventPill({
  event,
  variant = 'inline',
  onClick,
  className,
  style,
}: EventPillProps) {
  const t = useTranslations('calendar');
  const tone = EVENT_KIND_TONE[event.kind];
  const Icon = EVENT_KIND_ICON[event.kind];
  const overdue = isOverdue(event);
  const done = event.status === 'COMPLETED' || event.status === 'DONE';

  if (variant === 'compact') {
    // dot + время + title — для month view
    return (
      <button
        type="button"
        onClick={onClick}
        className={cn(
          'group w-full flex items-center gap-1 px-1.5 py-0.5 rounded text-2xs leading-tight text-left',
          'hover:bg-muted transition-colors',
          done && 'opacity-60',
          className,
        )}
        title={event.title}
      >
        <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', tone.dot)} />
        <span className="tabular-nums text-muted-foreground shrink-0">{formatTime(event.start)}</span>
        <span className={cn('truncate font-medium', done && 'line-through')}>
          {event.title || t('noTitle')}
        </span>
      </button>
    );
  }

  if (variant === 'block') {
    // absolute-позиционированный блок (week/day) с цветной заливкой
    return (
      <button
        type="button"
        onClick={onClick}
        style={style}
        className={cn(
          'absolute inset-x-1 rounded-md text-left overflow-hidden border',
          'px-1.5 py-1 text-2xs leading-tight transition-shadow hover:shadow-soft',
          tone.bg,
          tone.text,
          overdue ? 'border-red-300' : tone.border,
          done && 'opacity-60',
          className,
        )}
      >
        <div className="flex items-center gap-1 font-medium">
          <Icon className="h-3 w-3 shrink-0" />
          <span className="truncate">{event.title || t('noTitle')}</span>
        </div>
        <div className="text-3xs opacity-80 tabular-nums">
          {formatTime(event.start)}–{formatTime(event.end)}
        </div>
      </button>
    );
  }

  // inline (agenda)
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'group w-full flex items-start gap-3 p-3 rounded-xl border bg-surface text-left transition-all',
        'hover:shadow-soft hover:border-primary/30',
        overdue && 'border-red-300/60 bg-red-50/40',
        done && 'opacity-70',
        className,
      )}
    >
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', tone.bg, tone.text)}>
        <Icon className="h-4 w-4" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-medium tracking-tightish truncate', done && 'line-through text-muted-foreground')}>
            {event.title || t('noTitle')}
          </span>
          {overdue && !done && (
            <span className="inline-flex items-center gap-1 rounded-full bg-red-100 text-red-700 text-3xs font-medium px-1.5 py-0.5">
              <AlertTriangle className="h-2.5 w-2.5" />
              {t('overdueBadge')}
            </span>
          )}
        </div>
        <div className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {formatTime(event.start)}
          {event.end.getTime() - event.start.getTime() > 60_000 && ` – ${formatTime(event.end)}`}
          {' · '}
          {t(`types.${event.kind}`)}
        </div>
        {(event.client || event.property || event.manager) && (
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {event.client && <span>{event.client.fullName}</span>}
            {event.client && event.property && <span> · </span>}
            {event.property && <span>{event.property.address}</span>}
            {event.manager && <span className="ml-2 opacity-70">{event.manager.fullName.split(' ')[0]}</span>}
          </div>
        )}
      </div>
    </button>
  );
}
