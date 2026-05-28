'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { ClientForm } from '@/components/client-form';
import { clients, type ClientDetailed } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function EditClientPage() {
  const t = useTranslations('clients');
  const params = useParams<{ id: string }>();
  const [client, setClient] = useState<ClientDetailed | null>(null);

  useEffect(() => {
    if (!params.id) return;
    clients.get(params.id).then(setClient);
  }, [params.id]);

  if (!client) return <PageSkeleton variant="form" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading-page">{t('editTitle', { name: client.fullName })}</h1>
      </div>
      <ClientForm existing={client} />
    </div>
  );
}
