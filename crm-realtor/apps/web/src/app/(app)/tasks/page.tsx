'use client';

import { useEffect, useMemo, useState } from 'react';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  CheckCircle2,
  Circle,
  Clock,
  Plus,
  AlertTriangle,
  Phone,
  Calendar as CalendarIcon,
  Zap,
  FileText,
  Undo2,
  Loader2,
  RotateCcw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Avatar } from '@/components/ui/avatar';
import { PeriodPill } from '@/components/ui/period-pill';
import {
  tasks,
  users as usersApi,
  clients as clientsApi,
  auth,
  type TaskRow,
  type UserBriefList,
  type ClientDetailed,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate } from '@/lib/formatters';
import { cn } from '@/lib/utils';
import { WheelTimePicker } from '@/components/wheel-time-picker';

const TASK_TYPES = ['CALL', 'SHOWING', 'FOLLOWUP', 'CUSTOM'];
const ALL = '__ALL__';
type Period = 'ALL' | 'TODAY' | 'WEEK' | 'MONTH' | 'OVERDUE';

const TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  CALL: Phone,
  SHOWING: CalendarIcon,
  FOLLOWUP: Zap,
  CUSTOM: FileText,
};

const TYPE_TONE: Record<string, string> = {
  CALL: 'text-blue-600 bg-blue-50',
  SHOWING: 'text-violet-600 bg-violet-50',
  FOLLOWUP: 'text-amber-600 bg-amber-50',
  CUSTOM: 'text-muted-foreground bg-muted',
};

function addDays(d: Date, n: number): Date {
  const out = new Date(d);
  out.setDate(out.getDate() + n);
  return out;
}

function withTime(d: Date, h: number, m = 0): Date {
  const out = new Date(d);
  out.setHours(h, m, 0, 0);
  return out;
}

function nextWeekday(weekday: number): Date {
  const today = new Date();
  const cur = today.getDay() || 7;
  const target = weekday || 7;
  let delta = target - cur;
  if (delta <= 0) delta += 7;
  return addDays(today, delta);
}

export default function TasksPage() {
  const t = useTranslations('tasks');
  const tCommon = useTranslations('common');
  const tPage = useTranslations('tasksPage');
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [items, setItems] = useState<TaskRow[]>([]);
  const [allItems, setAllItems] = useState<TaskRow[]>([]);
  const [status, setStatus] = useState(ALL);
  const [period, setPeriod] = useState<Period>('ALL');
  const [filterAssignee, setFilterAssignee] = useState<string>(ALL);
  const [creating, setCreating] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [usersList, setUsersList] = useState<UserBriefList[]>([]);

  // create form
  const [title, setTitle] = useState('');
  const [type, setType] = useState('CALL');
  const [assigneeId, setAssigneeId] = useState('');
  const [clientId, setClientId] = useState<string>('');
  const [clientsList, setClientsList] = useState<ClientDetailed[]>([]);
  const [due, setDue] = useState<Date>(withTime(addDays(new Date(), 1), 10));
  const [showTimePicker, setShowTimePicker] = useState(false);

  function reload() {
    Promise.all([
      tasks.list(status === ALL ? {} : { status }),
      tasks.list({}),
    ]).then(([filtered, all]) => {
      setItems(filtered.items);
      setAllItems(all.items);
    });
  }

  useEffect(() => {
    if (!me) auth.me().then((u) => useAuthStore.getState().setUser({ id: u.id, email: u.email, role: u.role }));
  }, [me]);

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  useEffect(() => {
    if (isAdmin) usersApi.list().then(setUsersList).catch(() => undefined);
  }, [isAdmin]);

  useEffect(() => {
    if (creating && clientsList.length === 0) {
      clientsApi.list({ pageSize: 200 }).then((d) => setClientsList(d.items)).catch(() => undefined);
    }
  }, [creating, clientsList.length]);

  useEffect(() => {
    if (me?.id && !assigneeId) setAssigneeId(me.id);
  }, [me?.id, assigneeId]);

  const counts = useMemo(
    () => ({
      all: allItems.length,
      PENDING: allItems.filter((t) => t.status === 'PENDING').length,
      OVERDUE: allItems.filter((t) => t.status === 'OVERDUE').length,
      DONE: allItems.filter((t) => t.status === 'DONE').length,
    }),
    [allItems],
  );

  const visibleItems = useMemo(() => {
    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);
    const todayEnd = new Date(todayStart);
    todayEnd.setDate(todayEnd.getDate() + 1);
    const weekEnd = new Date(todayStart);
    weekEnd.setDate(weekEnd.getDate() + 7);
    const monthEnd = new Date(todayStart);
    monthEnd.setMonth(monthEnd.getMonth() + 1);

    let arr = items.slice();
    if (filterAssignee !== ALL) {
      arr = arr.filter((t) => t.user?.id === filterAssignee);
    }
    if (period !== 'ALL') {
      arr = arr.filter((t) => {
        const due = new Date(t.dueAt);
        if (period === 'OVERDUE') return due < todayStart && t.status !== 'DONE';
        if (period === 'TODAY') return due >= todayStart && due < todayEnd;
        if (period === 'WEEK') return due >= todayStart && due < weekEnd;
        if (period === 'MONTH') return due >= todayStart && due < monthEnd;
        return true;
      });
    }
    // Sort: DONE always last; within groups by dueAt ascending
    arr.sort((a, b) => {
      const aDone = a.status === 'DONE' ? 1 : 0;
      const bDone = b.status === 'DONE' ? 1 : 0;
      if (aDone !== bDone) return aDone - bDone;
      return new Date(a.dueAt).getTime() - new Date(b.dueAt).getTime();
    });
    return arr;
  }, [items, period, filterAssignee]);

  async function addTask(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setBusy('create');
    try {
      await tasks.create({
        title: title.trim(),
        type,
        dueAt: due.toISOString(),
        userId: isAdmin && assigneeId !== me?.id ? assigneeId : undefined,
        clientId: clientId || undefined,
      });
      setTitle('');
      setClientId('');
      setDue(withTime(addDays(new Date(), 1), 10));
      setCreating(false);
      reload();
    } finally {
      setBusy(null);
    }
  }

  async function toggleComplete(task: TaskRow) {
    setBusy(task.id);
    try {
      if (task.status === 'DONE') {
        await tasks.update(task.id, { status: 'PENDING' });
      } else {
        await tasks.complete(task.id);
      }
      reload();
    } finally {
      setBusy(null);
    }
  }

  const pickerValue = due;

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-end justify-between gap-2 flex-wrap">
        <div>
          <h1 className="heading-page">{t('title')}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t('total', { count: counts.all })}</p>
        </div>
        <Button onClick={() => setCreating((v) => !v)}>
          <Plus className="h-4 w-4" />
          {t('addNew')}
        </Button>
      </div>

      {/* Status pills */}
      <div className="flex gap-1 p-1 surface-card rounded-xl w-fit overflow-x-auto">
        <StatusPill label={t('anyStatus')} active={status === ALL} count={counts.all} onClick={() => setStatus(ALL)} />
        <StatusPill label={t('statuses.PENDING')} active={status === 'PENDING'} count={counts.PENDING} onClick={() => setStatus('PENDING')} />
        <StatusPill label={t('statuses.OVERDUE')} active={status === 'OVERDUE'} count={counts.OVERDUE} tone="danger" onClick={() => setStatus('OVERDUE')} />
        <StatusPill label={t('statuses.DONE')} active={status === 'DONE'} count={counts.DONE} tone="success" onClick={() => setStatus('DONE')} />
      </div>

      {/* Create form */}
      {creating && (
        <Card className="p-5 animate-slide-up">
          <form onSubmit={addTask} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('formTitle')}
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                autoFocus
                placeholder={tPage('titlePlaceholder')}
              />
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('type')}
                </Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TASK_TYPES.map((tp) => (
                      <SelectItem key={tp} value={tp}>
                        {t(`types.${tp}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {isAdmin && (
                <div className="space-y-1.5">
                  <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                    {t('assignee')}
                  </Label>
                  <Select value={assigneeId} onValueChange={setAssigneeId}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {me && <SelectItem value={me.id}>{me.email} ({tPage('myself')})</SelectItem>}
                      {usersList
                        .filter((u) => u.id !== me?.id && u.isActive)
                        .map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.fullName} · {u.role}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  {assigneeId && me && assigneeId !== me.id && (
                    <p className="text-3xs text-amber-600">
                      {tPage('assigneeNotice')}
                    </p>
                  )}
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {tPage('clientLabel')} {(type === 'SHOWING' || type === 'CALL' || type === 'FOLLOWUP') ? tPage('recommended') : tPage('optional')}
              </Label>
              <Select value={clientId || '__NONE__'} onValueChange={(v) => setClientId(v === '__NONE__' ? '' : v)}>
                <SelectTrigger>
                  <SelectValue placeholder={tPage('noLink')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__NONE__">{tPage('noLinkDash')}</SelectItem>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} · {c.primaryPhone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-3xs text-muted-foreground">
                {type === 'SHOWING' ? tPage('hintShowing') : tPage('hintClientVisible')}
              </p>
            </div>

            {/* Quick due picker */}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('dueAt')}
              </Label>
              <div className="flex flex-wrap gap-1.5">
                <DueChip
                  label={tPage('dueChips.todayEvening')}
                  active={isSameDay(due, new Date()) && due.getHours() === 18}
                  onClick={() => setDue(withTime(new Date(), 18))}
                />
                <DueChip
                  label={tPage('dueChips.tomorrow10')}
                  active={isSameDay(due, addDays(new Date(), 1)) && due.getHours() === 10}
                  onClick={() => setDue(withTime(addDays(new Date(), 1), 10))}
                />
                <DueChip
                  label={tPage('dueChips.in3days')}
                  active={isSameDay(due, addDays(new Date(), 3))}
                  onClick={() => setDue(withTime(addDays(new Date(), 3), 10))}
                />
                <DueChip
                  label={tPage('dueChips.onMonday')}
                  active={isSameDay(due, nextWeekday(1))}
                  onClick={() => setDue(withTime(nextWeekday(1), 10))}
                />
                <DueChip
                  label={tPage('dueChips.in1week')}
                  active={isSameDay(due, addDays(new Date(), 7))}
                  onClick={() => setDue(withTime(addDays(new Date(), 7), 10))}
                />
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Input
                  type="date"
                  value={toDateInput(due)}
                  onChange={(e) => {
                    const [y, m, d] = e.target.value.split('-').map(Number);
                    if (!y) return;
                    const next = new Date(due);
                    next.setFullYear(y, m - 1, d);
                    setDue(next);
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowTimePicker(true)}
                  className="h-10 rounded-xl border border-border bg-surface px-3.5 text-sm tracking-tightish shadow-soft transition-all hover:border-primary/30 hover:bg-muted flex items-center gap-2"
                >
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span className="tabular-nums">
                    {String(due.getHours()).padStart(2, '0')}:{String(due.getMinutes()).padStart(2, '0')}
                  </span>
                  <span className="text-muted-foreground text-xs ml-auto">{tPage('change')}</span>
                </button>
              </div>

              <p className="text-xs text-muted-foreground tracking-tightish">
                {tPage('dueLabel')}: {formatHumanDue(due, tPage)}
              </p>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setCreating(false)}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={!title.trim() || busy === 'create'}>
                {busy === 'create' && <Loader2 className="h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {showTimePicker && (
        <WheelTimePicker
          value={pickerValue}
          onChange={setDue}
          onClose={() => setShowTimePicker(false)}
        />
      )}

      {/* Period + assignee filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 surface-card rounded-xl overflow-x-auto">
          <PeriodPill label={t('period.ALL')} active={period === 'ALL'} onClick={() => setPeriod('ALL')} />
          <PeriodPill label={t('period.TODAY')} active={period === 'TODAY'} onClick={() => setPeriod('TODAY')} />
          <PeriodPill label={t('period.WEEK')} active={period === 'WEEK'} onClick={() => setPeriod('WEEK')} />
          <PeriodPill label={t('period.MONTH')} active={period === 'MONTH'} onClick={() => setPeriod('MONTH')} />
          <PeriodPill label={t('period.OVERDUE')} active={period === 'OVERDUE'} onClick={() => setPeriod('OVERDUE')} />
        </div>
        {isAdmin && (
          <Select value={filterAssignee} onValueChange={setFilterAssignee}>
            <SelectTrigger className="h-9 min-w-[180px]">
              <SelectValue placeholder={t('assignee')} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={ALL}>{t('allAssignees')}</SelectItem>
              {me && <SelectItem value={me.id}>{me.email}</SelectItem>}
              {usersList
                .filter((u) => u.id !== me?.id && u.isActive)
                .map((u) => (
                  <SelectItem key={u.id} value={u.id}>
                    {u.fullName}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* List */}
      {visibleItems.length === 0 ? (
        <Card className="p-12 text-center">
          <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-emerald-100 to-emerald-50 flex items-center justify-center mx-auto mb-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600" />
          </div>
          <p className="font-medium">{t('empty')}</p>
        </Card>
      ) : (
        <div className="grid gap-2">
          {visibleItems.map((task) => (
            <TaskRowView
              key={task.id}
              task={task}
              busy={busy === task.id}
              onToggle={() => toggleComplete(task)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function StatusPill({
  label,
  count,
  active,
  onClick,
  tone,
}: {
  label: string;
  count: number;
  active: boolean;
  onClick: () => void;
  tone?: 'danger' | 'success';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all flex items-center gap-2 whitespace-nowrap',
        active
          ? 'bg-primary text-primary-foreground shadow-glow'
          : 'text-foreground/70 hover:bg-muted hover:text-foreground',
      )}
    >
      <span>{label}</span>
      <span
        className={cn(
          'tabular-nums rounded-full px-1.5 py-0 text-3xs min-w-[18px] inline-flex items-center justify-center',
          active
            ? 'bg-white/25 text-white'
            : tone === 'danger'
              ? 'bg-red-100 text-red-700'
              : tone === 'success'
                ? 'bg-emerald-100 text-emerald-700'
                : 'bg-muted text-foreground/60',
        )}
      >
        {count}
      </span>
    </button>
  );
}

function DueChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-full px-3 py-1.5 text-xs font-medium tracking-tightish border transition-all',
        active
          ? 'bg-primary text-primary-foreground border-primary shadow-glow'
          : 'bg-surface border-border text-foreground/80 hover:border-primary/40 hover:bg-muted',
      )}
    >
      {label}
    </button>
  );
}

function TaskRowView({
  task,
  busy,
  onToggle,
}: {
  task: TaskRow;
  busy: boolean;
  onToggle: () => void;
}) {
  const t = useTranslations('tasks');
  const tPage = useTranslations('tasksPage');
  const isDone = task.status === 'DONE';
  const isOverdue = task.status === 'OVERDUE';
  const due = new Date(task.dueAt);
  const TypeIcon = TYPE_ICONS[task.type] ?? FileText;

  return (
    <div
      className={cn(
        'group surface-card p-3.5 flex items-start gap-3 transition-all',
        isOverdue && 'border-danger/30 bg-red-50/30',
        isDone && 'bg-muted/30',
      )}
    >
      <button
        type="button"
        onClick={onToggle}
        disabled={busy}
        className="mt-0.5 shrink-0 transition-transform hover:scale-110 relative group/check"
        aria-label={isDone ? tPage('reopen') : tPage('markDone')}
        title={isDone ? tPage('reopenHint') : tPage('markDone')}
      >
        {busy ? (
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        ) : isDone ? (
          <>
            <CheckCircle2 className="h-5 w-5 text-emerald-600 group-hover/check:opacity-0 transition-opacity" />
            <Undo2 className="h-5 w-5 text-primary absolute inset-0 opacity-0 group-hover/check:opacity-100 transition-opacity" />
          </>
        ) : (
          <Circle className="h-5 w-5 text-muted-foreground hover:text-primary transition-colors" />
        )}
      </button>
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center shrink-0', TYPE_TONE[task.type])}>
        <TypeIcon className="h-3.5 w-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('font-medium tracking-tightish', isDone && 'line-through text-muted-foreground')}>
            {task.title}
          </span>
          {isOverdue && (
            <Badge variant="destructive" className="text-3xs gap-1">
              <AlertTriangle className="h-2.5 w-2.5" />
              {t('statuses.OVERDUE')}
            </Badge>
          )}
          {isDone && (
            <Badge variant="success" className="text-3xs">
              {t('statuses.DONE')}
            </Badge>
          )}
        </div>
        <div className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
          <Clock className="h-3 w-3" />
          <span>
            {formatDate(task.dueAt)} {due.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}
          </span>
          {task.client && (
            <>
              <span>·</span>
              <Link href={`/clients/${task.client.id}`} className="hover:text-primary transition-colors">
                {task.client.fullName}
              </Link>
            </>
          )}
          {task.user && (
            <>
              <span>·</span>
              <span className="flex items-center gap-1">
                <Avatar name={task.user.fullName} size="xs" className="h-4 w-4 text-[10px] ring-1" />
                {task.user.fullName.split(' ')[0]}
              </span>
            </>
          )}
        </div>
      </div>
      {isDone && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onToggle}
          className="opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
        >
          <RotateCcw className="h-3 w-3" />
          {tPage('reopenButton')}
        </Button>
      )}
    </div>
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function toDateInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatHumanDue(d: Date, t: (key: string, values?: Record<string, string | number>) => string): string {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = addDays(today, 1);
  const dayKey = new Date(d);
  dayKey.setHours(0, 0, 0, 0);
  const time = d.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  if (dayKey.getTime() === today.getTime()) return t('dueHuman.today', { time });
  if (dayKey.getTime() === tomorrow.getTime()) return t('dueHuman.tomorrow', { time });
  const datePart = d.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });
  return t('dueHuman.other', { date: datePart, time });
}
