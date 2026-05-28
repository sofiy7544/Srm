'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import {
  Users,
  Building2,
  KanbanSquare,
  Briefcase,
  TrendingUp,
  Wallet,
  ArrowDown,
  XCircle,
  TrendingDown,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  reports,
  leads as leadsApi,
  type AgentStat,
  type ChannelStat,
  type LeadDetailed,
  type ReportDashboard,
  type SourceRoi,
} from '@/lib/api';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';

// Активные этапы воронки — формируют конус, поджимающийся к успешной сделке
const ACTIVE_STAGES = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHOWING',
  'NEGOTIATION',
  'WON',
] as const;

import { STAGE_GRADIENT } from '@/lib/stage-style';

export default function ReportsPage() {
  const t = useTranslations('reports');
  const tLeads = useTranslations('leads.stages');
  const tPage = useTranslations('reportsPage');

  const [dashboard, setDashboard] = useState<ReportDashboard | null>(null);
  const [funnel, setFunnel] = useState<Record<string, number>>({});
  const [channels, setChannels] = useState<ChannelStat[]>([]);
  const [agents, setAgents] = useState<AgentStat[]>([]);
  const [roi, setRoi] = useState<SourceRoi[]>([]);
  const [lostLeads, setLostLeads] = useState<LeadDetailed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      reports.dashboard(),
      reports.funnel(),
      reports.leadsByChannel(),
      reports.agents(),
      reports.sourceRoi(),
      leadsApi.list(),
    ])
      .then(([d, f, c, a, r, allLeads]) => {
        setDashboard(d);
        setFunnel(f);
        setChannels(c);
        setAgents(a);
        setRoi(r);
        setLostLeads((allLeads as LeadDetailed[]).filter((l) => l.stage === 'LOST'));
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading || !dashboard) {
    return <PageSkeleton variant="detail" />;
  }

  const maxChannel = Math.max(...channels.map((c) => c.count), 1);
  const totalChannel = channels.reduce((s, c) => s + c.count, 0) || 1;
  const topFunnel = funnel['NEW'] ?? Math.max(...Object.values(funnel), 1);
  const closedLost = funnel['LOST'] ?? 0;
  const closedWon = funnel['WON'] ?? 0;
  const overallConv = topFunnel > 0 ? Math.round((closedWon / topFunnel) * 100) : 0;

  // Group lost leads by reason
  const lostByReason = lostLeads.reduce<Record<string, number>>((acc, l) => {
    const key = l.lostReason?.trim() || tPage('noReason');
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});
  const lostReasonEntries = Object.entries(lostByReason).sort((a, b) => b[1] - a[1]);
  const maxLostCount = Math.max(...lostReasonEntries.map(([, c]) => c), 1);

  return (
    <div className="space-y-6 max-w-6xl animate-slide-up">
      {/* Header */}
      <div>
        <h1 className="heading-page">{t('title')}</h1>
        <p className="text-sm text-muted-foreground mt-1">{t('subtitle')}</p>
      </div>

      {/* KPI strip — карточки с акцентом, hover-state, tabular figures */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <KPI tone="sky" icon={Users} label={t('totalClients')} value={dashboard.totalClients} />
        <KPI tone="violet" icon={Building2} label={t('totalProperties')} value={dashboard.totalProperties} />
        <KPI tone="amber" icon={KanbanSquare} label={t('activeLeads')} value={dashboard.activeLeads} />
        <KPI tone="emerald" icon={Briefcase} label={t('completedDeals')} value={dashboard.completedDeals} />
        <KPI tone="emerald" icon={TrendingUp} label={t('totalAmount')} value={formatPrice(dashboard.totalAmount)} />
        <KPI tone="violet" icon={Wallet} label={t('totalCommission')} value={formatPrice(dashboard.totalCommission)} />
      </div>

      {/* ────────── FUNNEL ────────── */}
      <Card className="overflow-hidden">
        <CardHeader className="flex flex-row items-end justify-between pb-2">
          <div>
            <CardTitle className="text-base sm:text-lg">{t('funnel')}</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">
              {topFunnel} → {closedWon} · {overallConv}% overall
            </p>
          </div>
          {closedLost > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <XCircle className="h-3.5 w-3.5 text-rose-500" />
              <span>
                {tLeads('LOST')}: <span className="font-semibold tabular-nums text-foreground">{closedLost}</span>
              </span>
            </div>
          )}
        </CardHeader>
        <CardContent className="pt-2">
          <div className="space-y-1">
            {ACTIVE_STAGES.map((stage, idx) => {
              const count = funnel[stage] ?? 0;
              const prevCount = idx > 0 ? funnel[ACTIVE_STAGES[idx - 1]] ?? 0 : null;
              const widthPct = topFunnel > 0 ? Math.max((count / topFunnel) * 100, count > 0 ? 6 : 1) : 1;
              const conversionFromPrev =
                prevCount && prevCount > 0 ? Math.round((count / prevCount) * 100) : null;

              return (
                <FunnelRow
                  key={stage}
                  label={tLeads(stage)}
                  count={count}
                  widthPct={widthPct}
                  gradient={STAGE_GRADIENT[stage]}
                  conversionFromPrev={conversionFromPrev}
                  isLast={idx === ACTIVE_STAGES.length - 1}
                />
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* ────────── CHANNELS ────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">{t('leadsByChannel')}</CardTitle>
        </CardHeader>
        <CardContent>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noData')}</p>
          ) : (
            <div className="space-y-2.5">
              {channels
                .slice()
                .sort((a, b) => b.count - a.count)
                .map((c, idx) => {
                  const pct = Math.round((c.count / totalChannel) * 100);
                  const wPct = Math.max((c.count / maxChannel) * 100, c.count > 0 ? 8 : 2);
                  return (
                    <div key={c.sourceId ?? `none-${idx}`} className="group">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium tracking-tightish truncate flex-1 mr-3">
                          {c.sourceName}
                        </span>
                        <span className="text-xs text-muted-foreground tabular-nums">
                          <span className="font-semibold text-foreground">{c.count}</span> · {pct}%
                        </span>
                      </div>
                      <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                        <div
                          className={cn(
                            'h-full rounded-full bg-gradient-to-r from-primary to-accent transition-all duration-500',
                            'group-hover:brightness-110',
                          )}
                          style={{ width: `${wPct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ────────── AGENTS ────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">{t('agentActivity')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {agents.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-2xs uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="py-2.5">{t('agent')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('leadsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('callsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('showingsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('dealsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('commissionCol')}</th>
                </tr>
              </thead>
              <tbody>
                {agents.map((a) => (
                  <tr key={a.userId} className="border-b last:border-0 group transition-colors">
                    <td className="py-0 font-medium">
                      <Link
                        href={`/leads?assignee=${a.userId}`}
                        className="block py-2.5 hover:text-primary"
                        title={tPage('goToAgentLeads')}
                      >
                        {a.fullName}
                      </Link>
                    </td>
                    <td className="py-0 text-right tabular-nums">
                      <Link href={`/leads?assignee=${a.userId}`} className="block py-2.5 group-hover:bg-muted/40">{a.leads}</Link>
                    </td>
                    <td className="py-0 text-right tabular-nums">
                      <Link href={`/leads?assignee=${a.userId}`} className="block py-2.5 group-hover:bg-muted/40">{a.calls}</Link>
                    </td>
                    <td className="py-0 text-right tabular-nums">
                      <Link href={`/leads?assignee=${a.userId}`} className="block py-2.5 group-hover:bg-muted/40">{a.showings}</Link>
                    </td>
                    <td className="py-0 text-right tabular-nums">
                      <Link href={`/deals?agentId=${a.userId}`} className="block py-2.5 group-hover:bg-muted/40">{a.deals}</Link>
                    </td>
                    <td className="py-0 text-right tabular-nums font-medium">
                      <Link href={`/deals?agentId=${a.userId}`} className="block py-2.5 group-hover:bg-muted/40">{formatPrice(a.commission)}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {/* ────────── LOST LEADS BY REASON ────────── */}
      {lostLeads.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <CardTitle className="text-base sm:text-lg flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-rose-500" />
                {t('lostLeads')}
              </CardTitle>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground tabular-nums">
                  {lostLeads.length} {tLeads('LOST').toLowerCase()}
                </span>
                <Link
                  href="/insights/lost-reasons"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {tPage('details')} →
                </Link>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {lostReasonEntries.map(([reason, count]) => {
                const pct = Math.round((count / lostLeads.length) * 100);
                const wPct = Math.max((count / maxLostCount) * 100, count > 0 ? 6 : 2);
                return (
                  <div key={reason} className="group">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium tracking-tightish truncate flex-1 mr-3">
                        {reason}
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        <span className="font-semibold text-foreground">{count}</span> · {pct}%
                      </span>
                    </div>
                    <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-500 group-hover:brightness-110"
                        style={{ width: `${wPct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* ────────── SOURCE ROI ────────── */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base sm:text-lg">{t('sourceRoi')}</CardTitle>
        </CardHeader>
        <CardContent className="overflow-x-auto">
          {roi.length === 0 ? (
            <p className="text-sm text-muted-foreground py-4 text-center">{t('noData')}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-left text-2xs uppercase tracking-wide text-muted-foreground border-b">
                <tr>
                  <th className="py-2.5">{t('sourceCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('leadsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('dealsCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('conversionCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('revenueCol')}</th>
                  <th className="py-2.5 text-right tabular-nums">{t('commissionCol')}</th>
                </tr>
              </thead>
              <tbody>
                {roi.map((r) => (
                  <tr key={r.sourceId} className="border-b last:border-0 hover:bg-muted/40 transition-colors">
                    <td className="py-2.5 font-medium">{r.sourceName}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.leads}</td>
                    <td className="py-2.5 text-right tabular-nums">{r.deals}</td>
                    <td className="py-2.5 text-right tabular-nums">
                      <span
                        className={cn(
                          'inline-block px-2 py-0.5 rounded-md text-xs font-medium',
                          r.conversion >= 30
                            ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                            : r.conversion >= 10
                              ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400'
                              : 'bg-slate-500/15 text-muted-foreground',
                        )}
                      >
                        {r.conversion}%
                      </span>
                    </td>
                    <td className="py-2.5 text-right tabular-nums">{formatPrice(r.revenue)}</td>
                    <td className="py-2.5 text-right tabular-nums font-medium">{formatPrice(r.commission)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ──────────────── Funnel row: трапециевидный бар, центрированный ──────────────── */
function FunnelRow({
  label,
  count,
  widthPct,
  gradient,
  conversionFromPrev,
  isLast,
}: {
  label: string;
  count: number;
  widthPct: number;
  gradient: string;
  conversionFromPrev: number | null;
  isLast: boolean;
}) {
  return (
    <>
      <div className="group flex items-center gap-3 sm:gap-4">
        {/* Левая колонка: label + конверсия */}
        <div className="w-32 sm:w-44 shrink-0 text-right">
          <div className="text-sm font-medium tracking-tightish truncate">{label}</div>
          {conversionFromPrev !== null && (
            <div className="text-3xs uppercase tracking-wide text-muted-foreground tabular-nums">
              {conversionFromPrev}%
            </div>
          )}
        </div>

        {/* Центральный бар — центрированный градиент, как сегмент конуса */}
        <div className="flex-1 relative h-11 sm:h-12 flex items-center justify-center">
          {/* Тонкая фоновая линия для всей дорожки */}
          <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-px bg-border/60" />

          {/* Сам сегмент: rounded pill с градиентом, шевронами по краям */}
          <div
            className={cn(
              'relative h-full rounded-xl bg-gradient-to-r shadow-soft transition-all duration-300',
              gradient,
              'group-hover:shadow-lift group-hover:brightness-105',
              count === 0 && 'opacity-25',
            )}
            style={{ width: `${widthPct}%` }}
          >
            {/* Глянцевая подсветка сверху */}
            <div className="absolute inset-x-0 top-0 h-1/2 rounded-t-xl bg-gradient-to-b from-white/15 to-transparent pointer-events-none" />
            {/* Число */}
            {count > 0 && (
              <div className="absolute inset-0 flex items-center justify-center text-white font-semibold text-sm tabular-nums drop-shadow-sm">
                {count}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка: ничего, симметрия */}
        <div className="w-8 shrink-0" />
      </div>

      {/* Разделитель — стрелочка между стадиями */}
      {!isLast && (
        <div className="flex justify-center py-0.5">
          <ArrowDown className="h-3 w-3 text-muted-foreground/40" />
        </div>
      )}
    </>
  );
}

/* ──────────────── KPI card with tone accent ──────────────── */
function KPI({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: number | string;
  tone: 'sky' | 'violet' | 'amber' | 'emerald';
}) {
  const toneClasses: Record<typeof tone, string> = {
    sky: 'from-sky-500/15 to-sky-500/0 text-sky-600 dark:text-sky-400',
    violet: 'from-violet-500/15 to-violet-500/0 text-violet-600 dark:text-violet-400',
    amber: 'from-amber-500/15 to-amber-500/0 text-amber-600 dark:text-amber-400',
    emerald: 'from-emerald-500/15 to-emerald-500/0 text-emerald-600 dark:text-emerald-400',
  };
  return (
    <Card className="relative p-3.5 surface-hover overflow-hidden">
      <div className={cn('absolute inset-0 bg-gradient-to-br pointer-events-none', toneClasses[tone])} />
      <div className="relative">
        <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center mb-2.5', toneClasses[tone])}>
          <Icon className="h-4 w-4" />
        </div>
        <div className="text-3xs uppercase tracking-wide text-muted-foreground font-medium">{label}</div>
        <div className="font-semibold text-lg sm:text-xl tabular-nums mt-0.5">{value}</div>
      </div>
    </Card>
  );
}
