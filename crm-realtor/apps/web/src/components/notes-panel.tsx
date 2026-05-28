'use client';

import { useEffect, useState } from 'react';
import { useLocale, useTranslations } from 'next-intl';
import { StickyNote, Loader2, X, Check } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Avatar } from '@/components/ui/avatar';
import {
  activities as activitiesApi,
  clientActions,
  type ActivityRow,
} from '@/lib/api';
import { VoiceRecorder } from '@/components/voice-recorder';
import { AudioPlayer } from '@/components/audio-player';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Notes Panel — отдельный раздел «Заметки» в карточке клиента/лида.
 *
 * Зачем отдельная панель (а не просто Timeline):
 *   - Заметки риелтора — это persistent knowledge о клиенте, к которому он
 *     возвращается часто. Timeline — это chronological feed всех действий
 *     (звонки, smailings, assignments) и заметки там тонут.
 *   - Голосовое нужно видеть/слышать целиком и легко находить — для этого
 *     нужен отдельный список с большим audio-плеером.
 *
 * Что внутри:
 *   - Заголовок «📝 Заметки» + счётчик
 *   - Inline composer: textarea + voice-recorder, всегда видимый (без раскрытия)
 *   - Лента заметок: каждая — карточка с автором/датой/текстом/audio плеером
 *   - Premium look: surface-card rounded-2xl + soft shadows + gradient accents
 */

interface NotesPanelProps {
  clientId: string;
  /** Если задан — заметка прикрепится и к лиду. */
  leadId?: string;
  /** Колбэк наверх — обновить timeline если он рядом. */
  onChanged?: () => void;
}

export function NotesPanel({ clientId, leadId, onChanged }: NotesPanelProps) {
  const t = useTranslations('notesPanel');
  const locale = useLocale();
  const [items, setItems] = useState<ActivityRow[] | null>(null);
  const [composerText, setComposerText] = useState('');
  const [voice, setVoice] = useState<{ url: string; durationMs: number; mime: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);

  // Загружаем только NOTE (фильтр на бэке).
  useEffect(() => {
    let cancelled = false;
    activitiesApi
      .byClient(clientId, undefined, ['NOTE'])
      .then((page) => {
        if (!cancelled) setItems(page.items);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [clientId, reloadKey]);

  async function saveNote() {
    if (saving) return;
    if (!composerText.trim() && !voice) return;
    setSaving(true);
    try {
      // Используем существующий /clients/:id/note endpoint с metadata.voice.
      // (Лид-привязка опционально через activities.create, если leadId задан.)
      if (leadId) {
        await activitiesApi.create({
          clientId,
          leadId,
          type: 'NOTE',
          direction: 'INTERNAL',
          content: composerText.trim(),
          metadata: voice
            ? { voice: { audioUrl: voice.url, durationMs: voice.durationMs, mime: voice.mime } }
            : undefined,
        });
      } else {
        await clientActions.addNote(
          clientId,
          composerText.trim(),
          voice
            ? { audioUrl: voice.url, durationMs: voice.durationMs, mime: voice.mime }
            : undefined,
        );
      }
      setComposerText('');
      setVoice(null);
      setReloadKey((k) => k + 1);
      onChanged?.();
      toast.success(t('saved'));
    } catch {
      toast.error(t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-700 dark:text-amber-300">
            <StickyNote className="h-4 w-4" />
          </span>
          {t('title')}
          {items && items.length > 0 && (
            <span className="text-2xs font-normal text-muted-foreground tabular-nums">
              · {items.length}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* ─── Inline composer ─────────────────────────────────────────── */}
        <div className="rounded-2xl border bg-gradient-to-br from-amber-500/[0.04] via-transparent to-transparent p-3 space-y-2.5">
          <Textarea
            value={composerText}
            onChange={(e) => setComposerText(e.target.value)}
            placeholder={t('placeholder')}
            rows={2}
            className="resize-none border-0 bg-transparent focus-visible:ring-0 px-0 shadow-none"
            onKeyDown={(e) => {
              if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                e.preventDefault();
                void saveNote();
              }
            }}
          />

          {/* Если есть записанное аудио — показываем preview-плеер */}
          {voice && (
            <div className="flex items-center gap-2 flex-wrap">
              <AudioPlayer src={voice.url} durationMs={voice.durationMs} compact />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setVoice(null)}
                title={t('discardVoice')}
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 flex-wrap pt-1">
            <div>
              {!voice && (
                <VoiceRecorder
                  compact
                  onRecorded={({ url, durationMs, mime }) => setVoice({ url, durationMs, mime })}
                />
              )}
            </div>
            <div className="flex items-center gap-2">
              <span className="hidden sm:inline text-2xs text-muted-foreground">{t('kbdHint')}</span>
              <Button
                type="button"
                size="sm"
                onClick={saveNote}
                disabled={saving || (!composerText.trim() && !voice)}
              >
                {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
                {t('save')}
              </Button>
            </div>
          </div>
        </div>

        {/* ─── Список заметок ─────────────────────────────────────────── */}
        {items === null ? (
          <div className="py-6 flex items-center justify-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t('loading')}
          </div>
        ) : items.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">{t('empty')}</p>
        ) : (
          <ul className="space-y-3">
            {items.map((note) => (
              <NoteItem key={note.id} note={note} locale={locale} />
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

function NoteItem({ note, locale }: { note: ActivityRow; locale: string }) {
  const voice = (note.metadata as { voice?: { audioUrl?: string; durationMs?: number } } | null)?.voice;
  const dt = new Date(note.createdAt);
  const localeTag = localeToBcp(locale);
  const dateLabel = dt.toLocaleString(localeTag, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
  const authorName = note.user?.fullName ?? '—';

  return (
    <li
      className={cn(
        'rounded-2xl border bg-surface p-3.5 transition-shadow hover:shadow-soft',
        // Лёгкий gradient если есть голосовое — подсветить визуально что это «больше чем текст»
        voice?.audioUrl && 'bg-gradient-to-br from-violet-500/[0.03] via-transparent to-transparent border-violet-500/20',
      )}
    >
      <div className="flex items-center gap-2 mb-2">
        <Avatar name={authorName} size="xs" />
        <span className="text-xs font-medium tracking-tightish">{authorName}</span>
        <span className="text-2xs text-muted-foreground tabular-nums">· {dateLabel}</span>
      </div>

      {note.content && (
        <p className="text-sm whitespace-pre-wrap leading-relaxed break-words">{note.content}</p>
      )}

      {voice?.audioUrl && (
        <div className="mt-2">
          <AudioPlayer src={voice.audioUrl} durationMs={voice.durationMs} />
        </div>
      )}
    </li>
  );
}

function localeToBcp(locale: string): string {
  if (locale === 'uk') return 'uk-UA';
  if (locale === 'ru') return 'ru-RU';
  if (locale === 'fr') return 'fr-FR';
  if (locale === 'it') return 'it-IT';
  return 'en-US';
}
