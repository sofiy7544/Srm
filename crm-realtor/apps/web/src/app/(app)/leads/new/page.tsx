'use client';

import { useTranslations } from 'next-intl';
import { LeadForm } from '@/components/lead-form';

/**
 * Thin shell — the actual form lives in <LeadForm>, shared with QuickCreate.
 * Sprint 2.1 reduced this file from 135 lines to <15.
 */
export default function NewLeadPage() {
  const t = useTranslations('leads');
  return (
    <div className="space-y-4">
      <h1 className="heading-page">{t('newTitle')}</h1>
      <LeadForm />
    </div>
  );
}
