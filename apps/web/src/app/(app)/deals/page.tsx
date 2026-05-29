'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Briefcase, User, Building2, LayoutList, KanbanSquare } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deals, type DealRow, type Paginated } from '@/lib/api';
import { formatDate, formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DealsBoard } from '@/components/deals/deals-board';

const ALL = '__ALL__';

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'destructive'> = {
  IN_PROGRESS: 'warning',
  COMPLETED: 'success',
  CANCELLED: 'destructive',
};

type View = 'list' | 'board';

export default function DealsPage() {
  const t = useTranslations('deals');
  const [status, setStatus] = useState(ALL);
  const [data, setData] = useState<Paginated<DealRow> | null>(null);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<View>('list');

  function reload() {
    setLoading(true);
    deals
      .list({ status: status === ALL ? undefined : status, pageSize: 100 })
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  const totalSum =
    data?.items.filter((d) => d.status === 'COMPLETED').reduce((s, d) => s + Number(d.amount), 0) ??
    0;
  const totalCommission =
    data?.items.filter((d) => d.status === 'COMPLETED').reduce((s, d) => s + Number(d.commissionAmount), 0) ??
    0;

  return (
    <div className="space-y-4 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('total', { count: data?.total ?? 0 })}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* В режиме "Доска" фильтр статуса не нужен — стадии и есть колонки. */}
          {view === 'list' && (
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>{t('anyStatus')}</SelectItem>
                <SelectItem value="IN_PROGRESS">{t('statuses.IN_PROGRESS')}</SelectItem>
                <SelectItem value="COMPLETED">{t('statuses.COMPLETED')}</SelectItem>
                <SelectItem value="CANCELLED">{t('statuses.CANCELLED')}</SelectItem>
              </SelectContent>
            </Select>
          )}
          <div className="flex gap-1 p-1 surface-card rounded-xl">
            <ViewPill
              icon={<LayoutList className="h-3.5 w-3.5" />}
              label={t('viewList')}
              active={view === 'list'}
              onClick={() => setView('list')}
            />
            <ViewPill
              icon={<KanbanSquare className="h-3.5 w-3.5" />}
              label={t('viewBoard')}
              active={view === 'board'}
              onClick={() => setView('board')}
            />
          </div>
        </div>
      </div>

      {view === 'list' && data && data.items.some((d) => d.status === 'COMPLETED') && (
        <div className="grid grid-cols-2 gap-3">
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">{t('totalRevenue')}</div>
            <div className="text-xl font-semibold">{formatPrice(totalSum)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-xs text-muted-foreground">{t('totalCommission')}</div>
            <div className="text-xl font-semibold">{formatPrice(totalCommission)}</div>
          </Card>
        </div>
      )}

      {loading && !data ? (
        <PageSkeleton variant="list" />
      ) : view === 'list' ? (
        <DealsListView items={data?.items ?? []} />
      ) : (
        <DealsBoard items={data?.items ?? []} onChanged={reload} />
      )}
    </div>
  );
}

function DealsListView({ items }: { items: DealRow[] }) {
  const t = useTranslations('deals');
  if (items.length === 0) {
    return (
      <Card className="p-8 text-center text-sm text-muted-foreground">
        <Briefcase className="h-8 w-8 mx-auto mb-2" />
        {t('empty')}
      </Card>
    );
  }
  return (
    <div className="grid gap-2">
      {items.map((d) => (
        <Link key={d.id} href={`/deals/${d.id}`}>
          <Card className="p-4 hover:border-primary/50 transition-colors">
            <div className="flex items-start justify-between gap-2 flex-wrap">
              <div className="space-y-1 flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-lg">{formatPrice(d.amount)}</span>
                  <Badge variant={STATUS_VARIANT[d.status] ?? 'secondary'}>
                    {t(`statuses.${d.status}`)}
                  </Badge>
                  <Badge variant="outline">
                    {t('commission')}: {Number(d.commissionPercent)}% · {formatPrice(d.commissionAmount)}
                  </Badge>
                </div>
                <div className="flex items-center gap-3 text-sm text-muted-foreground flex-wrap">
                  <span className="flex items-center gap-1">
                    <User className="h-3 w-3" /> {d.client.fullName}
                  </span>
                  <span className="flex items-center gap-1">
                    <Building2 className="h-3 w-3" /> {d.property.address}
                  </span>
                  <span>
                    {t('agent')}: {d.agent.fullName}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {formatDate(d.createdAt)} {d.closedAt && `→ ${formatDate(d.closedAt)}`}
                </div>
              </div>
            </div>
          </Card>
        </Link>
      ))}
    </div>
  );
}

function ViewPill({
  icon,
  label,
  active,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all flex items-center gap-1.5 whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground shadow-glow'
          : 'text-foreground/70 hover:bg-muted hover:text-foreground',
      )}
    >
      {icon}
      {label}
    </button>
  );
}
