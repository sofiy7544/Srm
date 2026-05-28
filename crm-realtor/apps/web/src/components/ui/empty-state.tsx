'use client';

/**
 * EmptyState — standardised "no data" panel.
 *
 * Use anywhere a list/table/board has zero rows. Pick a contextual icon from
 * lucide-react and write a short headline + optional description + 1-2 actions.
 *
 *   <EmptyState
 *     icon={Inbox}
 *     title={t('empty.title')}
 *     description={t('empty.description')}
 *     action={
 *       <Button onClick={...}>
 *         <Plus className="h-4 w-4" /> {t('createFirst')}
 *       </Button>
 *     }
 *   />
 *
 * Variants:
 *   - 'card'    (default): rendered as a Card with padding
 *   - 'inline':            no card chrome — for in-page empty zones
 *   - 'compact':           smaller variant for sidebar lists / nested empty
 */

import * as React from 'react';
import { cn } from '@/lib/utils';
import { Card } from '@/components/ui/card';

type IconComponent = React.ComponentType<{ className?: string; strokeWidth?: number | string }>;

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  variant = 'card',
  className,
}: {
  icon?: IconComponent;
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  variant?: 'card' | 'inline' | 'compact';
  className?: string;
}) {
  const isCompact = variant === 'compact';
  const content = (
    <div
      className={cn(
        'flex flex-col items-center text-center',
        isCompact ? 'gap-2 py-6' : 'gap-3 py-12 sm:py-16',
      )}
    >
      {Icon ? (
        <span
          className={cn(
            'flex items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground',
            isCompact ? 'h-10 w-10' : 'h-14 w-14',
          )}
        >
          <Icon
            className={isCompact ? 'h-5 w-5' : 'h-6 w-6'}
            strokeWidth={1.75}
          />
        </span>
      ) : null}
      <div className="space-y-1">
        <h3
          className={cn(
            'font-semibold tracking-tight2 text-foreground',
            isCompact ? 'text-sm' : 'text-base',
          )}
        >
          {title}
        </h3>
        {description ? (
          <p
            className={cn(
              'mx-auto max-w-md text-muted-foreground tracking-tightish',
              isCompact ? 'text-xs' : 'text-sm',
            )}
          >
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className={cn(isCompact ? 'mt-1' : 'mt-2')}>{action}</div> : null}
    </div>
  );

  if (variant === 'inline') {
    return <div className={cn('w-full', className)}>{content}</div>;
  }

  return <Card className={cn('w-full', className)}>{content}</Card>;
}
