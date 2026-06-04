'use client';

/**
 * /leads/[id] — Lead-Centric Workspace (AmoCRM-style)
 *
 * 3-panel layout:
 *   LEFT   (224px)  — searchable mini leads list
 *   CENTER (flex-1) — omnichannel chat + activities tab
 *   RIGHT  (288px)  — inline lead editing: stage, priority, assignee, actions
 *
 * Zero page navigations needed — everything happens on this screen.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import {
  Search, Briefcase, Trash2, Flame, Snowflake, Sparkles,
  Clock, Send, Phone, MessageSquare, Mail, Instagram,
  Loader2, ArrowLeft, Building2, CalendarPlus, ChevronRight, Plus,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PropertyForm } from '@/components/property-form';
import { CallDispositionDialog } from '@/components/call-disposition-dialog';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { PageSkeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  leads,
  messages as messagesApi,
  users,
  type LeadDetailed,
  type LeadStage,
  type MessageRow,
  type UserBriefList,
} from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { formatDate, formatPrice } from '@/lib/formatters';
import { ActivityTimeline } from '@/components/activity-timeline';
import { NotesPanel } from '@/components/notes-panel';
import { SourceIcon } from '@/components/source-badge';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { LostReasonDialog } from '@/components/lost-reason-dialog';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

// ─── Constants ────────────────────────────────────────────────────────────────

import { STAGE_LABEL, STAGE_DOT, STAGE_SOFT } from '@/lib/stage-style';

const STAGES: LeadStage[] = [
  'NEW', 'CONTACTED', 'QUALIFIED', 'SHOWING', 'NEGOTIATION', 'WON', 'LOST',
];

// Internal messaging/calls are disabled behind NEXT_PUBLIC_INTEGRATIONS_ENABLED.
// When off (default), the lead card shows no chat composer / channel tabs — only
// a Contacts block + Activity/Notes. The chat code (ChatPanel/CHANNELS) is kept
// and re-enabled by flipping the flag.
const INTEGRATIONS_ON = process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED === 'true';

type Channel = 'TELEGRAM' | 'WHATSAPP' | 'INSTAGRAM' | 'EMAIL' | 'PHONE';

const CHANNELS: {
  key: Channel;
  Icon: React.ComponentType<{ className?: string }>;
  activeColor: string;
}[] = [
  { key: 'TELEGRAM',  Icon: Send,          activeColor: 'text-blue-500' },
  { key: 'WHATSAPP',  Icon: MessageSquare, activeColor: 'text-green-500' },
  { key: 'INSTAGRAM', Icon: Instagram,     activeColor: 'text-pink-500' },
  { key: 'EMAIL',     Icon: Mail,          activeColor: 'text-gray-500' },
  { key: 'PHONE',     Icon: Phone,         activeColor: 'text-violet-500' },
];

function defaultChannel(sourceType?: string | null): Channel {
  const map: Record<string, Channel> = {
    TELEGRAM: 'TELEGRAM', WHATSAPP: 'WHATSAPP', INSTAGRAM: 'INSTAGRAM',
    EMAIL: 'EMAIL', WEBSITE: 'EMAIL', REFERRAL: 'PHONE',
    FB_LEAD_ADS: 'WHATSAPP', MANUAL: 'PHONE',
  };
  if (sourceType && map[sourceType]) return map[sourceType];
  return 'WHATSAPP';
}

function getPriority(lead: LeadDetailed): 'hot' | 'warm' | 'cold' {
  if (lead.priority === 'hot' || lead.priority === 'warm' || lead.priority === 'cold') {
    return lead.priority;
  }
  const t = lead.source?.type;
  if (t === 'REFERRAL' || t === 'WEBSITE') return 'hot';
  if (t === 'FB_LEAD_ADS' || t === 'INSTAGRAM' || t === 'TELEGRAM') return 'cold';
  return 'warm';
}

const UNASSIGNED = '__UNASSIGNED__';
const STALE_DAYS  = 7;

// ─── Sub-components ───────────────────────────────────────────────────────────

function LeadMiniCard({
  lead, active, onClick,
}: { lead: LeadDetailed; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full text-left px-3 py-2.5 flex items-center gap-2.5 transition-colors',
        'border-b border-border/40 hover:bg-muted/50',
        active && 'bg-primary/5 border-l-2 border-l-primary',
      )}
    >
      <Avatar name={lead.client.fullName} size="sm" className="shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium truncate">{lead.client.fullName}</div>
        <div className="flex items-center gap-1 mt-0.5">
          <span className={cn(
            'inline-flex items-center gap-1 text-[11px] px-1.5 py-0.5 rounded-full font-medium',
            STAGE_SOFT[lead.stage],
          )}>
            <span className={cn('h-1.5 w-1.5 rounded-full shrink-0', STAGE_DOT[lead.stage])} />
            {STAGE_LABEL[lead.stage]}
          </span>
          {lead.source?.type && (
            <SourceIcon type={lead.source.type} className="h-3 w-3 text-muted-foreground" />
          )}
        </div>
      </div>
      {active && <ChevronRight className="h-3.5 w-3.5 text-primary shrink-0" />}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

function ChatPanel({ lead }: { lead: LeadDetailed }) {
  const t = useTranslations('leadDetail');
  const tChannels = useTranslations('clients.channels');
  const [channel, setChannel] = useState<Channel>(() => defaultChannel(lead.source?.type));
  const [msgList, setMsgList] = useState<MessageRow[]>([]);
  const [text, setText]       = useState('');
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(false);
  const bottomRef             = useRef<HTMLDivElement>(null);

  const channelLabel = (k: Channel) => k === 'PHONE' ? t('phoneCall') : tChannels(k);
  const placeholderFor = (k: Channel) => {
    if (k === 'PHONE') return t('placeholderCall');
    if (k === 'EMAIL') return t('placeholderEmail');
    return t('placeholderChannel', { channel: tChannels(k) });
  };

  useEffect(() => {
    setLoading(true);
    messagesApi
      .list(lead.clientId, channel)
      .then(setMsgList)
      .catch(() => setMsgList([]))
      .finally(() => setLoading(false));
  }, [lead.clientId, channel]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [msgList]);

  // Reset when switching to a different lead
  useEffect(() => {
    setChannel(defaultChannel(lead.source?.type));
    setMsgList([]);
    setText('');
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lead.id]);

  async function handleSend() {
    const body = text.trim();
    if (!body) return;
    setText('');
    setSending(true);
    try {
      const res = await messagesApi.send(lead.clientId, { channel, body });
      setMsgList((prev) => [...prev, res.message]);
      if (!res.delivered) {
        toast.warning(t('savedNotDelivered', { note: res.note ?? '' }));
      }
    } catch {
      toast.error(t('sendError'));
      setText(body);
    } finally {
      setSending(false);
    }
  }

  function handleKey(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  const chMeta = CHANNELS.find((c) => c.key === channel) ?? CHANNELS[0];

  return (
    <div className="flex flex-col h-full min-h-0">

      {/* Channel tabs */}
      <div className="flex border-b border-border overflow-x-auto shrink-0">
        {CHANNELS.map(({ key, Icon, activeColor }) => (
          <button
            key={key}
            onClick={() => setChannel(key)}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2.5 text-xs font-medium whitespace-nowrap',
              'border-b-2 -mb-px transition-colors',
              channel === key
                ? 'border-primary text-primary bg-primary/5'
                : 'border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40',
            )}
          >
            <Icon className={cn('h-3.5 w-3.5', channel === key && activeColor)} />
            {channelLabel(key)}
          </button>
        ))}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-0">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : msgList.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-10 text-center text-muted-foreground gap-2">
            <chMeta.Icon className={cn('h-8 w-8 opacity-30', chMeta.activeColor)} />
            <p className="text-sm font-medium">{t('startChat')}</p>
            <p className="text-xs max-w-[200px]">{t('chatHint')}</p>
          </div>
        ) : (
          msgList.map((m) => {
            const isOut = m.activity?.direction === 'OUT';
            return (
              <div key={m.id} className={cn('flex', isOut ? 'justify-end' : 'justify-start')}>
                <div className={cn(
                  'max-w-[72%] px-3 py-2 rounded-2xl text-sm leading-relaxed',
                  isOut
                    ? 'bg-primary text-primary-foreground rounded-br-sm'
                    : 'bg-muted text-foreground rounded-bl-sm',
                )}>
                  <p>{m.body}</p>
                  <p className={cn(
                    'text-[10px] mt-1',
                    isOut ? 'text-primary-foreground/60' : 'text-muted-foreground',
                  )}>
                    {formatDate(m.createdAt)}
                  </p>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Composer */}
      <div className="shrink-0 border-t border-border p-2.5">
        <div className="flex gap-2 items-end">
          <textarea
            className={cn(
              'flex-1 resize-none border border-border rounded-xl px-3 py-2 text-sm bg-background',
              'focus:outline-none focus:ring-1 focus:ring-primary',
              'min-h-[38px] max-h-[120px] leading-relaxed',
            )}
            rows={1}
            placeholder={placeholderFor(channel)}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={handleKey}
          />
          <Button
            size="sm"
            onClick={handleSend}
            disabled={!text.trim() || sending}
            className="h-9 w-9 p-0 shrink-0"
          >
            {sending
              ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
              : <Send className="h-3.5 w-3.5" />}
          </Button>
        </div>
        <p className="text-[10px] text-muted-foreground mt-1 px-1">
          {t('keyHint')}
        </p>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LeadDetailPage() {
  const t = useTranslations('leadDetail');
  const tStages = useTranslations('leads.stages');
  const tPriority = useTranslations('leads.priority');
  const tIntent = useTranslations('clients.intent');
  const tNav = useTranslations('nav');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const id = params?.id;
  const confirm = useConfirm();
  const currentUser = useAuthStore((s) => s.user);

  const [lead, setLead]       = useState<LeadDetailed | null>(null);
  const [list, setList]       = useState<LeadDetailed[]>([]);
  const [agents, setAgents]   = useState<UserBriefList[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState('');
  const [tab, setTab]         = useState<'chat' | 'notes' | 'activity'>(INTEGRATIONS_ON ? 'chat' : 'activity');
  const [savingStage, setSavingStage]       = useState(false);
  const [savingAssign, setSavingAssign]     = useState(false);
  const [savingPriority, setSavingPriority] = useState(false);
  const [lostOpen, setLostOpen]             = useState(false);
  const [propertyDialogOpen, setPropertyDialogOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);

  useEffect(() => {
    leads.list().then(setList).catch(() => setList([]));
    users.list().then(setAgents).catch(() => setAgents([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    leads
      .get(id)
      .then(setLead)
      .catch(() => setLead(null))
      .finally(() => setLoading(false));
  }, [id]);

  const reloadLead = useCallback(async () => {
    if (!id) return;
    try {
      const fresh = await leads.get(id);
      setLead(fresh);
      setList((prev) => prev.map((l) => (l.id === fresh.id ? fresh : l)));
    } catch {
      /* ignore */
    }
  }, [id]);

  async function handleStageChange(next: LeadStage) {
    if (!lead || next === lead.stage) return;
    if (next === 'LOST') {
      setLostOpen(true);
      return;
    }
    setSavingStage(true);
    try {
      await leads.changeStage(lead.id, next);
      await reloadLead();
      toast.success(t('stageChanged', { stage: tStages(next) }));
    } catch {
      toast.error(t('stageChangeError'));
    } finally {
      setSavingStage(false);
    }
  }

  async function handleLostConfirm(reason: string) {
    if (!lead) return;
    setSavingStage(true);
    try {
      await leads.changeStage(lead.id, 'LOST', reason);
      await reloadLead();
      setLostOpen(false);
      toast.success(t('markedLost'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSavingStage(false);
    }
  }

  async function handleAssigneeChange(value: string) {
    if (!lead) return;
    const next = value === UNASSIGNED ? null : value;
    setSavingAssign(true);
    try {
      await leads.update(lead.id, { assignedUserId: next });
      await reloadLead();
      toast.success(t('assigneeUpdated'));
    } catch {
      toast.error(t('updateError'));
    } finally {
      setSavingAssign(false);
    }
  }

  async function handlePriorityChange(value: 'hot' | 'warm' | 'cold') {
    if (!lead) return;
    setSavingPriority(true);
    try {
      await leads.update(lead.id, { priority: value });
      await reloadLead();
    } catch {
      toast.error(t('errorShort'));
    } finally {
      setSavingPriority(false);
    }
  }

  async function handleDelete() {
    if (!lead) return;
    const ok = await confirm({
      title: t('deleteTitle'),
      description: t('deleteDescription'),
      confirmLabel: t('deleteConfirm'),
      cancelLabel: t('cancel'),
      destructive: true,
    });
    if (!ok) return;
    try {
      await leads.remove(lead.id);
      toast.success(t('deleted'));
      router.push('/leads');
    } catch {
      toast.error(t('deleteError'));
    }
  }

  const filteredList = list.filter((l) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return (
      l.client.fullName.toLowerCase().includes(q) ||
      l.client.primaryPhone.toLowerCase().includes(q)
    );
  });

  if (loading) return <PageSkeleton />;

  if (!lead) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 py-20">
        <p className="text-muted-foreground">{t('notFound')}</p>
        <Button variant="outline" size="sm" onClick={() => router.push('/leads')}>
          <ArrowLeft className="h-3.5 w-3.5 mr-1.5" />
          {t('backToList')}
        </Button>
      </div>
    );
  }

  const priority = getPriority(lead);
  const staleSince = lead.stageChangedAt
    ? Math.floor((Date.now() - new Date(lead.stageChangedAt).getTime()) / 86_400_000)
    : 0;
  const isStale = staleSince >= STALE_DAYS && lead.stage !== 'WON' && lead.stage !== 'LOST';

  return (
    <div className="flex h-[calc(100vh-3.5rem)] -mx-4 -my-4 lg:-mx-6 lg:-my-6 border-t border-border">
      {/* LEFT — mini leads list */}
      <aside className="hidden md:flex flex-col w-56 shrink-0 border-r border-border bg-muted/20">
        <div className="p-2.5 border-b border-border">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t('searchPlaceholder')}
              className="pl-8 h-8 text-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filteredList.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">{t('nothingFound')}</p>
          ) : (
            filteredList.map((l) => (
              <LeadMiniCard
                key={l.id}
                lead={l}
                active={l.id === lead.id}
                onClick={() => router.push(`/leads/${l.id}`)}
              />
            ))
          )}
        </div>
      </aside>

      {/* CENTER — chat + activity tabs */}
      <main className="flex-1 flex flex-col min-w-0">
        <div className="flex items-center gap-2 px-4 h-12 border-b border-border shrink-0">
          <Button
            variant="ghost"
            size="sm"
            className="md:hidden -ml-2 h-8 w-8 p-0"
            onClick={() => router.push('/leads')}
          >
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <Avatar name={lead.client.fullName} size="sm" />
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">{lead.client.fullName}</div>
            <a
              href={`tel:${lead.client.primaryPhone}`}
              onClick={() => setCallOpen(true)}
              className="text-[11px] text-muted-foreground truncate hover:text-primary transition-colors block"
            >
              {lead.client.primaryPhone}
            </a>
          </div>
          <div className="ml-auto flex items-center gap-1">
            {INTEGRATIONS_ON && (
              <button
                onClick={() => setTab('chat')}
                className={cn(
                  'text-xs px-2.5 py-1 rounded-md transition-colors',
                  tab === 'chat'
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-muted-foreground hover:bg-muted',
                )}
              >
                {t('tabChat')}
              </button>
            )}
            <button
              onClick={() => setTab('notes')}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md transition-colors',
                tab === 'notes'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t('tabNotes')}
            </button>
            <button
              onClick={() => setTab('activity')}
              className={cn(
                'text-xs px-2.5 py-1 rounded-md transition-colors',
                tab === 'activity'
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-muted',
              )}
            >
              {t('tabActivity')}
            </button>
          </div>
        </div>
        <div className="flex-1 min-h-0 flex flex-col">
          {/* Integrations off → static Contacts block instead of the chat panel. */}
          {!INTEGRATIONS_ON && (
            <div className="px-4 py-3 border-b border-border shrink-0">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">
                {tNav('contacts')}
              </h3>
              <a
                href={`tel:${lead.client.primaryPhone}`}
                className="inline-flex items-center gap-2 text-sm hover:text-primary transition-colors"
              >
                <Phone className="h-4 w-4 text-muted-foreground" />
                {lead.client.primaryPhone}
              </a>
            </div>
          )}
          <div className="flex-1 min-h-0">
            {INTEGRATIONS_ON && tab === 'chat' && <ChatPanel lead={lead} />}
            {tab === 'notes' && (
              <div className="p-4 overflow-y-auto h-full">
                <NotesPanel clientId={lead.clientId} leadId={lead.id} />
              </div>
            )}
            {tab === 'activity' && (
              <div className="p-4 overflow-y-auto h-full">
                <ActivityTimeline source="lead" id={lead.id} />
              </div>
            )}
          </div>
        </div>
      </main>

      {/* RIGHT — inline editing */}
      <aside className="hidden lg:flex flex-col w-72 shrink-0 border-l border-border overflow-y-auto">
        <div className="p-4 space-y-5">
          {/* Intent badge */}
          <div className={cn(
            'inline-flex items-center gap-1.5 self-start text-xs font-semibold px-2.5 py-1 rounded-full',
            lead.dealIntent === 'RENT'
              ? 'bg-amber-100 text-amber-800'
              : 'bg-slate-100 text-slate-800',
          )}>
            {lead.dealIntent === 'RENT' ? tIntent('RENT') : tIntent('BUY')}
          </div>

          {/* Stage */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {t('stage')}
            </label>
            <Select
              value={lead.stage}
              onValueChange={(v) => handleStageChange(v as LeadStage)}
              disabled={savingStage}
            >
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => (
                  <SelectItem key={s} value={s}>
                    <span className="flex items-center gap-2">
                      <span className={cn('h-2 w-2 rounded-full', STAGE_DOT[s])} />
                      {STAGE_LABEL[s]}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {isStale && (
              <p className="mt-1.5 flex items-center gap-1 text-[11px] text-amber-600">
                <Clock className="h-3 w-3" />
                {t('staleDays', { count: staleSince })}
              </p>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {t('priority')}
            </label>
            <div className="mt-1.5 grid grid-cols-3 gap-1.5">
              {(['hot', 'warm', 'cold'] as const).map((p) => {
                const Icon = p === 'hot' ? Flame : p === 'cold' ? Snowflake : Sparkles;
                const tint =
                  p === 'hot'   ? 'text-red-500'
                : p === 'cold'  ? 'text-sky-500'
                                : 'text-amber-500';
                const active = priority === p;
                return (
                  <button
                    key={p}
                    onClick={() => handlePriorityChange(p)}
                    disabled={savingPriority}
                    className={cn(
                      'flex items-center justify-center gap-1 text-xs py-1.5 rounded-md border transition-colors',
                      active
                        ? 'bg-primary/10 border-primary text-primary font-medium'
                        : 'border-border hover:bg-muted',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5', !active && tint)} />
                    {tPriority(p)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Assignee */}
          <div>
            <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
              {t('assignee')}
            </label>
            <Select
              value={lead.assignedUserId ?? UNASSIGNED}
              onValueChange={handleAssigneeChange}
              disabled={savingAssign}
            >
              <SelectTrigger className="mt-1.5 h-9">
                <SelectValue placeholder={t('unassigned')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>{t('unassignedDash')}</SelectItem>
                {agents
                  .filter((a) => a.isActive)
                  .map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.fullName}
                      {currentUser?.id === a.id ? ` (${t('me')})` : ''}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Source */}
          {lead.source && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('source')}
              </label>
              <div className="mt-1.5 flex items-center gap-2 text-sm">
                <SourceIcon type={lead.source.type} className="h-4 w-4 text-muted-foreground" />
                <span>{lead.source.name}</span>
              </div>
            </div>
          )}

          {/* Interest — CRM property OR free-text note */}
          {lead.interestProperty ? (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('interestProperty')}
              </label>
              {/* Stale-property warning: object was sold/archived by someone else while
                  this lead still references it. Without this badge the agent only
                  finds out after opening the property card. */}
              {(lead.interestProperty.status === 'SOLD' ||
                lead.interestProperty.status === 'ARCHIVED' ||
                (lead.interestProperty.status === 'RESERVED' && lead.stage !== 'NEGOTIATION' && lead.stage !== 'WON')) && (
                <div className="mt-1.5 mb-1.5 flex items-start gap-2 rounded-md border border-amber-300 bg-amber-50 dark:border-amber-700 dark:bg-amber-900/20 px-2.5 py-1.5 text-[11px] text-amber-800 dark:text-amber-300">
                  <span className="font-semibold">⚠</span>
                  <span>
                    {lead.interestProperty.status === 'SOLD' && t('propertyStaleSold')}
                    {lead.interestProperty.status === 'ARCHIVED' && t('propertyStaleArchived')}
                    {lead.interestProperty.status === 'RESERVED' && t('propertyStaleReserved')}
                  </span>
                </div>
              )}
              <Link
                href={`/properties/${lead.interestProperty.id}`}
                className="mt-1.5 flex items-start gap-2 text-sm hover:text-primary transition-colors group"
              >
                <Building2 className="h-4 w-4 mt-0.5 text-muted-foreground shrink-0" />
                <div className="min-w-0">
                  <div className="truncate">{lead.interestProperty.address}</div>
                  <div className="text-xs text-muted-foreground">
                    {lead.interestProperty.district} ·{' '}
                    {formatPrice(lead.interestProperty.price, lead.interestProperty.currency)}
                    {lead.dealIntent === 'RENT' && t('perMonth')}
                  </div>
                </div>
              </Link>
            </div>
          ) : (lead.interestNote || lead.interestPhotoUrl) ? (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('interestNote')}
              </label>
              {lead.interestPhotoUrl && (
                <a
                  href={lead.interestPhotoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-1.5 block rounded-lg overflow-hidden border border-border"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={lead.interestPhotoUrl}
                    alt={t('photoAlt')}
                    className="w-full max-h-48 object-cover"
                  />
                </a>
              )}
              {lead.interestNote && (
                <div className="mt-1.5 rounded-md border border-dashed border-border bg-muted/30 px-3 py-2 text-sm whitespace-pre-wrap break-words">
                  {lead.interestNote}
                </div>
              )}
              <button
                type="button"
                onClick={() => setPropertyDialogOpen(true)}
                className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t('createCardFromNote')}
              </button>
            </div>
          ) : null}

          {/* Lost reason */}
          {lead.stage === 'LOST' && lead.lostReason && (
            <div>
              <label className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">
                {t('lostReasonLabel')}
              </label>
              <p className="mt-1.5 text-sm text-red-700 bg-red-50 px-2.5 py-1.5 rounded-md">
                {lead.lostReason}
              </p>
            </div>
          )}

          {/* Actions */}
          <div className="pt-3 border-t border-border space-y-1.5">
            <a
              href={`tel:${lead.client.primaryPhone}`}
              onClick={() => setCallOpen(true)}
              className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <span className="flex items-center gap-2">
                <Phone className="h-3.5 w-3.5 text-emerald-500" />
                {t('callAction')}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </a>
            {lead.clientId && (
              <Link
                href={`/clients/${lead.clientId}`}
                className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
              >
                <span className="flex items-center gap-2">
                  <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                  {t('clientCard')}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Link>
            )}
            <Link
              href={`/tasks?leadId=${lead.id}`}
              className="flex items-center justify-between text-sm px-2 py-1.5 rounded-md hover:bg-muted transition-colors"
            >
              <span className="flex items-center gap-2">
                <CalendarPlus className="h-3.5 w-3.5 text-muted-foreground" />
                {t('leadTasks')}
              </span>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
            </Link>
            <button
              onClick={handleDelete}
              className="w-full flex items-center gap-2 text-sm px-2 py-1.5 rounded-md text-red-600 hover:bg-red-50 transition-colors"
            >
              <Trash2 className="h-3.5 w-3.5" />
              {t('deleteLead')}
            </button>
          </div>

          {/* Footer */}
          <p className="text-[10px] text-muted-foreground pt-2">
            {t('createdAt', { date: formatDate(lead.createdAt) })}
          </p>
        </div>
      </aside>

      <LostReasonDialog
        open={lostOpen}
        onCancel={() => setLostOpen(false)}
        onConfirm={handleLostConfirm}
      />

      <CallDispositionDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        clientId={lead.clientId}
        clientName={lead.client.fullName}
        clientPhone={lead.client.primaryPhone}
        leadId={lead.id}
        onLogged={reloadLead}
      />

      <Dialog open={propertyDialogOpen} onOpenChange={setPropertyDialogOpen}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{t('createCardFromNote')}</DialogTitle>
          </DialogHeader>
          <PropertyForm
            defaults={{
              dealIntent: lead.dealIntent,
              description: lead.interestNote ?? '',
            }}
            submitLabel={t('createAndLink')}
            onSuccess={async (property) => {
              try {
                await leads.update(lead.id, {
                  interestPropertyId: property.id,
                });
                toast.success(t('propertyLinked'));
                setPropertyDialogOpen(false);
                await reloadLead();
              } catch {
                toast.error(t('linkError'));
              }
              return true; // suppress default redirect to /properties/:id
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}