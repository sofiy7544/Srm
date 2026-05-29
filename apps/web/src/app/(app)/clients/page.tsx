'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { Plus, Search, Phone, Mail, ChevronRight, Archive, Ban } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { SourceIcon } from '@/components/source-badge';
import { clients, type ClientDetailed, type Paginated } from '@/lib/api';

const PAGE_SIZE = 20;

export default function ClientsPage() {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<'active' | 'archived' | 'blacklisted'>('active');
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Paginated<ClientDetailed> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(true);
      clients
        .list({ search: search || undefined, status, page, pageSize: PAGE_SIZE })
        .then(setData)
        .finally(() => setLoading(false));
    }, search ? 300 : 0);
    return () => clearTimeout(timer);
  }, [search, status, page]);

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
          <Link href="/clients/new">
            <Plus className="h-4 w-4" />
            {t('addNew')}
          </Link>
        </Button>
      </div>

      <div className="flex gap-2 flex-wrap items-center">
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {([
            { value: 'active', label: 'Активні', icon: null },
            { value: 'archived', label: 'Архів', icon: Archive },
            { value: 'blacklisted', label: 'Чорний список', icon: Ban },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => { setStatus(opt.value); setPage(1); }}
                className={cn(
                  'px-3 py-1.5 text-sm font-medium transition-colors flex items-center gap-1.5',
                  status === opt.value
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-background hover:bg-muted text-muted-foreground',
                )}
              >
                {Icon && <Icon className="h-3.5 w-3.5" />}
                {opt.label}
              </button>
            );
          })}
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
      </div>

      {loading && !data ? (
        <div className="grid gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="surface-card p-4 flex items-center gap-3 animate-pulse">
              <div className="h-10 w-10 rounded-full bg-muted" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-muted rounded w-1/3" />
                <div className="h-2 bg-muted rounded w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : data && data.items.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary/15 to-violet-500/15 flex items-center justify-center mx-auto mb-3">
            <Search className="h-5 w-5 text-primary" />
          </div>
          <p className="font-medium">{search ? t('noResults') : t('empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {data?.items.map((c) => (
            <Link key={c.id} href={`/clients/${c.id}`} className="group block">
              <div className="surface-card surface-hover p-3.5 flex items-center gap-3">
                <Avatar name={c.fullName} src={c.avatarUrl} size="md" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold tracking-tightish truncate">{c.fullName}</span>
                    {c.source && (
                      <Badge variant="secondary" className="text-3xs gap-1 pl-1">
                        <SourceIcon type={c.source.type} className="h-3 w-3" />
                        {c.source.name}
                      </Badge>
                    )}
                  </div>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-1">
                      <Phone className="h-3 w-3" />
                      {c.primaryPhone}
                    </span>
                    {c.email && (
                      <span className="flex items-center gap-1 truncate">
                        <Mail className="h-3 w-3 shrink-0" />
                        <span className="truncate">{c.email}</span>
                      </span>
                    )}
                  </div>
                </div>
                {c.assignedUser && (
                  <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground">
                    <Avatar name={c.assignedUser.fullName} size="xs" />
                    <span>{c.assignedUser.fullName.split(' ')[0]}</span>
                  </div>
                )}
                {/* На mobile видимая chevron-подсказка тапа; на desktop тише, появляется на hover */}
                <ChevronRight className="h-5 w-5 sm:h-4 sm:w-4 text-muted-foreground/60 sm:text-muted-foreground/40 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
              </div>
            </Link>
          ))}
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
