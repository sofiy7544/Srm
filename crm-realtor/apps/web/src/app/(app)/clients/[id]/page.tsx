'use client';

import { useEffect, useRef, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import Link from 'next/link';
import { ArrowLeft, Pencil, Trash2, Phone, Mail, Sparkles, Briefcase, Camera, Loader2, Plus, Calendar, ChevronRight, Archive, ArchiveRestore, Ban, ShieldCheck, GitMerge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PageSkeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Avatar } from '@/components/ui/avatar';
import { clients, leads as leadsApi, uploads, users as usersApi, type ClientDetailed, type LeadDetailed, type UserBriefList } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { formatDateTime, formatPrice } from '@/lib/formatters';
import { ActivityTimeline } from '@/components/activity-timeline';
import { PersonQuickActions } from '@/components/person-quick-actions';
import { ClientChat } from '@/components/client-chat';
import { ClientContactsCard } from '@/components/client-contacts-card';
import { NotesPanel } from '@/components/notes-panel';
import { SourceIcon } from '@/components/source-badge';
import { ScheduleShowingDialog } from '@/components/schedule-showing-dialog';
import { CallDispositionDialog } from '@/components/call-disposition-dialog';
import { MergeClientDialog } from '@/components/merge-client-dialog';
import { useAuthStore } from '@/lib/auth-store';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { STAGE_LABEL, STAGE_DOT } from '@/lib/stage-style';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function ClientDetailPage() {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const tPage = useTranslations('clientDetail');
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const confirm = useConfirm();
  const [client, setClient] = useState<ClientDetailed | null>(null);
  const [clientLeads, setClientLeads] = useState<LeadDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [reload, setReload] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [showingOpen, setShowingOpen] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [agentsList, setAgentsList] = useState<UserBriefList[]>([]);
  const [savingAssignee, setSavingAssignee] = useState(false);
  const me = useAuthStore((s) => s.user);
  const canManage = me?.role === 'ADMIN' || me?.role === 'MANAGER';
  const canMerge = canManage;
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (canManage) usersApi.list().then(setAgentsList).catch(() => undefined);
  }, [canManage]);

  async function handleAssigneeChange(value: string) {
    if (!client) return;
    const nextId = value === '__UNASSIGNED__' ? null : value;
    setSavingAssignee(true);
    try {
      const updated = await clients.update(client.id, { assignedUserId: nextId });
      setClient(updated);
      toast.success(nextId ? tPage('toastAssigned') : tPage('toastUnassigned'));
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? tPage('toastUpdateError'));
    } finally {
      setSavingAssignee(false);
    }
  }

  useEffect(() => {
    if (!params.id) return;
    clients.get(params.id).then(setClient).finally(() => setLoading(false));
  }, [params.id]);

  useEffect(() => {
    if (!params.id) return;
    leadsApi
      .list()
      .then((all) => setClientLeads(all.filter((l) => l.clientId === params.id)))
      .catch(() => setClientLeads([]));
  }, [params.id, reload]);

  async function handleDelete() {
    if (!client) return;
    const ok = await confirm({
      title: t('confirmDelete', { name: client.fullName }),
      destructive: true,
    });
    if (!ok) return;
    await clients.remove(client.id);
    router.push('/clients');
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !client) return;
    setUploadingAvatar(true);
    try {
      const { url } = await uploads.image(file);
      const updated = await clients.update(client.id, { avatarUrl: url });
      setClient(updated);
    } catch (err) {
      console.error(err);
      toast.error(t('avatarUploadError'));
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function handleToggleArchive() {
    if (!client) return;
    try {
      const updated = await clients.update(client.id, { isArchived: !client.isArchived });
      setClient(updated);
      toast.success(updated.isArchived ? 'Контакт в архіві' : 'Повернуто з архіву');
    } catch {
      toast.error('Не вдалося оновити');
    }
  }

  async function handleToggleConsent() {
    if (!client) return;
    try {
      const updated = await clients.update(client.id, {
        marketingConsent: !client.marketingConsent,
      });
      setClient(updated);
      toast.success(updated.marketingConsent ? 'Згода зафіксована' : 'Згоду відкликано');
    } catch {
      toast.error('Не вдалося оновити');
    }
  }

  async function handleToggleBlacklist() {
    if (!client) return;
    const goingToBlacklist = !client.isBlacklisted;
    const ok = await confirm({
      title: goingToBlacklist ? 'Додати в чорний список?' : 'Прибрати з чорного списку?',
      description: goingToBlacklist
        ? 'Контакт буде позначено як проблемний. Активні ліди залишаться, але створювати нові буде заборонено.'
        : 'Контакт знову буде доступним для нових лідів.',
      destructive: goingToBlacklist,
    });
    if (!ok) return;
    try {
      const updated = await clients.update(client.id, { isBlacklisted: goingToBlacklist });
      setClient(updated);
      toast.success(goingToBlacklist ? 'Додано в чорний список' : 'Прибрано з чорного списку');
    } catch {
      toast.error('Не вдалося оновити');
    }
  }

  if (loading) return <PageSkeleton variant="detail" />;
  if (!client) return <p className="text-sm text-muted-foreground">{t('notFound')}</p>;

  const prefs = client.preferences;

  return (
    <div className="space-y-5 animate-slide-up">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/clients">
            <ArrowLeft className="h-4 w-4" />
            {t('backToList')}
          </Link>
        </Button>
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" asChild>
            <Link href={`/clients/${client.id}/edit`}>
              <Pencil className="h-4 w-4" />
              {tCommon('edit')}
            </Link>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleArchive}
            title={client.isArchived ? 'Повернути з архіву' : 'В архів'}
          >
            {client.isArchived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
            {client.isArchived ? 'З архіву' : 'В архів'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleToggleBlacklist}
            className={cn(client.isBlacklisted && 'border-red-300 text-red-600 hover:bg-red-50')}
          >
            {client.isBlacklisted ? <ShieldCheck className="h-4 w-4" /> : <Ban className="h-4 w-4" />}
            {client.isBlacklisted ? 'Розблокувати' : 'У ЧС'}
          </Button>
          {canMerge && (
            <Button variant="outline" size="sm" onClick={() => setMergeOpen(true)}>
              <GitMerge className="h-4 w-4" />
              Об&#39;єднати
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={handleDelete}>
            <Trash2 className="h-4 w-4" />
            {tCommon('delete')}
          </Button>
        </div>
      </div>

      <Card className="overflow-hidden">
        <div className="h-20 bg-gradient-to-r from-primary/15 via-violet-500/10 to-emerald-500/10" />
        <div className="p-6 -mt-12 flex items-end gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploadingAvatar}
            className="relative group rounded-full shrink-0"
            aria-label={t('changeAvatar')}
            title={t('changeAvatar')}
          >
            <Avatar
              name={client.fullName}
              src={client.avatarUrl}
              size="lg"
              className="h-20 w-20 text-2xl ring-4 ring-surface shadow-card"
            />
            <span className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </span>
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleAvatarChange}
            className="hidden"
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="heading-page">{client.fullName}</h1>
              {client.isBlacklisted && (
                <Badge variant="destructive" className="gap-1">
                  <Ban className="h-3 w-3" />
                  Чорний список
                </Badge>
              )}
              {client.isArchived && (
                <Badge variant="secondary" className="gap-1">
                  <Archive className="h-3 w-3" />
                  В архіві
                </Badge>
              )}
              {client.source && (
                <Badge variant="secondary" className="gap-1 pl-1">
                  <SourceIcon type={client.source.type} className="h-3 w-3" />
                  {client.source.name}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 text-sm text-muted-foreground mt-1 flex-wrap">
              <a
                href={`tel:${client.primaryPhone}`}
                onClick={() => setCallOpen(true)}
                className="flex items-center gap-1.5 hover:text-primary transition-colors"
                title={tPage('callTooltip')}
              >
                <Phone className="h-3.5 w-3.5" /> {client.primaryPhone}
              </a>
              {client.email && (
                <span className="flex items-center gap-1.5">
                  <Mail className="h-3.5 w-3.5" /> {client.email}
                </span>
              )}
              {client.assignedUser && (
                <span className="flex items-center gap-1.5">
                  <Briefcase className="h-3.5 w-3.5" /> {client.assignedUser.fullName}
                </span>
              )}
            </div>
          </div>
        </div>
      </Card>

      <div className="grid lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 space-y-4">
          {/* Messaging composer only when integrations are enabled; otherwise a
              static contacts block (no Telegram/WhatsApp/Instagram/Email/Call). */}
          {process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED === 'true' ? (
            <ClientChat client={client} />
          ) : (
            <ClientContactsCard client={client} />
          )}
          {/* Заметки — отдельный persistent раздел (текст + голосовые).
              ClientActions ниже остаётся только для лога звонка / email — это
              разные UX-цели (заметки нужны постоянно, лог звонка — иногда). */}
          <NotesPanel
            clientId={client.id}
            onChanged={() => setReload((r) => r + 1)}
          />
          <PersonQuickActions
            client={client}
            lead={clientLeads.find((l) => l.stage !== 'WON' && l.stage !== 'LOST') ?? null}
            agents={agentsList}
            onChanged={() => setReload((r) => r + 1)}
            onViewHistory={() =>
              document.getElementById('person-history')?.scrollIntoView({ behavior: 'smooth' })
            }
          />
        </div>

        <div className="space-y-4">
          {/* Quick actions — turn a contact into pipeline work */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Дії</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {/* Lead status / create */}
              {(() => {
                const active = clientLeads.find((l) => l.stage !== 'WON' && l.stage !== 'LOST');
                if (active) {
                  return (
                    <Link
                      href={`/leads/${active.id}`}
                      className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-3 py-2 hover:bg-muted transition-colors"
                    >
                      <span className={cn('h-2 w-2 rounded-full shrink-0', STAGE_DOT[active.stage])} />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium truncate">{tPage('activeLead')} · {STAGE_LABEL[active.stage]}</div>
                        <div className="text-xs text-muted-foreground">
                          {active.dealIntent === 'RENT' ? 'Оренда' : 'Продаж'}
                          {active.interestProperty && ' · '}
                          {active.interestProperty?.address}
                        </div>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                    </Link>
                  );
                }
                return (
                  <Link
                    href={`/leads/new?clientId=${client.id}`}
                    className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-border px-3 py-2 hover:border-primary/40 hover:bg-muted/40 transition-colors"
                  >
                    <span className="flex items-center gap-2 font-medium text-primary">
                      <Plus className="h-3.5 w-3.5" />
                      {tPage('createLead')}
                    </span>
                    <span className="text-xs text-muted-foreground">{tPage('createLeadHint')}</span>
                  </Link>
                );
              })()}

              {/* Call */}
              <button
                type="button"
                onClick={() => setCallOpen(true)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors text-left"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Phone className="h-3.5 w-3.5 text-emerald-500" />
                  {tPage('actionCall')}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {/* Schedule showing */}
              <button
                type="button"
                onClick={() => setShowingOpen(true)}
                className="w-full flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 hover:bg-muted transition-colors text-left"
              >
                <span className="flex items-center gap-2 font-medium">
                  <Calendar className="h-3.5 w-3.5 text-violet-500" />
                  {tPage('actionShowing')}
                </span>
                <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              {/* History link to all leads of this client (closed too) */}
              {clientLeads.length > 0 && (
                <p className="text-3xs text-muted-foreground">
                  {tPage('totalLeads', { total: clientLeads.length, active: clientLeads.filter((l) => l.stage !== 'WON' && l.stage !== 'LOST').length })}
                </p>
              )}
            </CardContent>
          </Card>

          {/* Responsible realtor — admin/manager can reassign, others see read-only. */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Briefcase className="h-3.5 w-3.5 text-muted-foreground" />
                {tPage('responsibleAgent')}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm">
              {canManage ? (
                <Select
                  value={client.assignedUserId ?? '__UNASSIGNED__'}
                  onValueChange={handleAssigneeChange}
                  disabled={savingAssignee}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={tPage('unassigned')} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__UNASSIGNED__">{tPage('unassignedDash')}</SelectItem>
                    {agentsList
                      .filter((u) => u.isActive)
                      .map((u) => (
                        <SelectItem key={u.id} value={u.id}>
                          {u.fullName}
                          {me?.id === u.id ? ` (${tPage('me')})` : ''}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              ) : (
                <p className="text-muted-foreground">
                  {client.assignedUser?.fullName ?? tPage('unassigned')}
                </p>
              )}
            </CardContent>
          </Card>

          {client.notes && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('notes')}</CardTitle>
              </CardHeader>
              <CardContent className="text-sm whitespace-pre-wrap">{client.notes}</CardContent>
            </Card>
          )}

          {client.contacts.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">{t('contacts')}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {client.contacts.map((c) => (
                  <div key={c.id ?? c.identifier} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-3xs">
                      {t(`channels.${c.channel}`)}
                    </Badge>
                    <span className="truncate flex-1">{c.identifier}</span>
                    {c.isPrimary && (
                      <Badge variant="success" className="text-3xs">{t('primary')}</Badge>
                    )}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {prefs && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  <Sparkles className="h-3.5 w-3.5 text-violet-500" />
                  {t('preferences')}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {prefs.dealIntent && (
                  <Row label={t('dealIntent')} value={t(`intent.${prefs.dealIntent}`)} />
                )}
                {prefs.propertyType && (
                  <Row label={t('propertyType')} value={t(`propertyTypes.${prefs.propertyType}`)} />
                )}
                {prefs.districts && prefs.districts.length > 0 && (
                  <Row label={t('districts')} value={prefs.districts.join(', ')} />
                )}
                {(prefs.priceMin || prefs.priceMax) && (
                  <Row
                    label={t('priceRange')}
                    value={`${prefs.priceMin ? formatPrice(prefs.priceMin, prefs.currency ?? 'UAH') : '0'} — ${prefs.priceMax ? formatPrice(prefs.priceMax, prefs.currency ?? 'UAH') : '∞'}`}
                  />
                )}
                {(prefs.roomsMin || prefs.roomsMax) && (
                  <Row
                    label={t('roomsRange')}
                    value={`${prefs.roomsMin ?? '0'} — ${prefs.roomsMax ?? '∞'}`}
                  />
                )}
                {(prefs.areaMin || prefs.areaMax) && (
                  <Row
                    label={t('areaRange')}
                    value={`${prefs.areaMin ?? '0'} — ${prefs.areaMax ?? '∞'} м²`}
                  />
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <ShieldCheck className="h-3.5 w-3.5 text-violet-500" />
                GDPR
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <label className="flex items-start gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={client.marketingConsent}
                  onChange={handleToggleConsent}
                  className="mt-0.5 h-3.5 w-3.5 accent-primary"
                />
                <span>
                  <div className="font-medium">Згода на маркетинг</div>
                  {client.marketingConsent ? (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400">
                      Підтверджено{client.consentTimestamp && ` · ${formatDateTime(client.consentTimestamp)}`}
                      {client.consentVersion && ` · v${client.consentVersion}`}
                    </div>
                  ) : (
                    <div className="text-xs text-muted-foreground">
                      Без згоди дозволені тільки сервісні повідомлення (запис на показ тощо).
                    </div>
                  )}
                </span>
              </label>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">{t('createdAt')}</CardTitle>
            </CardHeader>
            <CardContent className="text-sm tabular-nums">{formatDateTime(client.createdAt)}</CardContent>
          </Card>
        </div>
      </div>

      <div id="person-history">
        <ActivityTimeline key={reload} source="client" id={client.id} />
      </div>

      <ScheduleShowingDialog
        client={client}
        open={showingOpen}
        onOpenChange={setShowingOpen}
        onScheduled={() => setReload((r) => r + 1)}
      />

      <CallDispositionDialog
        open={callOpen}
        onOpenChange={setCallOpen}
        clientId={client.id}
        clientName={client.fullName}
        clientPhone={client.primaryPhone}
        onLogged={() => setReload((r) => r + 1)}
      />

      <MergeClientDialog
        open={mergeOpen}
        onOpenChange={setMergeOpen}
        winner={client}
        onMerged={(c) => { setClient(c); setReload((r) => r + 1); }}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline gap-2">
      <span className="text-muted-foreground min-w-[100px]">{label}:</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}
