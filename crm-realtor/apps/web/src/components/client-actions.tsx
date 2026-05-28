'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, MessageSquare, Mail, Send, FileText, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clientActions,
  templates as templatesApi,
  type ClientDetailed,
  type TemplateRow,
} from '@/lib/api';
import { VoiceRecorder } from '@/components/voice-recorder';

type Mode = 'idle' | 'call' | 'note' | 'email';

export function ClientActions({
  client,
  onActivity,
}: {
  client: ClientDetailed;
  onActivity: () => void;
}) {
  const t = useTranslations('clientActions');
  const tCommon = useTranslations('common');
  const [mode, setMode] = useState<Mode>('idle');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<TemplateRow[]>([]);

  const [callOutcome, setCallOutcome] = useState<'ANSWERED' | 'NO_ANSWER' | 'BUSY'>('ANSWERED');
  const [callNote, setCallNote] = useState('');
  const [noteText, setNoteText] = useState('');
  // Голосовое к заметке — записывается через VoiceRecorder, мы храним URL +
  // длительность. Submit заметки прикрепляет это в Activity.metadata.voice.
  const [noteVoice, setNoteVoice] = useState<{ url: string; durationMs: number; mime: string } | null>(null);
  const [emailSubject, setEmailSubject] = useState('');
  const [emailTemplate, setEmailTemplate] = useState('');
  const [emailBody, setEmailBody] = useState('');

  useEffect(() => {
    templatesApi.list().then(setTemplates).catch(() => undefined);
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
      onActivity();
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      setError(err.payload?.message ?? t('error'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => setMode('call')}>
            <Phone className="h-4 w-4" />
            {t('logCall')}
          </Button>
          <Button variant="outline" size="sm" asChild>
            <a
              href={`https://wa.me/${waNumber}`}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                void clientActions.addNote(client.id, t('whatsappOpened')).then(onActivity);
              }}
            >
              <MessageSquare className="h-4 w-4" />
              {t('openWhatsApp')}
            </a>
          </Button>
          {tgContact && (
            <Button variant="outline" size="sm" asChild>
              <a
                href={`https://t.me/${tgContact.identifier.replace(/^@/, '')}`}
                target="_blank"
                rel="noopener noreferrer"
              >
                <Send className="h-4 w-4" />
                Telegram
              </a>
            </Button>
          )}
          {client.email && (
            <Button variant="outline" size="sm" onClick={() => setMode('email')}>
              <Mail className="h-4 w-4" />
              {t('sendEmail')}
            </Button>
          )}
          <Button variant="outline" size="sm" onClick={() => setMode('note')}>
            <FileText className="h-4 w-4" />
            {t('addNote')}
          </Button>
        </div>

        {mode === 'call' && (
          <div className="space-y-3 pt-3 border-t">
            <div className="grid sm:grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label>{t('callOutcome')}</Label>
                <Select
                  value={callOutcome}
                  onValueChange={(v) => setCallOutcome(v as typeof callOutcome)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ANSWERED">{t('outcomes.ANSWERED')}</SelectItem>
                    <SelectItem value="NO_ANSWER">{t('outcomes.NO_ANSWER')}</SelectItem>
                    <SelectItem value="BUSY">{t('outcomes.BUSY')}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label>{t('callNote')}</Label>
              <Textarea
                rows={3}
                value={callNote}
                onChange={(e) => setCallNote(e.target.value)}
                placeholder={t('callNotePlaceholder')}
              />
            </div>
            <FormFooter
              busy={busy}
              error={error}
              onCancel={() => setMode('idle')}
              onSubmit={() =>
                submit(
                  () => clientActions.logCall(client.id, { outcome: callOutcome, note: callNote || undefined }),
                  () => setCallNote(''),
                )
              }
            />
          </div>
        )}

        {mode === 'note' && (
          <div className="space-y-3 pt-3 border-t">
            <div className="space-y-1">
              <Label>{t('noteText')}</Label>
              <Textarea
                rows={3}
                value={noteText}
                onChange={(e) => setNoteText(e.target.value)}
                placeholder={t('noteText')}
              />
            </div>

            {/* Голосовая заметка — кнопка справа от поля. Если запись есть —
                рисуем превью с возможностью переслушать или удалить. */}
            <div className="flex items-center gap-2 flex-wrap">
              {noteVoice ? (
                <div className="flex items-center gap-2 rounded-lg border bg-surface px-2 py-1.5">
                  <audio src={noteVoice.url} controls className="h-9 max-w-[260px]" />
                  <span className="text-xs text-muted-foreground tabular-nums">
                    {formatVoiceDuration(noteVoice.durationMs)}
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setNoteVoice(null)}
                  >
                    ×
                  </Button>
                </div>
              ) : (
                <VoiceRecorder
                  compact
                  onRecorded={({ url, durationMs, mime }) =>
                    setNoteVoice({ url, durationMs, mime })
                  }
                />
              )}
            </div>

            <FormFooter
              // Можно отправить если есть текст ИЛИ голос
              busy={busy || (!noteText.trim() && !noteVoice)}
              error={error}
              onCancel={() => {
                setMode('idle');
                setNoteVoice(null);
              }}
              onSubmit={() =>
                submit(
                  () =>
                    clientActions.addNote(
                      client.id,
                      noteText.trim(),
                      noteVoice
                        ? {
                            audioUrl: noteVoice.url,
                            durationMs: noteVoice.durationMs,
                            mime: noteVoice.mime,
                          }
                        : undefined,
                    ),
                  () => {
                    setNoteText('');
                    setNoteVoice(null);
                  },
                )
              }
            />
          </div>
        )}

        {mode === 'email' && client.email && (
          <div className="space-y-3 pt-3 border-t">
            <p className="text-xs text-muted-foreground">{t('emailTo')}: {client.email}</p>
            <div className="space-y-1">
              <Label>{t('emailTemplate')}</Label>
              <Select value={emailTemplate} onValueChange={setEmailTemplate}>
                <SelectTrigger>
                  <SelectValue placeholder={t('emailNoTemplate')} />
                </SelectTrigger>
                <SelectContent>
                  {templates.map((tpl) => (
                    <SelectItem key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label>{t('emailSubject')}</Label>
              <Input value={emailSubject} onChange={(e) => setEmailSubject(e.target.value)} required />
            </div>
            {!emailTemplate && (
              <div className="space-y-1">
                <Label>{t('emailBody')}</Label>
                <Textarea
                  rows={5}
                  value={emailBody}
                  onChange={(e) => setEmailBody(e.target.value)}
                />
              </div>
            )}
            <FormFooter
              busy={busy || !emailSubject.trim()}
              error={error}
              onCancel={() => setMode('idle')}
              onSubmit={() =>
                submit(
                  () =>
                    clientActions.sendEmail(client.id, {
                      subject: emailSubject,
                      templateId: emailTemplate || undefined,
                      body: emailTemplate ? undefined : emailBody,
                    }),
                  () => {
                    setEmailSubject('');
                    setEmailBody('');
                    setEmailTemplate('');
                  },
                )
              }
            />
          </div>
        )}

        <p className="sr-only">{tCommon('loading')}</p>
      </CardContent>
    </Card>
  );
}

function FormFooter({
  busy,
  error,
  onCancel,
  onSubmit,
}: {
  busy: boolean;
  error: string | null;
  onCancel: () => void;
  onSubmit: () => void;
}) {
  const tCommon = useTranslations('common');
  return (
    <>
      {error && <p className="text-sm text-red-600">{error}</p>}
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" size="sm" onClick={onCancel} disabled={busy}>
          {tCommon('cancel')}
        </Button>
        <Button type="button" size="sm" onClick={onSubmit} disabled={busy}>
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {tCommon('save')}
        </Button>
      </div>
    </>
  );
}

function formatVoiceDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const min = Math.floor(totalSeconds / 60);
  const sec = totalSeconds % 60;
  return `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
