'use client';

import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useDraggable } from '@dnd-kit/core';
import { User, Building2, ArrowUpRight, AlertTriangle, Clock } from 'lucide-react';
import { Avatar } from '@/components/ui/avatar';
import type { DealRow } from '@/lib/api';
import { formatPrice, formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

interface DealCardProps {
  deal: DealRow;
  /** Доп. инфо: следующее действие — ближайшая невыполненная задача. */
  nextAction?: { title: string; dueAt: string } | null;
  overdue?: boolean;
  dragging?: boolean;
}

export function DealCard({ deal, nextAction, overdue, dragging }: DealCardProps) {
  const t = useTranslations('deals');

  return (
    <Link
      href={`/deals/${deal.id}`}
      onClick={(e) => dragging && e.preventDefault()}
      className={cn(
        'relative block surface-card surface-hover p-3 pl-3.5 space-y-2 cursor-grab active:cursor-grabbing',
        // тонкая аксент-полоса слева — как у карточек лидов
        "before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full",
        overdue ? 'before:bg-red-500' : 'before:bg-primary/40',
        dragging && 'shadow-lift rotate-1',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="font-semibold tabular-nums tracking-tight2">
          {formatPrice(deal.amount)}
        </div>
        <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </div>

      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-1.5 text-foreground/80 min-w-0">
          <User className="h-3 w-3 shrink-0 text-muted-foreground" />
          <span className="truncate">{deal.client.fullName}</span>
        </div>
        <div className="flex items-center gap-1.5 text-muted-foreground min-w-0">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">{deal.property.address}</span>
        </div>
      </div>

      {/* commission */}
      <div className="text-3xs text-muted-foreground">
        {t('commission')}: {Number(deal.commissionPercent)}% · {formatPrice(deal.commissionAmount)}
      </div>

      {/* next action */}
      <div
        className={cn(
          'rounded-md border px-1.5 py-1 text-3xs flex items-center gap-1.5',
          overdue
            ? 'border-red-200 bg-red-50 text-red-700'
            : nextAction
              ? 'border-amber-200 bg-amber-50 text-amber-800'
              : 'border-dashed border-border bg-muted/40 text-muted-foreground',
        )}
      >
        {overdue ? (
          <AlertTriangle className="h-3 w-3 shrink-0" />
        ) : (
          <Clock className="h-3 w-3 shrink-0" />
        )}
        <span className="truncate">
          {nextAction ? (
            <>
              <span className="font-medium">{nextAction.title}</span>
              <span className="opacity-75"> · {formatDate(nextAction.dueAt)}</span>
            </>
          ) : (
            t('noNextAction')
          )}
        </span>
      </div>

      {/* нижняя строка: агент + дата создания */}
      <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
        <span className="inline-flex items-center gap-1 text-3xs text-muted-foreground min-w-0">
          <Avatar name={deal.agent.fullName} size="xs" className="h-4 w-4 text-[8px] ring-1" />
          <span className="truncate">{deal.agent.fullName.split(' ')[0]}</span>
        </span>
        <span className="text-3xs text-muted-foreground tabular-nums">
          {formatDate(deal.createdAt)}
        </span>
      </div>
    </Link>
  );
}

interface DealCardDraggableProps extends DealCardProps {
  deal: DealRow;
}

export function DealCardDraggable(props: DealCardDraggableProps) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: props.deal.id });
  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.3 } : undefined}
      className="group rounded-xl"
      {...listeners}
      {...attributes}
    >
      <DealCard {...props} />
    </div>
  );
}
