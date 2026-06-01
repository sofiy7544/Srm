'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Hand, Loader2, Building2, Clock } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Avatar } from '@/components/ui/avatar';
import { leads, type LeadDetailed } from '@/lib/api';
import { STAGE_LABEL, STAGE_DOT } from '@/lib/stage-style';
import { formatDate, formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * /pool — публічний пул нерозподілених лідів. Будь-який реалтор може клікнути
 * «Взяти в роботу» — лід прив'язується до нього. Гонка вирішується атомарно на
 * сервері (updateMany з умовою assignedUserId=null).
 *
 * Використовується для:
 *   1. лідів, де round-robin не спрацював (нема активних агентів у пулі)
 *   2. лідів, повернених в пул SLA-ескалацією (T+60 без першого контакту)
 */
export default function PoolPage() {
  const t = useTranslations('pool');
  const tIntent = useTranslations('clients.intent');
  const [items, setItems] = useState<LeadDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<string | null>(null);

  function reload() {
    leads.pool().then(setItems).finally(() => setLoading(false));
  }
  useEffect(reload, []);

  async function handleClaim(id: string) {
    setClaiming(id);
    try {
      await leads.claim(id);
      toast.success(t('claimed'));
      reload();
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('claimError'));
      reload();
    } finally {
      setClaiming(null);
    }
  }

  if (loading) return <PageSkeleton variant="detail" />;

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('subtitle')}
          </p>
        </div>
        {/* Точка входа в квалификацию unclaimed-контактов (отдельно от пула). */}
        <Button asChild variant="outline">
          <Link href="/qualify">{t('qualifyCta')}</Link>
        </Button>
      </div>

      {items.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <Hand className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="font-medium">{t('emptyTitle')}</p>
          <p className="text-sm text-muted-foreground mt-1">{t('emptyHint')}</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {items.map((l) => (
            <Card key={l.id} className="p-4">
              <div className="flex items-center gap-3 flex-wrap">
                <Avatar name={l.client.fullName} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link href={`/leads/${l.id}`} className="font-semibold hover:text-primary truncate">
                      {l.client.fullName}
                    </Link>
                    <span className={cn(
                      'inline-flex items-center gap-1 text-3xs px-1.5 py-0.5 rounded-full font-medium',
                      'bg-muted text-foreground/80',
                    )}>
                      <span className={cn('h-1.5 w-1.5 rounded-full', STAGE_DOT[l.stage])} />
                      {STAGE_LABEL[l.stage]}
                    </span>
                    <Badge variant={(l.dealIntent ?? 'BUY') === 'RENT' ? 'warning' : 'secondary'} className="text-3xs">
                      {(l.dealIntent ?? 'BUY') === 'RENT' ? tIntent('RENT') : tIntent('BUY')}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center gap-3 flex-wrap">
                    <span>{l.client.primaryPhone}</span>
                    {l.interestProperty && (
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3 w-3" />
                        {l.interestProperty.address} ·{' '}
                        {formatPrice(l.interestProperty.price, l.interestProperty.currency)}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatDate(l.createdAt)}
                    </span>
                  </div>
                  {l.interestNote && (
                    <p className="text-xs italic text-muted-foreground mt-1 line-clamp-2">{l.interestNote}</p>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => handleClaim(l.id)}
                  disabled={claiming === l.id}
                >
                  {claiming === l.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Hand className="h-3.5 w-3.5" />
                  )}
                  {t('claimButton')}
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
