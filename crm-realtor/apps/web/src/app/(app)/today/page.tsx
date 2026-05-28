"use client";

/**
 * /today — командний центр дня.
 * Показує: вітання, KPI-чіпи, сьогоднішні завдання, майбутні покази,
 * pipeline pulse, останні активності, стан воронки.
 */

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  Phone, Calendar as CalendarIcon,
  CheckCircle2, Sparkles, KanbanSquare,
  TrendingUp, Users, Building2, Handshake, Plus,
  MessageSquare, ChevronRight, Loader2,
} from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  reports, auth, tasks as tasksApi,
  type ReportDashboard, type ActivityRow,
  type ShowingRow, type LeadDetailed, type TaskRow,
} from "@/lib/api";
import { cn } from "@/lib/utils";
import { formatDate, formatPrice } from "@/lib/formatters";
import { STAGE_DOT as STAGE_COLOR, STAGE_LABEL } from "@/lib/stage-style";
import { toast } from "sonner";

type Me = Awaited<ReturnType<typeof auth.me>>;

const TASK_TYPE_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone, SHOWING: CalendarIcon, FOLLOWUP: MessageSquare, CUSTOM: CheckCircle2,
};

export default function TodayPage() {
  const t = useTranslations("todayHome");
  const tNav = useTranslations("nav");
  const tLeads = useTranslations("leads");

  const [me, setMe]           = useState<Me | null>(null);
  const [kpi, setKpi]         = useState<ReportDashboard | null>(null);
  const [activity, setActivity] = useState<ActivityRow[]>([]);
  const [showings, setShowings] = useState<ShowingRow[]>([]);
  const [recentLeads, setRecentLeads] = useState<LeadDetailed[]>([]);
  const [todayTasks, setTodayTasks]   = useState<TaskRow[]>([]);
  const [funnel, setFunnel]   = useState<Record<string, number>>({});
  const [completing, setCompleting] = useState<Set<string>>(new Set());

  useEffect(() => {
    auth.me().then(setMe).catch(() => undefined);
    reports.dashboard().then(setKpi).catch(() => undefined);
    reports.recentActivity().then(setActivity).catch(() => undefined);
    reports.upcomingShowings().then(setShowings).catch(() => undefined);
    reports.recentLeads().then(setRecentLeads).catch(() => undefined);
    reports.todayTasks().then(setTodayTasks).catch(() => undefined);
    reports.funnel().then(setFunnel).catch(() => undefined);
  }, []);

  const firstName = me?.fullName?.split(" ")[0] ?? "";
  const dateLocale = (me?.locale ?? "uk").replace("_", "-");

  // `new Date()` returns a slightly different millisecond on server vs client,
  // and `toLocaleDateString` may format differently between Node Intl and the
  // browser. Both cause React hydration mismatch. Render the date only after
  // mount so server HTML and first client render match exactly.
  const [mountedAt, setMountedAt] = useState<Date | null>(null);
  useEffect(() => {
    setMountedAt(new Date());
  }, []);

  const hour = mountedAt?.getHours() ?? 9;
  const greeting = hour < 12 ? t("greetMorning") : hour < 18 ? t("greetDay") : t("greetEvening");

  const nowTs = Date.now();
  const horizonTs = nowTs + 3 * 60 * 60 * 1000;
  const upcomingShowings = showings.filter((s) => {
    const ts = new Date(s.scheduledAt).getTime();
    return ts >= nowTs && ts <= horizonTs;
  });
  const pendingTasks   = todayTasks.filter((t) => t.status === "PENDING");
  const overdueTasks   = todayTasks.filter((t) => t.status === "OVERDUE");
  const completedTasks = todayTasks.filter((t) => t.status === "DONE");

  const STAGES_ORDERED = ["NEW","CONTACTED","QUALIFIED","SHOWING","NEGOTIATION","WON"] as const;
  const funnelTotal = Object.values(funnel).reduce((a,b) => a + b, 0);

  async function completeTask(id: string) {
    setCompleting((p) => new Set([...p, id]));
    try {
      await tasksApi.complete(id);
      setTodayTasks((prev) => prev.map((task) => task.id === id ? { ...task, status: "DONE" as const, completedAt: new Date().toISOString() } : task));
      toast.success(t("taskDone"));
    } catch {
      toast.error(t("errorShort"));
    } finally {
      setCompleting((p) => { const n = new Set(p); n.delete(id); return n; });
    }
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto animate-slide-up">

      {/* ── Greeting ── */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight2">
            {greeting}{firstName ? `, ${firstName}` : ""}! 👋
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5" suppressHydrationWarning>
            {mountedAt
              ? mountedAt.toLocaleDateString(dateLocale, { weekday: "long", day: "numeric", month: "long" })
              : " "}
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href="/leads/new"><Plus className="h-3.5 w-3.5 mr-1" />{tLeads("addNew")}</Link>
          </Button>
          <Button asChild size="sm">
            <Link href="/pipeline"><KanbanSquare className="h-3.5 w-3.5 mr-1" />{tNav("pipeline")}</Link>
          </Button>
        </div>
      </div>

      {/* ── KPI strip ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: t("kpi.activeLeads"),    value: kpi?.activeLeads,       icon: KanbanSquare, color: "text-primary",    bg: "bg-primary/8"  },
          { label: t("kpi.clients"),         value: kpi?.totalClients,      icon: Users,        color: "text-violet-500", bg: "bg-violet-500/8" },
          { label: t("kpi.properties"),      value: kpi?.totalProperties,   icon: Building2,    color: "text-amber-500",  bg: "bg-amber-500/8"  },
          { label: t("kpi.completedDeals"),  value: kpi?.completedDeals,    icon: Handshake,    color: "text-emerald-500", bg: "bg-emerald-500/8" },
        ].map((item) => {
          const Icon = item.icon;
          return (
            <Card key={item.label} className="p-4 flex items-center gap-3">
              <div className={cn("h-10 w-10 rounded-xl flex items-center justify-center shrink-0", item.bg)}>
                <Icon className={cn("h-5 w-5", item.color)} strokeWidth={1.75} />
              </div>
              <div>
                <div className="text-xl font-bold tracking-tight">
                  {kpi ? item.value ?? 0 : <span className="h-5 w-8 bg-muted animate-pulse rounded block" />}
                </div>
                <div className="text-xs text-muted-foreground leading-tight">{item.label}</div>
              </div>
            </Card>
          );
        })}
      </div>

      {/* ── AI Briefing placeholder ── */}
      <Card className="p-4 border-primary/20 bg-gradient-to-r from-primary/5 to-violet-500/5">
        <div className="flex items-start gap-3">
          <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-primary to-violet-500 flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex-1">
            <div className="text-sm font-semibold">AI Briefing</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {t("briefingTasks", { count: pendingTasks.length })} · {t("briefingShowings", { count: upcomingShowings.length })}
              {overdueTasks.length > 0 && ` · ⚠️ ${t("briefingOverdue", { count: overdueTasks.length })}`}
            </div>
            {recentLeads.filter((l) => {
              const days = (Date.now() - new Date(l.stageChangedAt).getTime()) / 86400000;
              return days > 7 && !["WON","LOST"].includes(l.stage);
            }).length > 0 && (
              <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                ⚠️ {t("staleLeadsWarning")}
              </div>
            )}
          </div>
          <Badge variant="secondary" className="text-xs shrink-0">Beta</Badge>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">

        {/* ── Today's Tasks ── */}
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t("sections.todayTasks")}</h2>
            <Link href="/tasks" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              {t("seeAll")} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {todayTasks.length === 0 && !kpi ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />)}
            </div>
          ) : pendingTasks.length === 0 && overdueTasks.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 mx-auto mb-2 text-emerald-500 opacity-70" />
              {t("allDone")}
            </div>
          ) : (
            <div className="space-y-2">
              {[...overdueTasks, ...pendingTasks].slice(0,6).map((task) => {
                const Icon = TASK_TYPE_ICON[task.type] ?? CheckCircle2;
                const isOverdue = task.status === "OVERDUE";
                const done = completing.has(task.id);
                return (
                  <div key={task.id} className={cn(
                    "flex items-center gap-3 p-2.5 rounded-lg border transition-all",
                    isOverdue ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20" : "border-border bg-muted/30"
                  )}>
                    <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center shrink-0",
                      isOverdue ? "bg-red-100 dark:bg-red-900/40" : "bg-muted"
                    )}>
                      <Icon className={cn("h-3.5 w-3.5", isOverdue ? "text-red-500" : "text-muted-foreground")} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className={cn("text-sm font-medium truncate", isOverdue && "text-red-700 dark:text-red-300")}>
                        {task.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {task.client?.fullName} · {formatDate(task.dueAt)}
                      </div>
                    </div>
                    <button
                      onClick={() => completeTask(task.id)}
                      disabled={done}
                      className="h-6 w-6 rounded-full border-2 border-muted-foreground/30 hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/20 transition-all flex items-center justify-center shrink-0"
                    >
                      {done ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3 opacity-0 group-hover:opacity-100" />}
                    </button>
                  </div>
                );
              })}
              {completedTasks.length > 0 && (
                <div className="text-xs text-muted-foreground text-center pt-1">
                  ✓ {t("doneToday", { count: completedTasks.length })}
                </div>
              )}
            </div>
          )}
        </Card>

        {/* ── Upcoming showings ── */}
        <Card className="p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-sm">{t("sections.upcomingShowings")}</h2>
            <Link href="/calendar" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              {tNav("calendar")} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          {upcomingShowings.length === 0 ? (
            <div className="text-center py-6 text-sm text-muted-foreground">
              <CalendarIcon className="h-6 w-6 mx-auto mb-2 opacity-30" />
              {t("noShowingsScheduled")}
            </div>
          ) : (
            <div className="space-y-2">
              {upcomingShowings.map((s) => (
                <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-amber-200 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-900/15">
                  <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/40 flex items-center justify-center shrink-0">
                    <CalendarIcon className="h-3.5 w-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{s.property.address}</div>
                    <div className="text-xs text-muted-foreground">
                      {s.client.fullName} · {new Date(s.scheduledAt).toLocaleTimeString(dateLocale, { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

      </div>

      {/* ── Pipeline Pulse (funnel) ── */}
      {funnelTotal > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-sm">{t("sections.funnel")}</h2>
            <Link href="/pipeline" className="text-xs text-primary hover:underline flex items-center gap-0.5">
              {t("openPipeline")} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
            {STAGES_ORDERED.map((stage) => {
              const count = funnel[stage] ?? 0;
              const pct = funnelTotal > 0 ? Math.round((count / funnelTotal) * 100) : 0;
              const color = STAGE_COLOR[stage] ?? "bg-muted";
              return (
                <Link key={stage} href={`/pipeline?stage=${stage}`} className="group flex flex-col items-center gap-1.5 p-2 rounded-lg hover:bg-muted/50 transition-all">
                  <div className={cn("h-1.5 w-full rounded-full", color, "opacity-80")} style={{ opacity: count > 0 ? 1 : 0.2 }} />
                  <div className="text-xl font-bold tracking-tight">{count}</div>
                  <div className="text-xs text-muted-foreground text-center leading-tight">{STAGE_LABEL[stage]}</div>
                  <div className="text-xs text-muted-foreground">{pct}%</div>
                </Link>
              );
            })}
          </div>
        </Card>
      )}

      {/* ── Recent Activity ── */}
      {activity.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-sm">{t("sections.recentActivity")}</h2>
          </div>
          <div className="space-y-2.5">
            {activity.slice(0, 6).map((a) => (
              <div key={a.id} className="flex items-start gap-3">
                <Avatar name={a.user?.fullName ?? "?"} size="xs" className="mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="text-sm text-foreground/85 leading-snug line-clamp-2">{a.content}</div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {a.user?.fullName} · {formatDate(a.createdAt)}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* ── Revenue strip ── */}
      {kpi && kpi.completedDeals > 0 && (
        <Card className="p-4 bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-900/20 dark:to-teal-900/20 border-emerald-200 dark:border-emerald-800">
          <div className="flex items-center gap-3">
            <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
            <div className="flex-1">
              <div className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {t("revenueLabel")}: <span className="font-bold">{formatPrice(kpi.totalAmount)}</span>
              </div>
              <div className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
                {t("commissionLabel")}: {formatPrice(kpi.totalCommission)} · {t("dealsCount", { count: kpi.completedDeals })}
              </div>
            </div>
          </div>
        </Card>
      )}

    </div>
  );
}
