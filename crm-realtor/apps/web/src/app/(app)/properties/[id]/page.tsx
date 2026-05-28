'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, MapPin, BedDouble, Maximize, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { properties, type PropertyDetailed } from '@/lib/api';
import { formatArea, formatDate, formatPrice } from '@/lib/formatters';
import { PropertyPhotos } from '@/components/property-photos';
import { PropertyGallery } from '@/components/property-gallery';
import { SendPresentation } from '@/components/send-presentation';
import { useConfirm } from '@/components/ui/confirm-dialog';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'secondary' | 'destructive'> = {
  AVAILABLE: 'success',
  IN_SHOWING: 'warning',
  RESERVED: 'warning',
  SOLD: 'secondary',
  ARCHIVED: 'destructive',
};

export default function PropertyDetailPage() {
  const t = useTranslations('properties');
  const tCommon = useTranslations('common');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const [property, setProperty] = useState<PropertyDetailed | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!params.id) return;
    properties.get(params.id).then(setProperty).finally(() => setLoading(false));
  }, [params.id]);

  async function handleDelete() {
    if (!property) return;
    const ok = await confirm({
      title: t('confirmDelete', { address: property.address }),
      destructive: true,
    });
    if (!ok) return;
    await properties.remove(property.id);
    router.push('/properties');
  }

  if (loading) return <PageSkeleton variant="detail" />;
  if (!property) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>;

  return (
    <div className="space-y-5 animate-slide-up max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/properties">
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/properties/${property.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {tCommon('edit')}
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <PropertyGallery photos={property.photos} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div>
                <div className="text-3xl font-semibold tracking-tight2">
                  {formatPrice(property.price, property.currency)}
                </div>
                <div className="flex items-center gap-1.5 text-sm text-muted-foreground mt-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  {property.address}
                </div>
              </div>
              <Badge variant={STATUS_VARIANT[property.status] ?? 'default'}>
                {t(`statuses.${property.status}`)}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Stat label={t('type')} value={t(`types.${property.type}`)} />
              <Stat label={t('district')} value={property.district} />
              {property.rooms !== null && (
                <Stat label={t('rooms')} value={String(property.rooms)} icon={BedDouble} />
              )}
              <Stat label={t('area')} value={formatArea(property.area)} icon={Maximize} />
            </div>

            {property.description && (
              <div className="pt-3 border-t">
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                  {t('description')}
                </div>
                <p className="text-sm whitespace-pre-wrap leading-relaxed">{property.description}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5 space-y-4">
            {property.owner && (
              <div>
                <div className="text-xs uppercase tracking-wide text-muted-foreground font-medium mb-2">
                  {t('owner')}
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 text-white flex items-center justify-center">
                    <User className="h-3.5 w-3.5" />
                  </div>
                  <div>
                    <div className="font-medium">{property.owner.fullName}</div>
                    <div className="text-xs text-muted-foreground">{property.owner.email}</div>
                  </div>
                </div>
              </div>
            )}

            <div className="text-xs text-muted-foreground border-t pt-3">
              {t('createdAt')}: {formatDate(property.createdAt)}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Send presentation */}
      <Card>
        <CardContent className="p-5">
          <SendPresentation propertyId={property.id} />
        </CardContent>
      </Card>

      {/* Photos management */}
      <Card>
        <CardContent className="p-5">
          <PropertyPhotos propertyId={property.id} initial={property.photos} />
        </CardContent>
      </Card>
    </div>
  );
}

function Stat({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: string;
  icon?: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl bg-muted/40 p-3">
      <div className="text-2xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
      <div className="font-semibold mt-1 flex items-center gap-1.5">
        {Icon && <Icon className="h-3.5 w-3.5 text-muted-foreground" />}
        <span>{value}</span>
      </div>
    </div>
  );
}
