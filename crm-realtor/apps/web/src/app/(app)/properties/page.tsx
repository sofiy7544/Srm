'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus, Search, Building2, MapPin, Maximize, BedDouble, User } from 'lucide-react';
import { useAuthStore } from '@/lib/auth-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/ui/empty-state';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { properties, type Paginated, type PropertyDetailed, type DealIntent } from '@/lib/api';
import { formatArea, formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';

const PAGE_SIZE = 20;
const ALL = '__ALL__';
const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND'];
const PROPERTY_STATUSES = ['AVAILABLE', 'IN_SHOWING', 'RESERVED', 'SOLD', 'ARCHIVED'];

const STATUS_VARIANT: Record<string, 'success' | 'warning' | 'default' | 'secondary' | 'destructive'> = {
  AVAILABLE: 'success',
  IN_SHOWING: 'warning',
  RESERVED: 'warning',
  SOLD: 'secondary',
  ARCHIVED: 'destructive',
};

export default function PropertiesPage() {
  const t = useTranslations('properties');
  const tCommon = useTranslations('common');
  const me = useAuthStore((s) => s.user);
  const [search, setSearch] = useState('');
  const [type, setType] = useState<string>(ALL);
  const [status, setStatus] = useState<string>(ALL);
  const [dealIntent, setDealIntent] = useState<DealIntent | typeof ALL>(ALL);
  // Admin/manager defaults to "all" (full visibility).
  // Plain agent defaults to "mine" (their own listings only — matches the
  // common pattern in agencies without a shared catalog).
  const isAdminOrMgr = me?.role === 'ADMIN' || me?.role === 'MANAGER';
  const [scope, setScope] = useState<'all' | 'mine'>('all');
  const [scopeInitialized, setScopeInitialized] = useState(false);
  useEffect(() => {
    if (me && !scopeInitialized) {
      setScope(isAdminOrMgr ? 'all' : 'mine');
      setScopeInitialized(true);
    }
  }, [me, isAdminOrMgr, scopeInitialized]);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<PropertyDetailed> | null>(null);
  const [loading, setLoading] = useState(true);

  const params = useMemo(
    () => ({
      search: search || undefined,
      type: type === ALL ? undefined : type,
      status: status === ALL ? undefined : status,
      dealIntent: dealIntent === ALL ? undefined : (dealIntent as DealIntent),
      mine: scope === 'mine' ? true : undefined,
      page,
      pageSize: PAGE_SIZE,
    }),
    [search, type, status, dealIntent, scope, page],
  );

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      properties.list(params).then(setData).finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [params, search]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / PAGE_SIZE)) : 1;

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {data ? t('total', { count: data.total }) : tCommon('loading')}
          </p>
        </div>
        <Button asChild>
          <Link href="/properties/new">
            <Plus className="h-4 w-4" />
            {t('addNew')}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        {/* Scope: shared catalog vs my personal inventory.
            For agencies where each agent maintains their own listings. */}
        {me && (
          <div className="inline-flex rounded-lg border border-border overflow-hidden">
            {([
              { value: 'all',  label: 'Всі об\'єкти' },
              { value: 'mine', label: 'Тільки мої' },
            ] as const).map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setScope(opt.value); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors inline-flex items-center gap-1.5',
                  scope === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                {opt.value === 'mine' && <User className="h-3.5 w-3.5" />}
                {opt.label}
              </button>
            ))}
          </div>
        )}
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {([
            { value: ALL, label: 'Всі' },
            { value: 'BUY', label: 'Продаж' },
            { value: 'RENT', label: 'Оренда' },
          ] as const).map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => { setDealIntent(opt.value as DealIntent | typeof ALL); setPage(1); }}
              className={cn(
                'px-3 py-1.5 text-sm font-medium transition-colors',
                dealIntent === opt.value
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground',
              )}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className="relative flex-1 min-w-[220px] max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            placeholder={t('searchPlaceholder')}
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-10"
          />
        </div>
        <Select value={type} onValueChange={(v) => { setType(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('typeFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('anyType')}</SelectItem>
            {PROPERTY_TYPES.map((p) => (
              <SelectItem key={p} value={p}>
                {t(`types.${p}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={status} onValueChange={(v) => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={t('statusFilter')} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>{t('anyStatus')}</SelectItem>
            {PROPERTY_STATUSES.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`statuses.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="surface-card overflow-hidden animate-pulse">
              <div className="aspect-[16/10] bg-muted" />
              <div className="p-4 space-y-2">
                <div className="h-4 bg-muted rounded w-2/3" />
                <div className="h-3 bg-muted rounded w-full" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <EmptyState icon={Building2} title={t('noResults')} />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data?.items.map((p) => {
            const cover = p.photos.find((ph) => ph.isCover) ?? p.photos[0];
            return (
              <Link key={p.id} href={`/properties/${p.id}`} className="group block">
                <div className="surface-card surface-hover overflow-hidden flex flex-col h-full">
                  <div className="aspect-[16/10] bg-gradient-to-br from-muted to-muted/60 relative overflow-hidden">
                    {cover ? (
                      <>
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={cover.url}
                          alt={p.address}
                          className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      </>
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center text-muted-foreground">
                        <Building2 className="h-10 w-10 opacity-40" />
                      </div>
                    )}
                    <Badge
                      variant={STATUS_VARIANT[p.status] ?? 'default'}
                      className={cn(
                        'absolute top-3 right-3 shadow-soft',
                        cover && 'backdrop-blur-sm',
                      )}
                    >
                      {t(`statuses.${p.status}`)}
                    </Badge>
                    <Badge
                      variant={(p.dealIntent ?? 'BUY') === 'RENT' ? 'warning' : 'secondary'}
                      className={cn(
                        'absolute top-3 left-3 shadow-soft',
                        cover && 'backdrop-blur-sm',
                      )}
                    >
                      {(p.dealIntent ?? 'BUY') === 'RENT' ? 'Оренда' : 'Продаж'}
                    </Badge>
                    {p.photos.length > 1 && (
                      <span className="absolute bottom-3 right-3 text-3xs font-medium bg-black/40 text-white px-2 py-0.5 rounded-full backdrop-blur-sm">
                        +{p.photos.length - 1}
                      </span>
                    )}
                  </div>
                  <div className="p-4 space-y-2 flex-1 flex flex-col">
                    <div className="font-semibold text-lg tracking-tight2">
                      {formatPrice(p.price, p.currency)}
                      {(p.dealIntent ?? 'BUY') === 'RENT' && (
                        <span className="text-sm font-normal text-muted-foreground">{' / міс'}</span>
                      )}
                    </div>
                    <div className="flex items-start gap-1 text-sm text-foreground/80 min-h-[2.5rem]">
                      <MapPin className="h-3.5 w-3.5 text-muted-foreground mt-0.5 shrink-0" />
                      <span className="line-clamp-2">{p.address}</span>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 pt-2 border-t mt-auto">
                      <Badge variant="outline" className="text-3xs">
                        {t(`types.${p.type}`)}
                      </Badge>
                      {p.rooms !== null && (
                        <span className="flex items-center gap-1">
                          <BedDouble className="h-3 w-3" />
                          {p.rooms}
                        </span>
                      )}
                      <span className="flex items-center gap-1">
                        <Maximize className="h-3 w-3" />
                        {formatArea(p.area)}
                      </span>
                      <span className="text-muted-foreground/60 truncate ml-auto">{p.district}</span>
                    </div>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {data && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            {t('prev')}
          </Button>
          <span className="text-sm text-muted-foreground">
            {t('pageOf', { page, total: totalPages })}
          </span>
          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </Button>
        </div>
      )}
    </div>
  );
}
