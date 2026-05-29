'use client';

import { useTranslations } from 'next-intl';
import { ClientForm } from '@/components/client-form';

export default function NewClientPage() {
  const t = useTranslations('clients');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading-page">{t('newTitle')}</h1>
      </div>
      <ClientForm />
    </div>
  );
}
