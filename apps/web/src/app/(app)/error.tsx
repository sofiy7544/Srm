'use client';

/**
 * Error boundary for the (app) segment.
 *
 * Next.js 13+ App Router renders this whenever a Server or Client component
 * inside this segment throws during render. It's a Client Component (must be)
 * and receives the error + a reset() function to retry.
 *
 * The CRM keeps the surrounding shell (sidebar/topbar) visible so the user
 * can navigate elsewhere instead of being thrown to a blank page.
 */

import { useEffect } from 'react';
import { useTranslations } from 'next-intl';
import { AlertTriangle, RefreshCw, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AppErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations('errors');

  useEffect(() => {
    // Surface to console so the dev sees a stack trace.
    // In production this is also where you'd ping Sentry.
    console.error('[AppError]', error);
  }, [error]);

  return (
    <EmptyState
      icon={AlertTriangle}
      title={t('somethingBroke')}
      description={
        <span>
          {t('weLoggedIt')}{' '}
          {error.digest ? (
            <code className="rounded bg-muted px-1.5 py-0.5 text-3xs">{error.digest}</code>
          ) : null}
        </span>
      }
      action={
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={reset} variant="default">
            <RefreshCw className="h-4 w-4" strokeWidth={1.75} />
            {t('retry')}
          </Button>
          <Button asChild variant="outline">
            <Link href="/today">
              <Home className="h-4 w-4" strokeWidth={1.75} />
              {t('goHome')}
            </Link>
          </Button>
        </div>
      }
    />
  );
}
