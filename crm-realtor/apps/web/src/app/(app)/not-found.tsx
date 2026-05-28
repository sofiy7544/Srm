'use client';

import { useTranslations } from 'next-intl';
import { Compass, Home } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { EmptyState } from '@/components/ui/empty-state';

export default function AppNotFoundPage() {
  const t = useTranslations('errors');

  return (
    <EmptyState
      icon={Compass}
      title={t('notFound.title')}
      description={t('notFound.description')}
      action={
        <Button asChild>
          <Link href="/today">
            <Home className="h-4 w-4" strokeWidth={1.75} />
            {t('goHome')}
          </Link>
        </Button>
      }
    />
  );
}
