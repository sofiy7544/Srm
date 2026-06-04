"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, redirect } from "next/navigation";
import { useTranslations } from "next-intl";
import Link from "next/link";
import {
  MessageSquare, Phone, Mail, Send, Search,
  CheckCheck, User, Loader2, Instagram, MessageCircle,
  UserPlus, X, AlertCircle, Check,
  Flame, Star, Snowflake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar } from "@/components/ui/avatar";
import {
  clients, leads, activities, users, sources,
  type ClientDetailed, type MessageRow, type ActivityRow,
  type LeadDetailed, type UserBriefList, type Source,
  messages,
} from "@/lib/api";
import { useAuthStore } from "@/lib/auth-store";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/formatters";
import { toast } from "sonner";

/* ─── Channel meta ─────────────────────────────────────────────────────────── */
type Channel = "WHATSAPP" | "TELEGRAM" | "INSTAGRAM" | "EMAIL" | "PHONE";

const CHANNEL_META: Record<Channel, {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  sourceType: string;
}> = {
  WHATSAPP:  { label: "WhatsApp",  icon: MessageSquare, color: "text-emerald-500", sourceType: "WHATSAPP" },
  TELEGRAM:  { label: "Telegram",  icon: MessageCircle, color: "text-sky-500",     sourceType: "TELEGRAM" },
  INSTAGRAM: { label: "Instagram", icon: Instagram,     color: "text-pink-500",    sourceType: "INSTAGRAM" },
  EMAIL:     { label: "Email",     icon: Mail,          color: "text-violet-500",  sourceType: "WEBSITE" },
  PHONE:     { label: "Phone",    icon: Phone,         color: "text-amber-500",   sourceType: "MANUAL" },
};

/* ─── Contact status ───────────────────────────────────────────────────────── */
type ContactStatus = "new" | "active" | "client";

function getStatus(contact: ClientDetailed, allLeads: LeadDetailed[]): ContactStatus {
  const lead = allLeads.find((l) => l.clientId === contact.id);
  if (!lead) return "new";
  if (lead.stage === "WON") return "client";
  return "active";
}

// Status labels resolved via `tStatus(s)` at render time so they react to locale.
const STATUS_COLOR: Record<ContactStatus, string> = {
  new:    "bg-amber-100 text-amber-700",
  active: "bg-sky-100 text-sky-700",
  client: "bg-emerald-100 text-emerald-700",
};

/* ─── Qualify form state ───────────────────────────────────────────────────── */
interface QualifyState {
  name: string;
  budget: string;
  description: string;
  assignTo: string;   // "self" | userId
  shareMode: "last" | "all" | "select";
  selectedMsgIds: Set<string>;
  priority: "hot" | "warm" | "cold";
}

const QUALIFY_EMPTY: QualifyState = {
  name: "",
  budget: "",
  description: "",
  assignTo: "self",
  shareMode: "last",
  selectedMsgIds: new Set(),
  priority: "warm",
};

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default function InboxPage() {
  // Internal messaging (Telegram/WhatsApp/Instagram/Email/Call) is disabled
  // behind NEXT_PUBLIC_INTEGRATIONS_ENABLED. While off, the chat screen must
  // never open — send users to the Pool. The chat code below stays intact and
  // re-activates when the flag is set to 'true'.
  if (process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED !== 'true') {
    redirect('/pool');
  }

  const router  = useRouter();
  const tStatus = useTranslations("inbox.status");
  const tQual   = useTranslations("inbox.qualify");
  const tToast  = useTranslations("inbox.toasts");
  const me      = useAuthStore((s) => s.user);
  const isAdmin = me?.role === "ADMIN" || me?.role === "MANAGER";

  /* data */
  const [contactList, setContactList]   = useState<ClientDetailed[]>([]);
  const [allLeads, setAllLeads]         = useState<LeadDetailed[]>([]);
  const [staffList, setStaffList]       = useState<UserBriefList[]>([]);
  const [sourcesList, setSourcesList]   = useState<Source[]>([]);
  const [loading, setLoading]           = useState(true);

  /* selected contact */
  const [selected, setSelected]         = useState<ClientDetailed | null>(null);
  const [timeline, setTimeline]         = useState<Array<{ type: "msg" | "act"; ts: string; data: MessageRow | ActivityRow }>>([]);
  const [timelineLoading, setTlLoading] = useState(false);

  /* send */
  const [sendText, setSendText]   = useState("");
  const [sendChannel, setSendChannel] = useState<Channel>("WHATSAPP");
  const [sending, setSending]     = useState(false);

  /* search */
  const [search, setSearch]       = useState("");
  const [statusFilter, setStatusFilter] = useState<ContactStatus | "all">("all");

  /* qualify panel */
  const [qualify, setQualify]     = useState<QualifyState>(QUALIFY_EMPTY);
  const [showQualify, setShowQualify] = useState(false);
  const [creatingLead, setCreating]   = useState(false);

  /* duplicate dialog */
  const [dupDialog, setDupDialog] = useState<{ open: boolean; existingLead: LeadDetailed | null }>({
    open: false, existingLead: null,
  });

  const bottomRef = useRef<HTMLDivElement>(null);

  /* ── Load initial data ─────────────────────────────────────────────────── */
  useEffect(() => {
    Promise.all([
      clients.list({ pageSize: 200 }),
      leads.list(),
      isAdmin ? users.list() : Promise.resolve([]),
      sources.list(),
    ]).then(([c, l, u, s]) => {
      setContactList(c.items);
      setAllLeads(l);
      setStaffList((u as UserBriefList[]).filter((u) => u.isActive && u.id !== me?.id));
      setSourcesList(s);
    }).catch(() => toast.error(tToast("loadError"))).finally(() => setLoading(false));
    // Загрузка один раз при монтировании — внешние зависимости стабильны на
    // время жизни экрана; добавление их в deps вызвало бы лишние перезагрузки.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Load timeline when contact selected ──────────────────────────────── */
  useEffect(() => {
    if (!selected) return;
    setTimeline([]);
    setTlLoading(true);
    Promise.all([
      messages.list(selected.id).catch(() => [] as MessageRow[]),
      activities.byClient(selected.id).then((d) => d.items).catch(() => [] as ActivityRow[]),
    ]).then(([msgs, acts]) => {
      const tl = [
        ...msgs.map((m) => ({ type: "msg" as const, ts: m.createdAt, data: m })),
        ...acts.map((a) => ({ type: "act" as const, ts: a.createdAt, data: a })),
      ].sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());
      setTimeline(tl);
    }).finally(() => setTlLoading(false));
  }, [selected]);

  /* ── Auto-scroll ───────────────────────────────────────────────────────── */
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [timeline]);

  /* ── Pre-fill qualify name from contact ───────────────────────────────── */
  useEffect(() => {
    if (selected) {
      setQualify((q) => ({ ...q, name: selected.fullName }));
      // Auto-detect channel from last contact
      const lastContact = selected.contacts?.[0];
      if (lastContact?.channel) setSendChannel(lastContact.channel as Channel);
    }
  }, [selected]);

  /* ─── Filtering ─────────────────────────────────────────────────────── */
  const filtered = contactList.filter((c) => {
    const matchSearch = !search
      || c.fullName.toLowerCase().includes(search.toLowerCase())
      || c.primaryPhone.includes(search);
    const status = getStatus(c, allLeads);
    const matchStatus = statusFilter === "all" || status === statusFilter;
    return matchSearch && matchStatus;
  }).sort((a, b) => {
    // "new" contacts float to top
    const sa = getStatus(a, allLeads);
    const sb = getStatus(b, allLeads);
    const order = { new: 0, active: 1, client: 2 };
    return order[sa] - order[sb];
  });

  /* ─── Send message ───────────────────────────────────────────────────── */
  async function handleSend() {
    if (!selected || !sendText.trim()) return;
    setSending(true);
    const text = sendText.trim();
    setSendText("");
    try {
      const res = await messages.send(selected.id, { channel: sendChannel, body: text });
      setTimeline((prev) => [
        ...prev,
        { type: "msg", ts: new Date().toISOString(), data: { ...res.message, body: text, createdAt: new Date().toISOString() } as MessageRow },
      ]);
      if (!res.delivered) toast.info(res.note ?? tToast("savedNotDelivered"));
    } catch {
      toast.error(tToast("sendError"));
      setSendText(text);
    } finally {
      setSending(false);
    }
  }

  /* ─── Create lead ────────────────────────────────────────────────────── */
  async function handleCreateLead() {
    if (!selected || !me) return;

    // Check for existing active lead
    const existingLead = allLeads.find(
      (l) => l.clientId === selected.id && l.stage !== "WON" && l.stage !== "LOST"
    );
    if (existingLead) {
      setDupDialog({ open: true, existingLead });
      return;
    }

    setCreating(true);
    try {
      // Auto-detect source from channel
      const sourceType = CHANNEL_META[sendChannel].sourceType;
      const matchedSource = sourcesList.find((s) => s.type === sourceType && s.isActive);

      // Update client name if changed
      if (qualify.name.trim() && qualify.name.trim() !== selected.fullName) {
        await clients.update(selected.id, { fullName: qualify.name.trim() });
      }

      // Update client notes with budget/description
      const noteLines = [
        qualify.budget ? `${tQual("budget")}: ${qualify.budget}` : "",
        qualify.description ? qualify.description : "",
      ].filter(Boolean).join("\n");
      if (noteLines) {
        await clients.update(selected.id, { notes: noteLines });
      }

      // "pool" → assignedUserId: null (unclaimed-лид попадёт в /pool для assign).
      // "self" → текущий пользователь. Иначе — выбранный сотрудник.
      const assignedUserId =
        qualify.assignTo === "pool"
          ? null
          : qualify.assignTo === "self"
            ? me.id
            : qualify.assignTo || me.id;

      const lead = await leads.create({
        clientId: selected.id,
        sourceId: matchedSource?.id,
        assignedUserId,
        priority: qualify.priority,
      });

      // Share history as activity note
      if (qualify.shareMode !== "select" || qualify.selectedMsgIds.size > 0) {
        let content = "";
        if (qualify.shareMode === "last") {
          const lastMsg = timeline.filter((t) => t.type === "msg").at(-1);
          if (lastMsg) content = `[${sendChannel}] ${(lastMsg.data as MessageRow).body}`;
        } else if (qualify.shareMode === "all") {
          content = timeline
            .filter((t) => t.type === "msg")
            .map((t) => {
              const m = t.data as MessageRow;
              return `[${formatDate(m.createdAt)}] ${m.body}`;
            }).join("\n");
        } else {
          content = timeline
            .filter((t) => t.type === "msg" && qualify.selectedMsgIds.has((t.data as MessageRow).id))
            .map((t) => {
              const m = t.data as MessageRow;
              return `[${formatDate(m.createdAt)}] ${m.body}`;
            }).join("\n");
        }
        if (content) {
          await activities.create({
            clientId: selected.id,
            leadId: lead.id,
            type: "NOTE",
            direction: "INTERNAL",
            content: `${tQual("chatHandedOver")}:\n${content}`,
          });
        }
      }

      setShowQualify(false);
      toast.success(tToast("leadCreated"));
      // Go directly to the lead workspace (no kanban detour)
      router.push(`/leads/${lead.id}`);
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? tToast("createError"));
    } finally {
      setCreating(false);
    }
  }

  /* ─── Qualify form helpers ───────────────────────────────────────────── */
  function updateQ<K extends keyof QualifyState>(key: K, val: QualifyState[K]) {
    setQualify((q) => ({ ...q, [key]: val }));
  }

  function toggleMsgSelect(id: string) {
    setQualify((q) => {
      const s = new Set(q.selectedMsgIds);
      s.has(id) ? s.delete(id) : s.add(id);
      return { ...q, selectedMsgIds: s };
    });
  }

  const selectedContactStatus = selected ? getStatus(selected, allLeads) : null;
  const selectedLead = selected ? allLeads.find((l) => l.clientId === selected.id) : null;

  /* ─── Render ─────────────────────────────────────────────────────────── */
  return (
    <div className="flex h-full gap-0 -m-3 sm:-m-5 md:-m-7 overflow-hidden rounded-xl">

      {/* ── Left: contact list ──────────────────────────────────────────── */}
      <aside className={cn(
        // Колонка списка контактов — на mobile полная ширина, на md/lg/xl
        // прогрессивно шире, чтобы на больших экранах не казалась "телефонной".
        "flex flex-col border-r bg-surface w-full md:w-96 lg:w-[26rem] xl:w-[32rem] shrink-0",
        selected && "hidden md:flex"
      )}>
        {/* Search */}
        <div className="p-3 border-b space-y-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Пошук..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 h-9 text-sm"
            />
          </div>
          {/* Status filter chips */}
          <div className="flex gap-1.5 overflow-x-auto">
            {(["all", "new", "active", "client"] as const).map((s) => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={cn(
                  "px-2.5 py-1 rounded-full text-xs font-medium shrink-0 border transition-all",
                  statusFilter === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-muted text-muted-foreground border-transparent hover:border-border"
                )}
              >
                {s === "all" ? tStatus("all") : tStatus(s)}
              </button>
            ))}
          </div>
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-center py-10 text-sm text-muted-foreground">Контактів не знайдено</p>
          ) : (
            filtered.map((c) => {
              const status = getStatus(c, allLeads);
              const channelIcons = c.contacts?.slice(0, 3) ?? [];
              return (
                <button
                  key={c.id}
                  onClick={() => { setSelected(c); setShowQualify(status === "new"); }}
                  className={cn(
                    "w-full flex items-start gap-3 px-4 py-3 border-b border-border/40 hover:bg-muted/50 transition-colors text-left",
                    selected?.id === c.id && "bg-primary/5 border-l-2 border-l-primary"
                  )}
                >
                  <div className="relative shrink-0">
                    <Avatar name={c.fullName} avatarUrl={c.avatarUrl} size="sm" />
                    {status === "new" && (
                      <span className="absolute -top-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-amber-400 border-2 border-background" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-sm font-medium truncate">{c.fullName}</span>
                      <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium shrink-0", STATUS_COLOR[status])}>
                        {tStatus(status)}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">{c.primaryPhone}</p>
                    {channelIcons.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {channelIcons.map((ct) => {
                          const meta = CHANNEL_META[ct.channel as Channel];
                          return meta ? <meta.icon key={ct.id} className={cn("h-3 w-3", meta.color)} /> : null;
                        })}
                      </div>
                    )}
                  </div>
                </button>
              );
            })
          )}
        </div>
      </aside>

      {/* ── Right: conversation + qualify ──────────────────────────────── */}
      {selected ? (
        <div className="flex-1 flex flex-col min-w-0">

          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b bg-surface shrink-0">
            <button className="md:hidden text-muted-foreground" onClick={() => setSelected(null)}>←</button>
            <Avatar name={selected.fullName} avatarUrl={selected.avatarUrl} size="sm" />
            <div className="flex-1 min-w-0">
              <div className="font-medium text-sm">{selected.fullName}</div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{selected.primaryPhone}</span>
                {selectedLead && (
                  <span className={cn("text-[10px] px-1.5 py-0.5 rounded-full font-medium", STATUS_COLOR[selectedContactStatus!])}>
                    {tStatus(selectedContactStatus!)}
                  </span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-1">
              {selectedContactStatus === "new" && (
                <Button
                  size="sm"
                  variant={showQualify ? "default" : "outline"}
                  onClick={() => setShowQualify((v) => !v)}
                  className="text-xs h-7"
                >
                  <UserPlus className="h-3 w-3 mr-1" />
                  {showQualify ? "Сховати" : "Зробити лідом"}
                </Button>
              )}
              {selectedLead && (
                <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                  <Link href={`/leads/${selectedLead.id}`}>
                    <User className="h-3 w-3 mr-1" />
                    Лід
                  </Link>
                </Button>
              )}
              <Button asChild variant="ghost" size="sm" className="h-7 text-xs">
                <Link href={`/clients/${selected.id}`}>
                  Картка
                </Link>
              </Button>
            </div>
          </div>

          {/* Main area: timeline + qualify panel */}
          <div className="flex flex-1 min-h-0">

            {/* Timeline */}
            <div className={cn("flex flex-col flex-1 min-w-0", showQualify && "md:w-[55%] md:flex-none")}>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {timelineLoading && (
                  <div className="flex justify-center py-8">
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  </div>
                )}
                {!timelineLoading && timeline.length === 0 && (
                  <div className="text-center py-12 text-sm text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-20" />
                    <p>Немає повідомлень</p>
                  </div>
                )}

                {timeline.map((item) => {
                  if (item.type === "msg") {
                    const m = item.data as MessageRow;
                    const isOut = m.activity?.direction === "OUT";
                    const chMeta = CHANNEL_META[m.channel as Channel] ?? CHANNEL_META.WHATSAPP;
                    const isSelected = qualify.selectedMsgIds.has(m.id);

                    return (
                      <div
                        key={m.id}
                        className={cn("flex gap-2", isOut ? "justify-end" : "justify-start")}
                        onClick={() => qualify.shareMode === "select" && toggleMsgSelect(m.id)}
                      >
                        {/* select checkbox overlay */}
                        {qualify.shareMode === "select" && (
                          <div className={cn(
                            "self-center h-4 w-4 rounded border-2 flex items-center justify-center shrink-0 cursor-pointer",
                            isSelected ? "bg-primary border-primary" : "border-muted-foreground/40"
                          )}>
                            {isSelected && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                        )}

                        {!isOut && (
                          <div className="h-6 w-6 rounded-full flex items-center justify-center shrink-0 mt-1 bg-muted">
                            <chMeta.icon className={cn("h-3 w-3", chMeta.color)} />
                          </div>
                        )}
                        <div className={cn(
                          "max-w-[72%] rounded-2xl px-3.5 py-2.5 text-sm cursor-default",
                          isOut ? "bg-primary text-primary-foreground rounded-br-sm" : "bg-muted rounded-bl-sm",
                          qualify.shareMode === "select" && "cursor-pointer",
                          isSelected && "ring-2 ring-primary ring-offset-1"
                        )}>
                          <p>{m.body}</p>
                          <div className={cn("text-xs mt-1 flex items-center gap-1", isOut ? "text-primary-foreground/70 justify-end" : "text-muted-foreground")}>
                            <span>{formatDate(m.createdAt)}</span>
                            {isOut && m.deliveredAt && <CheckCheck className="h-3 w-3" />}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Activity
                  const a = item.data as ActivityRow;
                  return (
                    <div key={a.id} className="flex justify-center">
                      <div className="bg-muted/60 text-muted-foreground text-xs px-3 py-1 rounded-full max-w-[80%] text-center">
                        <span className="italic">{a.content?.slice(0, 80)}</span>
                        <span className="ml-2 opacity-50">{formatDate(a.createdAt)}</span>
                      </div>
                    </div>
                  );
                })}
                <div ref={bottomRef} />
              </div>

              {/* Send bar */}
              <div className="border-t p-3 bg-surface shrink-0">
                <div className="flex gap-1.5 mb-2">
                  {(Object.keys(CHANNEL_META) as Channel[]).map((ch) => {
                    const meta = CHANNEL_META[ch];
                    return (
                      <button
                        key={ch}
                        onClick={() => setSendChannel(ch)}
                        title={meta.label}
                        className={cn(
                          "flex items-center gap-1 px-2 py-1 rounded-full text-xs transition-all border",
                          sendChannel === ch
                            ? "bg-primary text-primary-foreground border-primary"
                            : "text-muted-foreground border-border hover:bg-muted"
                        )}
                      >
                        <meta.icon className="h-3 w-3" />
                        <span className="hidden sm:inline">{meta.label}</span>
                      </button>
                    );
                  })}
                </div>
                <div className="flex gap-2">
                  <Input
                    placeholder={`Написати через ${CHANNEL_META[sendChannel].label}...`}
                    value={sendText}
                    onChange={(e) => setSendText(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); }}}
                    className="flex-1 text-sm"
                    disabled={sending}
                  />
                  <Button onClick={handleSend} disabled={!sendText.trim() || sending} size="sm">
                    {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </div>

            {/* ── Qualify panel ─────────────────────────────────────── */}
            {showQualify && (
              <div className="hidden md:flex flex-col w-72 shrink-0 border-l bg-muted/20 overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b">
                  <span className="text-sm font-semibold">Кваліфікація</span>
                  <button onClick={() => setShowQualify(false)} className="text-muted-foreground hover:text-foreground">
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="p-4 space-y-4 flex-1">
                  {/* Source auto-label */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground bg-muted rounded-lg px-3 py-2">
                    {(() => { const m = CHANNEL_META[sendChannel]; return <m.icon className={cn("h-3.5 w-3.5", m.color)} />; })()}
                    <span>Джерело: <strong>{CHANNEL_META[sendChannel].label}</strong> (авто)</span>
                  </div>

                  {/* Name */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Ім&apos;я клієнта</label>
                    <Input
                      value={qualify.name}
                      onChange={(e) => updateQ("name", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="Ім'я та прізвище"
                    />
                  </div>

                  {/* Budget */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Бюджет</label>
                    <Input
                      value={qualify.budget}
                      onChange={(e) => updateQ("budget", e.target.value)}
                      className="h-8 text-sm"
                      placeholder="напр. 150 000 USD"
                    />
                  </div>

                  {/* Description */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Короткий опис</label>
                    <textarea
                      value={qualify.description}
                      onChange={(e) => updateQ("description", e.target.value)}
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm resize-none h-20 focus:outline-none focus:ring-1 focus:ring-ring"
                      placeholder="Що шукає, побажання..."
                    />
                  </div>

                  {/* Priority */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">Пріоритет</label>
                    <div className="flex gap-2">
                      {([
                        { v: "hot",  icon: Flame,    label: "Гарячий", cls: "text-red-500" },
                        { v: "warm", icon: Star,     label: "Теплий",  cls: "text-amber-500" },
                        { v: "cold", icon: Snowflake, label: "Холодний", cls: "text-sky-400" },
                      ] as const).map(({ v, icon: Icon, label, cls }) => (
                        <button
                          key={v}
                          onClick={() => updateQ("priority", v)}
                          className={cn(
                            "flex-1 flex flex-col items-center gap-1 py-2 rounded-lg border text-xs transition-all",
                            qualify.priority === v
                              ? "border-primary bg-primary/10 font-medium"
                              : "border-border hover:bg-muted"
                          )}
                        >
                          <Icon className={cn("h-4 w-4", qualify.priority === v ? cls : "text-muted-foreground")} />
                          <span>{label}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Assign */}
                  {isAdmin && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-foreground">Призначити</label>
                      <div className="flex flex-col gap-1.5">
                        <button
                          onClick={() => updateQ("assignTo", "pool")}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left",
                            qualify.assignTo === "pool" ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"
                          )}
                        >
                          <UserPlus className="h-3.5 w-3.5 text-muted-foreground" />
                          У пул (нерозподілений)
                        </button>
                        <button
                          onClick={() => updateQ("assignTo", "self")}
                          className={cn(
                            "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left",
                            qualify.assignTo === "self" ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"
                          )}
                        >
                          <User className="h-3.5 w-3.5 text-muted-foreground" />
                          Собі
                        </button>
                        {staffList.map((u) => (
                          <button
                            key={u.id}
                            onClick={() => updateQ("assignTo", u.id)}
                            className={cn(
                              "flex items-center gap-2 px-3 py-2 rounded-lg border text-sm transition-all text-left",
                              qualify.assignTo === u.id ? "border-primary bg-primary/10 font-medium" : "border-border hover:bg-muted"
                            )}
                          >
                            <Avatar name={u.fullName} size="xs" />
                            <span className="truncate">{u.fullName}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Share history */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-foreground">{tQual("shareChat")}</label>
                    <div className="space-y-1">
                      {([
                        { v: "last"   as const, label: tQual("shareLast") },
                        { v: "all"    as const, label: tQual("shareAll") },
                        { v: "select" as const, label: tQual("shareSelect") },
                      ]).map(({ v, label }) => (
                        <label key={v} className="flex items-center gap-2 text-sm cursor-pointer">
                          <input
                            type="radio"
                            name="shareMode"
                            value={v}
                            checked={qualify.shareMode === v}
                            onChange={() => updateQ("shareMode", v)}
                            className="accent-primary"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                    {qualify.shareMode === "select" && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Натисніть на повідомлення зліва для вибору
                      </p>
                    )}
                  </div>
                </div>

                {/* Create button */}
                <div className="p-4 border-t">
                  <Button
                    className="w-full"
                    onClick={handleCreateLead}
                    disabled={creatingLead}
                  >
                    {creatingLead ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <UserPlus className="h-4 w-4 mr-2" />
                    )}
                    Зробити лідом
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="hidden md:flex flex-1 items-center justify-center text-center text-muted-foreground">
          <div>
            <MessageSquare className="h-12 w-12 mx-auto mb-3 opacity-20" />
            <p className="text-sm font-medium">Оберіть контакт</p>
            <p className="text-xs mt-1 opacity-70">Нові контакти вгорі списку</p>
          </div>
        </div>
      )}

      {/* ── Duplicate lead dialog ──────────────────────────────────────── */}
      {dupDialog.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-background rounded-xl shadow-xl p-6 w-full max-w-sm mx-4 space-y-4">
            <div className="flex items-start gap-3">
              <AlertCircle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <h3 className="font-semibold text-sm">Активний лід вже існує</h3>
                <p className="text-sm text-muted-foreground mt-1">
                  У цього клієнта вже є відкритий лід на стадії{" "}
                  <strong>{dupDialog.existingLead?.stage}</strong>.
                  Що робимо?
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <Button
                variant="outline"
                className="justify-start"
                onClick={() => {
                  setDupDialog({ open: false, existingLead: null });
                  if (dupDialog.existingLead)
                    window.open(`/leads/${dupDialog.existingLead.id}`, "_blank");
                }}
              >
                <User className="h-4 w-4 mr-2" />
                Відкрити наявний лід
              </Button>
              <Button
                className="justify-start"
                onClick={() => {
                  setDupDialog({ open: false, existingLead: null });
                  // Bypass duplicate check and force create
                  const orig = allLeads;
                  setAllLeads((prev) => prev.filter((l) => l.clientId !== selected?.id));
                  handleCreateLead().catch(() => setAllLeads(orig));
                }}
              >
                <UserPlus className="h-4 w-4 mr-2" />
                Створити новий лід
              </Button>
              <Button variant="ghost" onClick={() => setDupDialog({ open: false, existingLead: null })}>
                Скасувати
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
