'use client';

/**
 * Skeleton — animated placeholder block. Use anywhere you'd otherwise render
 * `<p className="text-sm animate-pulse">Loading…</p>` (which looks cheap).
 *
 * Composable:
 *   <Skeleton className="h-4 w-32" />
 *   <Skeleton className="h-10 w-full rounded-xl" />
 *
 * For full-page loading states use <PageSkeleton variant=... />.
 */

import * as React from 'react';
import { cn } from '@/lib/utils';

export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'animate-pulse rounded-md bg-muted/70 motion-reduce:animate-none',
        className,
      )}
      {...props}
    />
  );
}

/**
 * PageSkeleton — opinionated full-page loading state mirroring the typical
 * detail-page layout: header strip + content cards. Mounts under the (app)
 * shell, so it inherits the surrounding chrome.
 */
export function PageSkeleton({
  variant = 'detail',
  className,
}: {
  variant?: 'detail' | 'list' | 'kanban' | 'form';
  className?: string;
}) {
  if (variant === 'list') {
    return (
      <div className={cn('space-y-3', className)} aria-busy="true" aria-live="polite">
        <div className="flex items-center gap-3">
          <Skeleton className="h-9 w-64" />
          <Skeleton className="ml-auto h-9 w-32" />
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="surface-card p-4 flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <Skeleton className="h-4 w-1/3" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'kanban') {
    return (
      <div className={cn('flex gap-3 overflow-hidden', className)} aria-busy="true">
        {Array.from({ length: 4 }).map((_, col) => (
          <div key={col} className="flex-1 min-w-[240px] space-y-2">
            <Skeleton className="h-6 w-32" />
            {Array.from({ length: 3 }).map((_, row) => (
              <Skeleton key={row} className="h-24 w-full rounded-xl" />
            ))}
          </div>
        ))}
      </div>
    );
  }

  if (variant === 'form') {
    return (
      <div className={cn('space-y-4 max-w-2xl', className)} aria-busy="true">
        <Skeleton className="h-7 w-1/3" />
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-3 w-20" />
            <Skeleton className="h-9 w-full" />
          </div>
        ))}
        <div className="flex justify-end gap-2 pt-2">
          <Skeleton className="h-9 w-24" />
          <Skeleton className="h-9 w-24" />
        </div>
      </div>
    );
  }

  // 'detail' default
  return (
    <div className={cn('space-y-4', className)} aria-busy="true" aria-live="polite">
      <div className="flex items-center gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-5 w-1/3" />
          <Skeleton className="h-3 w-1/2" />
        </div>
        <Skeleton className="h-9 w-24" />
      </div>
      <div className="grid gap-3 md:grid-cols-2">
        <Skeleton className="h-32 w-full rounded-xl" />
        <Skeleton className="h-32 w-full rounded-xl" />
      </div>
      <Skeleton className="h-48 w-full rounded-xl" />
    </div>
  );
}
