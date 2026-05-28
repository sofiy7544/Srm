'use client';

import { useTranslations } from 'next-intl';
import { PropertyForm } from '@/components/property-form';

export default function NewPropertyPage() {
  const t = useTranslations('properties');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading-page">{t('newTitle')}</h1>
      </div>
      <PropertyForm />
    </div>
  );
}
