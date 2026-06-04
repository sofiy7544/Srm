'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  Phone, MessageSquare, Mail, Send, FileText, ListChecks, CalendarPlus,
  History, Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  clientActions, leads as leadsApi, tasks as tasksApi, templates as templatesApi,
  type ClientDetailed, type LeadDetailed, type LeadStage, type UserBriefList, type TemplateRow,
} from '@/lib/api';
import { VoiceRecorder } from '@/components/voice-recorder';
import { CallDispositionDialog } from '@/components/call-disposition-dialog';
import { ScheduleShowingDialog } from '@/components/schedule-showing-dialog';
import { LostReasonDialog } from '@/components/lost-reason-dialog';
import { STAGE_LABEL, STAGES_ORDERED } from '@/lib/stage-style';
import { useAuthStore } from '@/lib/auth-store';

// Channel actions (WhatsApp/Telegram/Email) stay gated behind the integrations flag.
const INTEGRATIONS_ON = process.env.NEXT_PUBLIC_INTEGRATIONS_ENABLED === 'true';
const UNASSIGNED = '__none__';
type Mode = 'idle' | 'note' | 'email' | 'task';

/**
 * ONE shared quick-action bar for a PERSON, used identically by the client card
 * and the lead card. It only renders the fixed action set and REUSES the existing
 * dialogs/handlers/API — this is a refactor, not new behavior:
 *   Call (CallDispositionDialog) · Add Note (clientActions.addNote, text+voice) ·
 *   Create Task (tasks.create) · Schedule Showing (ScheduleShowingDialog) ·
 *   View History (scroll callback) · Change Stage / Set Priority / Assign
 *   (leads.changeStage/update — only when an active lead exists) ·
 *   WhatsApp / Telegram / Email (only when INTEGRATIONS_ON).
 *
 * Input is already-loaded data (client + optional active lead) — no new loader.
 */
export function PersonQuickActions({
  client,
  lead,
  agents = [],
  onChanged,
  onViewHistory,
}: {
  client: ClientDetailed;
  lead?: LeadDetailed | null;
  agents?: UserBriefList[];
  onChanged: () => void;
  onViewHistory?: () => void;
}) {
  const t = useTranslations('clientActions');
  const tLead = useTranslations('leadDetail');
  const tNav = useTranslations('nav');
  const tCommon = useTranslations('common');
  const me = useAuthStore((s) => s.user);
  const isManager = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [callOpen, setCallOpen] = useState(false);
  const [showingOpen, setShowingOpen] = useState(false);
  const [lostOpen, setLostOpen] = useState(false);
  const [savingLead, setSavingLead] = useState(false);

  const [templates, setTemplates] = useState<TemplateRow[]>([]);
  const [noteText, setNoteText] = useState('');
  const [noteVoice, setNoteVoice] = useState<{ url: string; durationMs: number; mime: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [emailBody, setEmailBody] = useState('');
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDue, setTaskDue] = useState('');

  useEffect(() => {
    if (INTEGRATIONS_ON) templatesApi.list().then(setTemplates).catch(() => undefined);
  }, []);

  const waNumber = client.primaryPhone.replace(/[^\d]/g, '');
  const tgContact = client.contacts.find((c) => c.channel === 'TELEGRAM');

  async function submit(action: () => Promise<unknown>, reset: () => void) {
    setError(null);
    setBusy(true);
    try {
      await action();
      reset();
      setMode('idle');
      onChanged();
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      setError(err.payload?.message ?? t('error'));
    } finally {
      setBusy(false);
    }
  }

  // ── Lead controls (reuse existing handlers) ──
  async function changeStage(next: LeadStage) {
    if (!lead) return;
    if (next === 'LOST') {
      setLostOpen(true);
      return;
    }
    setSavingLead(true);
    try {
      await leadsApi.changeStage(lead.id, next);
      onChanged();
    } catch {
      toast.error(tCommon('save'));
    } finally {
      setSavingLead(false);
    }
  }
  async function confirmLost(reason: string) {
    if (!lead) return;
    setLostOpen(false);
    setSavingLead(true);
    try {
      await leadsApi.changeStage(lead.id, 'LOST', reason);
      onChanged();
    } catch {
      toast.error(tCommon('save'));
    } finally {
      setSavingLead(false);
    }
  }
  async function changePriority(value: 'hot' | 'warm' | 'cold') {
    if (!lead) return;
    setSavingLead(true);
    try {
      await leadsApi.update(lead.id, { priority: value });
      onChanged();
    } catch {
      toast.error(tCommon('save'));
    } finally {
      setSavingLead(false);
    }
  }
  async function changeAssignee(next: string) {
    if (!lead) return;
    setSavingLead(true);
    try {
      await leadsApi.update(lead.id, { assignedUserId: next === UNASSIGNED ? null : next });
      onChanged();
    } catch {
      toast.error(tCommon('save'));
    } finally {
      setSavingLead(false);
    }
  }

  const priority = (lead?.priority === 'hot' || lead?.priority === 'warm' || lead?.priority === 'cold')
    ? lead.priority : 'warm';

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        {/* Fixed action bar — identical from a lead or a client */}
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setCallOpen(true)}>
            <Phone className="h-4 w-4" />{t('logCall')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode(mode === 'note' ? 'idle' : 'note')}>
            <FileText className="h-4 w-4" />{t('addNote')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setMode(mode === 'task' ? 'idle' : 'task')}>
            <ListChecks className="h-4 w-4" />{tNav('tasks')}
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowingOpen(true)}>
            <CalendarPlus className="h-4 w-4" />{t('scheduleShowing')}
          </Button>
          {onViewHistory && (
            <Button variant="outline" size="sm" onClick={onViewHistory}>
              <History className="h-4 w-4" />{tLead('tabActivity')}
            </Button>
          )}
          {INTEGRATIONS_ON && (
            <>
              <Button variant="outline" size="sm" asChild>
                <a href={`https://wa.me/${waNumber}`} target="_blank" rel="noopener noreferrer"
                   onClick={() => void clientActions.addNote(client.id, t('whatsappOpened')).then(onChanged)}>
                  <MessageSquare className="h-4 w-4" />{t('openWhatsApp')}
                </a>
              </Button>
              {tgContact && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`https://t.me/${tgContact.identifier.replace(/^@/, '')}`} target="_blank" rel="noopener noreferrer">
                    <Send className="h-4 w-4" />Telegram
                  </a>
                </Button>
              )}
              {client.email && (
                <Button variant="outline" size="sm" onClick={() => setMode(mode === 'email' ? 'idle' : 'email')}>
                  <Mail className="h-4 w-4" />{t('sendEmail')}
                </Button>
              )}
            </>
          )}
        </div>

        {/* Lead controls — only when an active opportunity exists */}
        {lead && (
          <div className="flex flex-wrap items-center gap-2 pt-3 border-t">
            <Select value={lead.stage} onValueChange={(v) => changeStage(v as LeadStage)}>
              <SelectTrigger className="h-8 w-[150px] text-xs"><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES_ORDERED.map((s) => (
                  <SelectItem key={s} value={s}>{STAGE_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="flex gap-1">
              {(['hot', 'warm', 'cold'] as const).map((p) => (
                <Button key={p} type="button" size="sm"
                  variant={priority === p ? 'default' : 'outline'}
                  className="h-8 px-2 text-xs capitalize" disabled={savingLead}
                  onClick={() => changePriority(p)}>
                  {p}
                </Button>
              ))}
            </div>
            {isManager && agents.length > 0 && (
              <Select value={lead.assignedUserId ?? UNASSIGNED} onValueChange={changeAssignee}>
                <SelectTrigger className="h-8 w-[160px] text-xs">
                  <SelectValue placeholder={tLead('unassigned')} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={UNASSIGNED}>{tLead('unassigned')}</SelectItem>
                  {agents.map((a) => (
                    <SelectItem key={a.id} value={a.id}>{a.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {savingLead && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
          </div>
        )}

        {/* Add note (text + voice) */}
        {mode === 'note' && (
          <div className="space-y-3 pt-3 border-t">
            <Textarea rows={3} value={noteText} onChange={(e) => setNoteText(e.target.value)} placeholder={t('noteText')} />
            <div className="flex items-center gap-2 flex-wrap">
              {noteVoice ? (
                <div className="flex items-center gap-2 rounded-lg border bg-surface px-2 py-1.5">
                  <audio src={noteVoice.url} controls className="h-9 max-w-[260px]" />
                  <Button type="button" variant="ghost" size="sm" onClick={() => setNoteVoice(null)}>×</Button>
                </div>
              ) : (
                <VoiceRecorder compact onRecorded={({ url, durationMs, mime }) => setNoteVoice({ url, durationMs, mime })} />
              )}
            </div>
            <Footer busy={busy || (!noteText.trim() && !noteVoice)} error={error}
              onCancel={() => { setMode('idle'); setNoteVoice(null); }}
              onSubmit={() => submit(
                () => clientActions.addNote(client.id, noteText.trim(),
                  noteVoice ? { audioUrl: noteVoice.url, durationMs: noteVoice.durationMs, mime: noteVoice.mime } : undefined),
                () => { setNoteText(''); setNoteVoice(null); },
              )} />
          </div>
        )}

        {/* Create task */}
        {mode === 'task' && (
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-1">
              <Label>{t('taskTitle')}</Label>
              <Input value={taskTitle} onChange={(e) => setTaskTitle(e.target.value)} placeholder={t('taskTitle')} />
            </div>
            <div className="space-y-1">
              <Label>{t('taskDue')}</Label>
              <Input type="datetime-local" value={taskDue} onChange={(e) => setTaskDue(e.target.value)} />
            </div>
            <Footer busy={busy || !taskTitle.trim() || !taskDue} error={error}
              onCancel={() => setMode('idle')}
              onSubmit={() => submit(
                () => tasksApi.create({
                  title: taskTitle.trim(), type: 'CUSTOM',
                  dueAt: new Date(taskDue).toISOString(),
                  clientId: client.id, leadId: lead?.id,
                }),
                () => { setTaskTitle(''); setTaskDue(''); },
              )} />
          </div>
        )}

        {/* Email (gated) */}
        {mode === 'email' && client.email && (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">{t('emailTo')}: {client.email}</p>
            <Select value={emailTemplate} onValueChange={setEmailTemplate}>
              <SelectTrigger><SelectValue placeholder={t('emailNoTemplate')} /></SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => <SelectItem key={tpl.id} value={tpl.id}>{tpl.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} placeholder={t('emailSubject')} required />
            {!emailTemplate && <Textarea rows={5} value={emailBody} onChange={(e) => setEmailBody(e.target.value)} />}
            <Footer busy={busy || !emailSubject.trim()} error={error}
              onCancel={() => setMode('idle')}
              onSubmit={() => submit(
                () => clientActions.sendEmail(client.id, {
                  subject: emailSubject, templateId: emailTemplate || undefined,
                  body: emailTemplate ? undefined : emailBody,
                }),
                () => { setEmailSubject(''); setEmailBody(''); setEmailTemplate(''); },
              )} />
          </div>
        )}
      </CardContent>

      <CallDispositionDialog
        open={callOpen} onOpenChange={setCallOpen}
        clientId={client.id} clientName={client.fullName} clientPhone={client.primaryPhone}
        leadId={lead?.id} onLogged={onChanged}
      />
      <ScheduleShowingDialog client={client} open={showingOpen} onOpenChange={setShowingOpen} onScheduled={onChanged} />
      <LostReasonDialog open={lostOpen} onCancel={() => setLostOpen(false)} onConfirm={confirmLost} />
    </Card>
  );
}

function Footer({ busy, error, onCancel, onSubmit }: {
  busy: boolean; error: string | null; onCancel: () => void; onSubmit: () => void;
}) {
  const tCommon = useTranslations('common');
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>{tCommon('cancel')}</Button>
        <Button type="button" size="sm" onClick={onSubmit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}{tCommon('save')}
        </Button>
      </div>
    </>
  );
}
