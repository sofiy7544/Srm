'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Users, AlertTriangle, CheckCircle2, Clock, Coffee } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { PageSkeleton } from '@/components/ui/skeleton';
import { reports, type TeamWorkloadRow } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

/**
 * /team — менеджерский / админский экран нагрузки команды.
 * Сразу видно: кто на месте, у кого OVERDUE-таски, кто перегружен лидами,
 * кто давно не активен. Это та самая «прозрачность» без захода в каждого агента.
 */
export default function TeamWorkloadPage() {
  const t = useTranslations('teamPage');
  const router = useRouter();
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [rows, setRows] = useState<TeamWorkloadRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!me) return;
    if (!isAdmin) {
      router.replace('/today');
      return;
    }
    reports
      .teamWorkload()
      .then(setRows)
      .finally(() => setLoading(false));
  }, [me, isAdmin, router]);

  if (loading || !me) return <PageSkeleton variant="detail" />;
  if (!isAdmin) return null;

  const totalActive = rows.reduce((s, r) => s + r.activeLeads, 0);
  const totalOverdue = rows.reduce((s, r) => s + r.overdueTasks, 0);
  const offCount = rows.filter((r) => !r.isAvailable).length;
  const maxLoad = Math.max(...rows.map((r) => r.activeLeads), 1);

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t('summary', { count: rows.length })} · {t('summaryActive', { count: totalActive })}
            {totalOverdue > 0 && (
              <span className="text-red-600 dark:text-red-400"> · {t('summaryOverdue', { count: totalOverdue })}</span>
            )}
            {offCount > 0 && (
              <span className="text-muted-foreground"> · {t('summaryOff', { count: offCount })}</span>
            )}
          </p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            {t('workload')}
          </CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {rows.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noAgents')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-2xs uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="py-2.5">{t('col.agent')}</th>
                  <th className="py-2.5">{t('col.role')}</th>
                  <th className="py-2.5">{t('col.status')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('col.active')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('col.today')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('col.overdue')}</th>
                  <th className="py-2.5">{t('col.lastActivity')}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => {
                  const loadPct = (r.activeLeads / maxLoad) * 100;
                  const isOverloaded = r.activeLeads > 20;
                  return (
                    <tr key={r.userId} className="border-b last:border-0 group hover:bg-muted/30 transition-colors">
                      <td className="py-3 font-medium">
                        <Link href={`/leads?assignee=${r.userId}`} className="hover:text-primary">
                          {r.fullName}
                        </Link>
                        <div className="text-xs text-muted-foreground">{r.email}</div>
                      </td>
                      <td className="py-3">
                        <Badge variant="secondary" className="text-3xs">{r.role}</Badge>
                      </td>
                      <td className="py-3">
                        {r.isAvailable ? (
                          <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
                            <CheckCircle2 className="h-3 w-3" /> {t('available')}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground text-xs font-medium">
                            <Coffee className="h-3 w-3" /> {t('offHours')}
                          </span>
                        )}
                      </td>
                      <td className="py-3 text-right tabular-nums">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-20 h-1.5 bg-muted rounded-full overflow-hidden">
                            <div
                              className={cn(
                                'h-full rounded-full transition-all',
                                isOverloaded ? 'bg-red-500' : loadPct > 70 ? 'bg-amber-500' : 'bg-emerald-500',
                              )}
                              style={{ width: `${loadPct}%` }}
                            />
                          </div>
                          <span className={cn('font-medium tabular-nums', isOverloaded && 'text-red-600 dark:text-red-400')}>
                            {r.activeLeads}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 text-right tabular-nums">{r.todayTasks}</td>
                      <td className="py-3 text-right tabular-nums">
                        {r.overdueTasks > 0 ? (
                          <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400 font-medium">
                            <AlertTriangle className="h-3 w-3" />
                            {r.overdueTasks}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="py-3 text-xs">
                        {r.lastActivityAt ? (
                          <span className="flex items-center gap-1 text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDate(r.lastActivityAt)}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/60">{t('never')}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      <p className="text-xs text-muted-foreground">
        {t.rich('explanation', {
          available: (chunks) => <span className="font-medium">{chunks}</span>,
          api: () => <code className="text-2xs">PATCH /api/users/[id] {'{ isAvailable: false }'}</code>,
        })}
      </p>
    </div>
  );
}
