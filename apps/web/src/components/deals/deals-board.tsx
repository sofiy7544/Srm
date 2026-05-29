'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  deals,
  leads,
  tasks,
  users as usersApi,
  type DealRow,
  type LeadStage,
  type TaskRow,
  type UserBriefList,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { DealCard, DealCardDraggable } from './deal-card';
import { toast } from 'sonner';
import { LostReasonDialog } from '@/components/lost-reason-dialog';

/** Same 7-value LeadStage as leads — unified pipeline across the CRM. */
const STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHOWING',
  'NEGOTIATION',
  'WON',
  'LOST',
];

/** Color palette mirrors leads kanban for instant stage recognition. */
const STAGE_ACCENT: Record<LeadStage, { dot: string; bar: string }> = {
  NEW: { dot: 'bg-blue-500', bar: 'from-blue-500/80 to-blue-500/0' },
  CONTACTED: { dot: 'bg-sky-500', bar: 'from-sky-500/80 to-sky-500/0' },
  QUALIFIED: { dot: 'bg-cyan-500', bar: 'from-cyan-500/80 to-cyan-500/0' },
  SHOWING: { dot: 'bg-amber-500', bar: 'from-amber-500/80 to-amber-500/0' },
  NEGOTIATION: { dot: 'bg-violet-500', bar: 'from-violet-500/80 to-violet-500/0' },
  WON: { dot: 'bg-emerald-500', bar: 'from-emerald-500/80 to-emerald-500/0' },
  LOST: { dot: 'bg-red-500', bar: 'from-red-500/80 to-red-500/0' },
};

const ALL = '__ALL__';

interface DealsBoardProps {
  items: DealRow[];
  /** Колбэк после успешной смены стадии — чтобы перезагрузить родительский список. */
  onChanged?: () => void;
}

/**
 * Канбан сделок. Каждая сделка ссылается на свой Lead через `deal.leadId`,
 * и стадия читается/пишется именно у лида (`leads.changeStage`). Это
 * единый источник истины пайплайна — он же используется на странице /leads.
 *
 * Так канбан сделок = тот же бизнес-процесс, что и канбан лидов,
 * но в проекции "только сделки с amount/commission".
 */
export function DealsBoard({ items, onChanged }: DealsBoardProps) {
  const t = useTranslations('deals');
  const tLeads = useTranslations('leads');
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  // Локальный кэш стадии каждой сделки — для оптимистичных обновлений.
  // Источник стадии: deal.lead.stage (приходит из API).
  const [stageByDealId, setStageByDealId] = useState<Record<string, LeadStage>>({});

  // Pending drag-to-LOST — resolved by <LostReasonDialog>.
  const [pendingLost, setPendingLost] = useState<{
    dealId: string;
    deal: DealRow;
    previousStage: LeadStage;
  } | null>(null);

  useEffect(() => {
    const m: Record<string, LeadStage> = {};
    for (const d of items) {
      m[d.id] = (d.lead?.stage as LeadStage) ?? 'NEW';
    }
    setStageByDealId(m);
  }, [items]);

  // Следующее действие — ближайшая невыполненная задача по любому из лидов из items.
  const [nextActions, setNextActions] = useState<Record<string, { title: string; dueAt: string; overdue: boolean }>>({});
  useEffect(() => {
    const leadIds = items.map((d) => d.leadId).filter(Boolean);
    if (leadIds.length === 0) return;
    // tasks API не умеет фильтр "по списку лидов" — берём все pending + overdue и фильтруем на клиенте.
    Promise.all([tasks.list({ status: 'PENDING' }), tasks.list({ status: 'OVERDUE' })])
      .then(([p, o]) => {
        const all: TaskRow[] = [...p.items, ...o.items];
        const byLead = new Map<string, TaskRow>();
        // выберем самую раннюю по каждому лиду
        for (const ts of all) {
          if (!ts.leadId) continue;
          const prev = byLead.get(ts.leadId);
          if (!prev || new Date(ts.dueAt) < new Date(prev.dueAt)) byLead.set(ts.leadId, ts);
        }
        const result: Record<string, { title: string; dueAt: string; overdue: boolean }> = {};
        for (const d of items) {
          const tk = byLead.get(d.leadId);
          if (tk) result[d.id] = { title: tk.title, dueAt: tk.dueAt, overdue: tk.status === 'OVERDUE' };
        }
        setNextActions(result);
      })
      .catch(() => undefined);
  }, [items]);

  // Фильтры / поиск.
  const [search, setSearch] = useState('');
  const [filterAgent, setFilterAgent] = useState<string>(ALL);
  const [compact, setCompact] = useState(false);
  const [usersList, setUsersList] = useState<UserBriefList[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (isAdmin) usersApi.list().then(setUsersList).catch(() => undefined);
  }, [isAdmin]);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return items.filter((d) => {
      if (filterAgent !== ALL && d.agent.id !== filterAgent) return false;
      if (!q) return true;
      const hay =
        `${d.client.fullName} ${d.property.address} ${d.property.district} ${d.agent.fullName} ${String(d.amount)}`.toLowerCase();
      return hay.includes(q);
    });
  }, [items, search, filterAgent]);

  // Группировка по стадиям (используем локальный кэш для оптимистичных обновлений)
  const grouped = useMemo(() => {
    const m = new Map<LeadStage, DealRow[]>();
    for (const s of STAGES) m.set(s, []);
    for (const d of filtered) {
      const stage = stageByDealId[d.id] ?? (d.lead?.stage as LeadStage) ?? 'NEW';
      m.get(stage)?.push(d);
    }
    return m;
  }, [filtered, stageByDealId]);

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId || typeof overId !== 'string') return;
    const stage = overId as LeadStage;
    const dealId = e.active.id as string;
    const deal = items.find((d) => d.id === dealId);
    if (!deal) return;
    const currentStage = stageByDealId[dealId] ?? (deal.lead?.stage as LeadStage);
    if (currentStage === stage) return;

    if (stage === 'LOST') {
      // Defer to LostReasonDialog (mounted at end of board).
      setPendingLost({ dealId, deal, previousStage: currentStage });
      return;
    }

    // optimistic
    setStageByDealId((prev) => ({ ...prev, [dealId]: stage }));

    try {
      await leads.changeStage(deal.leadId, stage);
      // Дополнительно: если сделку закрыли как WON и она ещё IN_PROGRESS — отмечаем COMPLETED.
      if (stage === 'WON' && deal.status === 'IN_PROGRESS') {
        await deals.update(deal.id, { status: 'COMPLETED', closedAt: new Date().toISOString() });
      }
      onChanged?.();
    } catch {
      // откатываем кэш
      setStageByDealId((prev) => ({ ...prev, [dealId]: currentStage }));
      toast.error(tLeads('saveError'));
    }
  }

  async function confirmLost(reason: string) {
    if (!pendingLost) return;
    const { dealId, deal, previousStage } = pendingLost;
    setStageByDealId((prev) => ({ ...prev, [dealId]: 'LOST' }));
    try {
      await leads.changeStage(deal.leadId, 'LOST', reason);
      if (deal.status === 'IN_PROGRESS') {
        await deals.update(deal.id, { status: 'CANCELLED' });
      }
      onChanged?.();
      toast.success(tLeads('stages.LOST'));
    } catch {
      setStageByDealId((prev) => ({ ...prev, [dealId]: previousStage }));
      toast.error(tLeads('saveError'));
    } finally {
      setPendingLost(null);
    }
  }

  const activeDeal = activeId ? items.find((d) => d.id === activeId) ?? null : null;

  if (items.length === 0) {
    return (
      <div className="surface-card p-12 text-center text-sm text-muted-foreground">
        {t('boardEmpty')}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Тулбар канбана */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="h-9 pl-8 w-[240px]"
          />
        </div>

        {isAdmin && (
          <Select value={filterAgent} onValueChange={setFilterAgent}>
            <SelectTrigger className="h-9 min-w-[180px]">
              <SelectValue placeholder={t('filtersAgent')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('anyAgent')}</SelectItem>
              {usersList
                .filter((u) => u.isActive)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}

        <button
          type="button"
          onClick={() => setCompact((v) => !v)}
          className={cn(
            'rounded-xl px-3 h-9 text-xs font-medium tracking-tightish surface-card transition-all hover:bg-muted',
            compact && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {compact ? tLeads('expandColumns') : tLeads('compactColumns')}
        </button>

        <div className="ml-auto flex gap-1">
          <button
            type="button"
            onClick={() => scrollBy(-400)}
            className="h-9 w-9 rounded-xl surface-card flex items-center justify-center hover:bg-muted transition-all"
            aria-label="scroll-left"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => scrollBy(400)}
            className="h-9 w-9 rounded-xl surface-card flex items-center justify-center hover:bg-muted transition-all"
            aria-label="scroll-right"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        onDragStart={(e: DragStartEvent) => setActiveId(e.active.id as string)}
        onDragEnd={onDragEnd}
      >
        <div ref={scrollRef} className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 scroll-smooth">
          {STAGES.map((stage) => {
            const list = grouped.get(stage) ?? [];
            return (
              <BoardColumn key={stage} stage={stage} count={list.length} amounts={sumAmount(list)} compact={compact}>
                {list.map((d) => (
                  <DealCardDraggable
                    key={d.id}
                    deal={d}
                    nextAction={nextActions[d.id] ? { title: nextActions[d.id].title, dueAt: nextActions[d.id].dueAt } : null}
                    overdue={nextActions[d.id]?.overdue}
                  />
                ))}
                {list.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-border/60 py-6 text-center text-2xs text-muted-foreground/70">
                    {t('boardEmpty')}
                  </div>
                )}
              </BoardColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeDeal && (
            <DealCard
              deal={activeDeal}
              dragging
              nextAction={
                nextActions[activeDeal.id]
                  ? { title: nextActions[activeDeal.id].title, dueAt: nextActions[activeDeal.id].dueAt }
                  : null
              }
              overdue={nextActions[activeDeal.id]?.overdue}
            />
          )}
        </DragOverlay>
      </DndContext>

      <LostReasonDialog
        open={pendingLost !== null}
        onCancel={() => setPendingLost(null)}
        onConfirm={confirmLost}
      />
    </div>
  );
}

function BoardColumn({
  stage,
  count,
  amounts,
  children,
  compact = false,
}: {
  stage: LeadStage;
  count: number;
  amounts: number;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const t = useTranslations('leads.stages');
  const tDeals = useTranslations('deals');
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const accent = STAGE_ACCENT[stage];

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl shrink-0 flex flex-col overflow-hidden transition-all',
        compact ? 'w-56' : 'w-72',
        isOver ? 'ring-2 ring-primary shadow-glow bg-primary/[0.03]' : '',
      )}
    >
      <div className="surface-card flex flex-col h-full">
        <div className={cn('h-0.5 bg-gradient-to-r', accent.bar)} />
        <div className="sticky top-0 glass-strong px-3.5 py-2.5 border-b z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className={cn('h-2 w-2 rounded-full', accent.dot)} />
              <span className="font-semibold text-sm tracking-tight2">{t(stage)}</span>
            </div>
            <Badge variant="secondary" className="text-3xs tabular-nums">
              {count}
            </Badge>
          </div>
          {amounts > 0 && (
            <div className="text-3xs text-muted-foreground tabular-nums mt-0.5">
              {tDeals('columnTotal', { amount: formatPrice(amounts) })}
            </div>
          )}
        </div>
        <div className="flex-1 p-2 space-y-2 min-h-[120px]">{children}</div>
      </div>
    </div>
  );
}

function sumAmount(items: DealRow[]): number {
  return items.reduce((s, d) => s + Number(d.amount), 0);
}
