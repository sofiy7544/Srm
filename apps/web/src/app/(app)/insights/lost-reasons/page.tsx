'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { TrendingDown, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { leads, type LeadDetailed } from '@/lib/api';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';

/**
 * /insights/lost-reasons — глибока аналітика LOST-лідів.
 *  - Топ причин (з %)
 *  - Розбивка по intent (BUY vs RENT)
 *  - Розбивка по джерелу (де найбільше зливаємо)
 *  - Розбивка по місяцю (динаміка)
 *  - Чорний список причин — топ 3 для розбору на ретро
 */
export default function LostReasonsPage() {
  const [lost, setLost] = useState<LeadDetailed[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    leads
      .list()
      .then((all) => setLost(all.filter((l) => l.stage === 'LOST')))
      .finally(() => setLoading(false));
  }, []);

  const analysis = useMemo(() => {
    if (lost.length === 0) return null;
    const total = lost.length;

    // 1. Top reasons
    const byReason: Record<string, number> = {};
    for (const l of lost) {
      const r = l.lostReason || 'Без причини';
      byReason[r] = (byReason[r] || 0) + 1;
    }
    const topReasons = Object.entries(byReason).sort((a, b) => b[1] - a[1]);

    // 2. By intent
    const byIntent = { BUY: 0, RENT: 0 };
    for (const l of lost) byIntent[l.dealIntent ?? 'BUY']++;

    // 3. By source
    const bySource: Record<string, number> = {};
    for (const l of lost) {
      const src = l.source?.name || 'Невідоме';
      bySource[src] = (bySource[src] || 0) + 1;
    }
    const topSources = Object.entries(bySource).sort((a, b) => b[1] - a[1]).slice(0, 8);

    // 4. By month (last 6 months)
    const byMonth: Record<string, number> = {};
    for (const l of lost) {
      const d = new Date(l.stageChangedAt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      byMonth[key] = (byMonth[key] || 0) + 1;
    }
    const sortedMonths = Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).slice(-6);

    return { total, topReasons, byIntent, topSources, sortedMonths };
  }, [lost]);

  if (loading) return <PageSkeleton variant="detail" />;

  if (!analysis) {
    return (
      <div className="space-y-5 animate-slide-up max-w-3xl">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/insights">
            <ArrowLeft className="h-4 w-4" />
            До аналітики
          </Link>
        </Button>
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-emerald-500/10 flex items-center justify-center mx-auto mb-3">
            <TrendingDown className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="font-medium">Жодного програного ліда</p>
          <p className="text-sm text-muted-foreground mt-1">Поки що відмінно — слідкуйте далі.</p>
        </Card>
      </div>
    );
  }

  const maxReason = Math.max(...analysis.topReasons.map(([, c]) => c), 1);
  const maxMonth = Math.max(...analysis.sortedMonths.map(([, c]) => c), 1);

  return (
    <div className="space-y-5 animate-slide-up max-w-5xl">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <Button variant="ghost" size="sm" asChild className="mb-2">
            <Link href="/insights">
              <ArrowLeft className="h-4 w-4" />
              До аналітики
            </Link>
          </Button>
          <h1 className="heading-page flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-rose-500" />
            Аналіз втрачених лідів
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Усього програно: <span className="font-semibold text-foreground">{analysis.total}</span>
          </p>
        </div>
      </div>

      {/* Top reasons */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Топ причин</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {analysis.topReasons.map(([reason, count]) => {
              const pct = Math.round((count / analysis.total) * 100);
              const wPct = (count / maxReason) * 100;
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
                      className="h-full rounded-full bg-gradient-to-r from-rose-500 to-rose-400"
                      style={{ width: `${wPct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-4">
        {/* By intent */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">За призначенням</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {(['BUY', 'RENT'] as const).map((intent) => {
              const c = analysis.byIntent[intent];
              const pct = analysis.total > 0 ? Math.round((c / analysis.total) * 100) : 0;
              return (
                <div key={intent}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{intent === 'BUY' ? 'Продаж' : 'Оренда'}</span>
                    <span className="text-xs text-muted-foreground tabular-nums">
                      <span className="font-semibold text-foreground">{c}</span> · {pct}%
                    </span>
                  </div>
                  <div className="relative h-2 rounded-full bg-muted overflow-hidden">
                    <div
                      className={cn(
                        'h-full rounded-full',
                        intent === 'BUY' ? 'bg-slate-500' : 'bg-amber-500',
                      )}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* By source */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">За джерелом</CardTitle>
          </CardHeader>
          <CardContent>
            <table className="w-full text-sm">
              <tbody>
                {analysis.topSources.map(([src, c]) => {
                  const pct = Math.round((c / analysis.total) * 100);
                  return (
                    <tr key={src} className="border-b last:border-0">
                      <td className="py-1.5 truncate">{src}</td>
                      <td className="py-1.5 text-right tabular-nums w-24">
                        <span className="font-medium">{c}</span>{' '}
                        <span className="text-muted-foreground">· {pct}%</span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </CardContent>
        </Card>
      </div>

      {/* Trend */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Динаміка по місяцях</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {analysis.sortedMonths.map(([month, c]) => {
              const h = (c / maxMonth) * 100;
              return (
                <div key={month} className="flex-1 flex flex-col items-center gap-1.5">
                  <div className="flex-1 w-full flex items-end">
                    <div
                      className="w-full rounded-t-md bg-gradient-to-t from-rose-500 to-rose-400 hover:from-rose-600 hover:to-rose-500 transition-colors relative group"
                      style={{ height: `${h}%`, minHeight: c > 0 ? 4 : 0 }}
                    >
                      <span className="absolute -top-5 left-1/2 -translate-x-1/2 text-2xs font-medium tabular-nums opacity-0 group-hover:opacity-100 transition-opacity">
                        {c}
                      </span>
                    </div>
                  </div>
                  <div className="text-2xs text-muted-foreground tabular-nums">{month.slice(5)}/{month.slice(2, 4)}</div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent lost */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Останні програні</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {lost
              .sort((a, b) => new Date(b.stageChangedAt).getTime() - new Date(a.stageChangedAt).getTime())
              .slice(0, 10)
              .map((l) => (
                <Link
                  key={l.id}
                  href={`/leads/${l.id}`}
                  className="flex items-center justify-between gap-2 p-2.5 rounded-lg hover:bg-muted transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">{l.client.fullName}</div>
                    <div className="text-xs text-muted-foreground truncate">
                      {l.lostReason || 'Без причини'} · {l.dealIntent === 'RENT' ? 'Оренда' : 'Продаж'}
                    </div>
                  </div>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {formatDate(l.stageChangedAt)}
                  </span>
                </Link>
              ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
