'use client';

import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { PropertyForm } from '@/components/property-form';
import { properties, type PropertyDetailed } from '@/lib/api';
import { PageSkeleton } from '@/components/ui/skeleton';

export default function EditPropertyPage() {
  const t = useTranslations('properties');
  const params = useParams<{ id: string }>();
  const [property, setProperty] = useState<PropertyDetailed | null>(null);

  useEffect(() => {
    if (!params.id) return;
    properties.get(params.id).then(setProperty);
  }, [params.id]);

  if (!property) return <PageSkeleton variant="form" />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="heading-page">{t('editTitle')}</h1>
        <p className="text-sm text-muted-foreground">{property.address}</p>
      </div>
      <PropertyForm existing={property} />
    </div>
  );
}
