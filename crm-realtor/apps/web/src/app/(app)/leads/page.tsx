'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  DndContext,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { Plus, Building2, ArrowRightLeft, ChevronLeft, ChevronRight, Flame, Star, Snowflake } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SourceIcon } from '@/components/source-badge';
import { PeriodPill } from '@/components/ui/period-pill';
import { leads, users, auth, type LeadDetailed, type LeadStage, type UserBriefList } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatPrice } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { LostReasonDialog } from '@/components/lost-reason-dialog';

const ACTIVE_STAGES: LeadStage[] = [
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHOWING',
  'NEGOTIATION',
  'WON',
];

import { STAGE_DOT, STAGE_BAR } from '@/lib/stage-style';

const STAGE_ACCENT: Record<LeadStage, { dot: string; bar: string }> = {
  NEW:         { dot: STAGE_DOT.NEW,         bar: STAGE_BAR.NEW },
  CONTACTED:   { dot: STAGE_DOT.CONTACTED,   bar: STAGE_BAR.CONTACTED },
  QUALIFIED:   { dot: STAGE_DOT.QUALIFIED,   bar: STAGE_BAR.QUALIFIED },
  SHOWING:     { dot: STAGE_DOT.SHOWING,     bar: STAGE_BAR.SHOWING },
  NEGOTIATION: { dot: STAGE_DOT.NEGOTIATION, bar: STAGE_BAR.NEGOTIATION },
  WON:         { dot: STAGE_DOT.WON,         bar: STAGE_BAR.WON },
  LOST:        { dot: STAGE_DOT.LOST,        bar: STAGE_BAR.LOST },
};

const STALE_DAYS = 7;
const ALL = '__ALL__';
type Period = 'ALL' | 'WEEK' | 'TWO_WEEKS' | 'MONTH';

export default function LeadsBoardPage() {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const tPriority = useTranslations('leads.priority');
  const tIntent = useTranslations('clients.intent');
  const tPage = useTranslations('leadsPage');
  const [items, setItems] = useState<LeadDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeId, setActiveId] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<UserBriefList[]>([]);
  const searchParams = useSearchParams();
  const initialAssignee = searchParams?.get('assignee') ?? ALL;
  const [period, setPeriod] = useState<Period>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>(initialAssignee);
  const [filterIntent, setFilterIntent] = useState<'ALL' | 'BUY' | 'RENT'>('ALL');
  const [compact, setCompact] = useState(false);
  const [showLost, setShowLost] = useState(false);
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Pending drag-to-LOST — resolved by <LostReasonDialog>.
  const [pendingLost, setPendingLost] = useState<{
    leadId: string;
    snapshot: LeadDetailed;
  } | null>(null);

  function scrollBy(delta: number) {
    scrollRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  }

  useEffect(() => {
    leads.list().then(setItems).finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    if (!me) auth.me().then((u) => useAuthStore.getState().setUser({ id: u.id, email: u.email, role: u.role }));
  }, [me]);

  useEffect(() => {
    if (isAdmin) users.list().then(setUsersList).catch(() => undefined);
  }, [isAdmin]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function onDragEnd(e: DragEndEvent) {
    setActiveId(null);
    const overId = e.over?.id;
    if (!overId || typeof overId !== 'string') return;
    const stage = overId as LeadStage;
    const leadId = e.active.id as string;
    const lead = items.find((l) => l.id === leadId);
    if (!lead || lead.stage === stage) return;

    if (stage === 'LOST') {
      // Defer to LostReasonDialog; don't move card optimistically yet.
      setPendingLost({ leadId, snapshot: lead });
      return;
    }

    setItems((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage } : l)));
    const previousStage = lead.stage;
    try {
      const updated = await leads.changeStage(leadId, stage);
      setItems((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      toast.success(t(`stages.${stage}`), {
        action: {
          label: 'Undo',
          onClick: () => {
            setItems((prev) =>
              prev.map((l) => (l.id === leadId ? { ...l, stage: previousStage } : l)),
            );
            leads.changeStage(leadId, previousStage).catch(() => undefined);
          },
        },
      });
    } catch {
      setItems((prev) => prev.map((l) => (l.id === leadId ? lead : l)));
      toast.error(t('saveError'));
    }
  }

  async function confirmLost(reason: string) {
    if (!pendingLost) return;
    const { leadId, snapshot } = pendingLost;
    setItems((prev) => prev.map((l) => (l.id === leadId ? { ...l, stage: 'LOST' } : l)));
    try {
      const updated = await leads.changeStage(leadId, 'LOST', reason);
      setItems((prev) => prev.map((l) => (l.id === leadId ? updated : l)));
      toast.success(t('stages.LOST'));
    } catch {
      setItems((prev) => prev.map((l) => (l.id === leadId ? snapshot : l)));
      toast.error(t('saveError'));
    } finally {
      setPendingLost(null);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function bulkReassign(userId: string) {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    await leads.bulkReassign(ids, userId);
    setSelected(new Set());
    leads.list().then(setItems);
  }

  async function bulkSetPriority(priority: 'hot' | 'warm' | 'cold') {
    if (selected.size === 0) return;
    const ids = Array.from(selected);
    // Optimistic
    setItems((prev) =>
      prev.map((l) => (ids.includes(l.id) ? { ...l, priority } : l)),
    );
    try {
      await Promise.all(ids.map((id) => leads.update(id, { priority })));
      toast.success(tPage('priorityBulkSet', { count: ids.length }));
    } catch {
      toast.error(tPage('priorityBulkError'));
      leads.list().then(setItems);
    }
    setSelected(new Set());
  }

  const filteredItems = useMemo(() => {
    const now = Date.now();
    return items.filter((l) => {
      if (filterAssignee !== ALL && l.assignedUser?.id !== filterAssignee) return false;
      if (filterIntent !== 'ALL' && (l.dealIntent ?? 'BUY') !== filterIntent) return false;
      if (period !== 'ALL') {
        const days = period === 'WEEK' ? 7 : period === 'TWO_WEEKS' ? 14 : 30;
        const age = now - new Date(l.stageChangedAt).getTime();
        if (age > days * 24 * 60 * 60 * 1000) return false;
      }
      return true;
    });
  }, [items, period, filterAssignee, filterIntent]);

  const grouped = useMemo(() => {
    const m = new Map<LeadStage, LeadDetailed[]>();
    const stages = showLost ? [...ACTIVE_STAGES, 'LOST' as LeadStage] : ACTIVE_STAGES;
    for (const stage of stages) m.set(stage, []);
    for (const l of filteredItems) m.get(l.stage)?.push(l);
    return m;
  }, [filteredItems, showLost]);

  if (loading) return <PageSkeleton variant="kanban" />;

  const activeLead = activeId ? items.find((l) => l.id === activeId) : null;

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('total', { count: items.length })}</p>
        </div>
        <div className="flex gap-2 items-center flex-wrap">
          {isAdmin && selected.size > 0 && (
            <div className="glass flex items-center gap-2 rounded-xl px-2.5 py-1.5 shadow-soft flex-wrap">
              <ArrowRightLeft className="h-4 w-4 text-primary" />
              <span className="text-sm font-medium">{t('selectedCount', { count: selected.size })}</span>
              <Select onValueChange={bulkReassign}>
                <SelectTrigger className="w-[180px] h-8 bg-white">
                  <SelectValue placeholder={t('reassignTo')} />
                </SelectTrigger>
                <SelectContent>
                  {usersList
                    .filter((u) => u.isActive && (u.role === 'REALTOR' || u.role === 'ASSISTANT'))
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
              <div className="inline-flex h-8 rounded-md border border-border overflow-hidden bg-white">
                {([
                  { value: 'hot' as const,  tone: 'hover:bg-red-50 hover:text-red-600' },
                  { value: 'warm' as const, tone: 'hover:bg-amber-50 hover:text-amber-600' },
                  { value: 'cold' as const, tone: 'hover:bg-sky-50 hover:text-sky-600' },
                ]).map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => bulkSetPriority(opt.value)}
                    className={cn(
                      'px-2.5 text-xs font-medium border-l border-border first:border-l-0 transition-colors',
                      opt.tone,
                    )}
                  >
                    {tPriority(opt.value)}
                  </button>
                ))}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
                {tCommon('cancel')}
              </Button>
            </div>
          )}
          <Button asChild>
            <Link href="/leads/new">
              <Plus className="h-4 w-4" />
              {t('addNew')}
            </Link>
          </Button>
        </div>
      </div>

      {/* Period + assignee filters + scroll controls */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 surface-card rounded-xl overflow-x-auto">
          <PeriodPill label={t('period.ALL')} active={period === 'ALL'} onClick={() => setPeriod('ALL')} />
          <PeriodPill label={t('period.WEEK')} active={period === 'WEEK'} onClick={() => setPeriod('WEEK')} />
          <PeriodPill label={t('period.TWO_WEEKS')} active={period === 'TWO_WEEKS'} onClick={() => setPeriod('TWO_WEEKS')} />
          <PeriodPill label={t('period.MONTH')} active={period === 'MONTH'} onClick={() => setPeriod('MONTH')} />
        </div>
        {isAdmin && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-9 min-w-[180px]">
              <SelectValue placeholder={t('filterAssignee')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allAssignees')}</SelectItem>
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
        <div className="inline-flex h-9 rounded-xl border border-border overflow-hidden surface-card">
          {(['ALL', 'BUY', 'RENT'] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => setFilterIntent(value)}
              className={cn(
                'px-3 text-xs font-medium tracking-tightish transition-colors',
                filterIntent === value
                  ? 'bg-primary text-primary-foreground'
                  : 'hover:bg-muted text-muted-foreground',
              )}
            >
              {value === 'ALL' ? tPage('intentAll') : tIntent(value)}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setCompact((v) => !v)}
          className={cn(
            'rounded-xl px-3 h-9 text-xs font-medium tracking-tightish surface-card transition-all hover:bg-muted',
            compact && 'bg-primary text-primary-foreground hover:bg-primary',
          )}
        >
          {compact ? t('expandColumns') : t('compactColumns')}
        </button>
        <button
          type="button"
          onClick={() => setShowLost((v) => !v)}
          className={cn(
            'rounded-xl px-3 h-9 text-xs font-medium tracking-tightish surface-card transition-all hover:bg-muted',
            showLost && 'bg-red-500/10 text-red-600 hover:bg-red-500/20',
          )}
        >
          {showLost ? tPage('hideLost') : tPage('showLost')}
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
        <div
          ref={scrollRef}
          className="flex gap-3 overflow-x-auto pb-4 -mx-2 px-2 scroll-smooth snap-x snap-mandatory sm:snap-none touch-pan-x overscroll-x-contain"
        >
          {(showLost ? [...ACTIVE_STAGES, 'LOST' as LeadStage] : ACTIVE_STAGES).map((stage) => {
            const stageLeads = grouped.get(stage) ?? [];
            return (
              <KanbanColumn key={stage} stage={stage} count={stageLeads.length} compact={compact}>
                {stageLeads.map((l) => (
                  <LeadCardDraggable
                    key={l.id}
                    lead={l}
                    selectable={isAdmin}
                    selected={selected.has(l.id)}
                    onToggleSelect={() => toggleSelect(l.id)}
                  />
                ))}
                {stageLeads.length === 0 && (
                  <div className="rounded-lg border-2 border-dashed border-border/60 py-6 text-center text-2xs text-muted-foreground/70">
                    {t('emptyStage')}
                  </div>
                )}
              </KanbanColumn>
            );
          })}
        </div>
        <DragOverlay>
          {activeLead && <LeadCardView lead={activeLead} dragging />}
        </DragOverlay>

        {/* LOST drag target — appears as a slim dashed bar under the columns.
            Dragging a card here opens LostReasonDialog with typed reasons. */}
        <LostDropTarget />
      </DndContext>

      {items.length === 0 && (
        <Card className="p-12 text-center text-sm text-muted-foreground">{t('empty')}</Card>
      )}

      <LostReasonDialog
        open={pendingLost !== null}
        onCancel={() => setPendingLost(null)}
        onConfirm={confirmLost}
      />
    </div>
  );
}

function LostDropTarget() {
  const t = useTranslations('leads.stages');
  const { setNodeRef, isOver } = useDroppable({ id: 'LOST' });
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'mt-3 flex h-14 items-center justify-center rounded-xl border-2 border-dashed text-xs font-medium uppercase tracking-eyebrow transition-colors',
        isOver
          ? 'border-danger bg-danger/10 text-danger'
          : 'border-border/60 text-muted-foreground hover:border-danger/40 hover:text-danger',
      )}
    >
      {t('LOST')} ↓
    </div>
  );
}

function KanbanColumn({
  stage,
  count,
  children,
  compact = false,
}: {
  stage: LeadStage;
  count: number;
  children: React.ReactNode;
  compact?: boolean;
}) {
  const t = useTranslations('leads.stages');
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const accent = STAGE_ACCENT[stage];
  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-xl shrink-0 flex flex-col overflow-hidden transition-all snap-start',
        // mobile (<sm): 80vw чтобы видеть карточку целиком, scroll-snap для удобной навигации
        compact ? 'w-[80vw] max-w-56 sm:w-56' : 'w-[80vw] max-w-72 sm:w-72',
        isOver ? 'ring-2 ring-primary shadow-glow bg-primary/[0.03]' : '',
      )}
    >
      <div className="surface-card flex flex-col h-full">
        {/* gradient bar on top */}
        <div className={cn('h-0.5 bg-gradient-to-r', accent.bar)} />
        <div className="sticky top-0 glass-strong px-3.5 py-2.5 flex items-center justify-between border-b z-10">
          <div className="flex items-center gap-2">
            <span className={cn('h-2 w-2 rounded-full', accent.dot)} />
            <span className="font-semibold text-sm tracking-tight2">{t(stage)}</span>
          </div>
          <Badge variant="secondary" className="text-3xs tabular-nums">
            {count}
          </Badge>
        </div>
        <div className="flex-1 p-2 space-y-2 min-h-[120px]">{children}</div>
      </div>
    </div>
  );
}

function LeadCardDraggable({
  lead,
  selectable,
  selected,
  onToggleSelect,
}: {
  lead: LeadDetailed;
  selectable: boolean;
  selected: boolean;
  onToggleSelect: () => void;
}) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: lead.id });
  return (
    <div
      ref={setNodeRef}
      style={isDragging ? { opacity: 0.3 } : undefined}
      className={cn('rounded-xl', selected && 'ring-2 ring-primary')}
    >
      <div className="flex items-start gap-1.5">
        {selectable && (
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelect}
            onClick={(e) => e.stopPropagation()}
            className="mt-2.5 ml-1.5 shrink-0 rounded text-primary focus:ring-primary"
          />
        )}
        <div className="flex-1 min-w-0" {...listeners} {...attributes}>
          <LeadCardView lead={lead} />
        </div>
      </div>
    </div>
  );
}

function getPriority(lead: LeadDetailed): 'hot' | 'warm' | 'cold' {
  // Use stored priority first (set during qualification)
  if (lead.priority === 'hot' || lead.priority === 'warm' || lead.priority === 'cold') {
    return lead.priority;
  }
  // Fall back to source-type heuristic
  const type = lead.source?.type;
  if (type === 'REFERRAL' || type === 'WEBSITE') return 'hot';
  if (type === 'FB_LEAD_ADS' || type === 'INSTAGRAM' || type === 'TELEGRAM') return 'cold';
  return 'warm';
}

function isStale(lead: LeadDetailed): boolean {
  if (['WON', 'LOST'].includes(lead.stage)) return false;
  const ms = Date.now() - new Date(lead.stageChangedAt).getTime();
  return ms > STALE_DAYS * 24 * 60 * 60 * 1000;
}

const PRIORITY_RING: Record<string, string> = {
  hot: 'before:bg-red-500',
  warm: 'before:bg-amber-500',
  cold: 'before:bg-sky-500',
};

function PriorityIcon({ p }: { p: string }) {
  if (p === 'hot') return <Flame className="h-3 w-3 text-red-500" />;
  if (p === 'cold') return <Snowflake className="h-3 w-3 text-sky-400" />;
  return <Star className="h-3 w-3 text-amber-500" />;
}

function LeadCardView({ lead, dragging = false }: { lead: LeadDetailed; dragging?: boolean }) {
  const priority = getPriority(lead);
  const stale = isStale(lead);
  const tCard = useTranslations('leadsPage');
  const tIntentCard = useTranslations('clients.intent');
  return (
    <Link
      href={`/leads/${lead.id}`}
      onClick={(e) => dragging && e.preventDefault()}
      className={cn(
        'relative block surface-card surface-hover p-3 pl-3.5 space-y-1.5 cursor-grab active:cursor-grabbing',
        "before:content-[''] before:absolute before:left-0 before:top-2 before:bottom-2 before:w-1 before:rounded-full",
        PRIORITY_RING[priority],
        dragging && 'shadow-lift rotate-1',
      )}
    >
      <div className="flex items-center gap-2">
        <Avatar name={lead.client.fullName} size="xs" />
        <span className="font-medium text-sm truncate flex-1 tracking-tightish">
          {lead.client.fullName}
        </span>
        <PriorityIcon p={priority} />
        {stale && (
          <span title={tCard('staleHint')} className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse shrink-0" />
        )}
      </div>
      {lead.interestProperty ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Building2 className="h-3 w-3 shrink-0" />
          <span className="truncate">
            <span className="font-medium text-foreground/90">
              {formatPrice(lead.interestProperty.price, lead.interestProperty.currency)}
              {(lead.dealIntent ?? 'BUY') === 'RENT' && tCard('perMonthSuffix')}
            </span>
            <span> · {lead.interestProperty.district}</span>
          </span>
        </div>
      ) : lead.interestNote ? (
        <div className="flex items-start gap-1.5 text-xs text-muted-foreground italic">
          <Building2 className="h-3 w-3 mt-0.5 shrink-0 opacity-60" />
          <span className="truncate" title={lead.interestNote}>{lead.interestNote}</span>
        </div>
      ) : null}
      <div className="flex items-center gap-1.5 flex-wrap">
        <Badge
          variant={(lead.dealIntent ?? 'BUY') === 'RENT' ? 'warning' : 'secondary'}
          className="text-3xs"
        >
          {(lead.dealIntent ?? 'BUY') === 'RENT' ? tIntentCard('RENT') : tIntentCard('BUY')}
        </Badge>
        {lead.source && (
          <Badge variant="secondary" className="text-3xs gap-1 pl-1">
            <SourceIcon type={lead.source.type} className="h-3 w-3" />
            {lead.source.name}
          </Badge>
        )}
        {lead.assignedUser && (
          <span className="text-3xs text-muted-foreground ml-auto truncate">
            {lead.assignedUser.fullName.split(' ')[0]}
          </span>
        )}
      </div>
    </Link>
  );
}
