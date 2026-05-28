'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Phone, PhoneOff, PhoneMissed, Loader2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { clientActions, tasks } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Outcome = 'ANSWERED' | 'NO_ANSWER' | 'BUSY';
type FollowupKey = 'in1h' | 'todayEvening' | 'tomorrow10' | 'in3days';

const OUTCOME_META: { value: Outcome; icon: React.ComponentType<{ className?: string }>; tone: string }[] = [
  { value: 'ANSWERED',  icon: Phone,       tone: 'border-emerald-300 bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-300' },
  { value: 'NO_ANSWER', icon: PhoneMissed, tone: 'border-amber-300 bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300' },
  { value: 'BUSY',      icon: PhoneOff,    tone: 'border-slate-300 bg-slate-50 text-slate-700 dark:bg-slate-800/40 dark:text-slate-300' },
];

const FOLLOWUP_DEFS: { key: FollowupKey; minutes?: number; hour?: number; tomorrow?: boolean; days?: number }[] = [
  { key: 'in1h',         minutes: 60 },
  { key: 'todayEvening', hour: 18 },
  { key: 'tomorrow10',   tomorrow: true, hour: 10 },
  { key: 'in3days',      days: 3, hour: 10 },
];

/**
 * Call-disposition modal. Opens after the realtor pressed «Подзвонити» (or the
 * tel:-link) to capture the result: who answered, did they pick up, and what's
 * the next step. Creates an Activity.CALL + (optional) follow-up Task in one shot.
 */
export function CallDispositionDialog({
  open,
  onOpenChange,
  clientId,
  clientName,
  clientPhone,
  leadId,
  onLogged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  clientId: string;
  clientName: string;
  clientPhone: string;
  leadId?: string;
  onLogged?: () => void;
}) {
  const t = useTranslations('callDispo');
  const tOutcomes = useTranslations('clientActions.outcomes');
  const tCommon = useTranslations('common');
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [note, setNote] = useState('');
  const [followup, setFollowup] = useState<number | null>(null); // index into presets
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setOutcome(null);
    setNote('');
    setFollowup(null);
  }, [open]);

  async function submit() {
    if (!outcome) return;
    setSaving(true);
    try {
      await clientActions.logCall(clientId, { outcome, note: note.trim() || undefined });

      if (followup !== null) {
        const preset = FOLLOWUP_DEFS[followup];
        const due = new Date();
        if (preset.minutes) {
          due.setMinutes(due.getMinutes() + preset.minutes);
        } else if (preset.tomorrow) {
          due.setDate(due.getDate() + 1);
          due.setHours(preset.hour ?? 10, 0, 0, 0);
        } else if (preset.days) {
          due.setDate(due.getDate() + preset.days);
          due.setHours(preset.hour ?? 10, 0, 0, 0);
        } else if (preset.hour !== undefined) {
          due.setHours(preset.hour, 0, 0, 0);
        }
        await tasks.create({
          title: t('callbackTitle', { name: clientName }),
          type: 'CALL',
          dueAt: due.toISOString(),
          clientId,
          leadId,
        });
      }

      toast.success(t('saved'));
      onLogged?.();
      onOpenChange(false);
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-primary" />
            {clientName} · {clientPhone}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Outcome chips */}
          <div className="space-y-1.5">
            <Label>{t('outcome')} *</Label>
            <div className="grid grid-cols-3 gap-2">
              {OUTCOME_META.map(({ value, icon: Icon, tone }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutcome(value)}
                  className={cn(
                    'flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-sm font-medium transition-all',
                    outcome === value
                      ? `${tone} ring-1 ring-inset ring-current`
                      : 'border-border text-muted-foreground hover:bg-muted',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {tOutcomes(value)}
                </button>
              ))}
            </div>
          </div>

          {/* Note */}
          <div className="space-y-1.5">
            <Label>{t('note')}</Label>
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={outcome === 'ANSWERED' ? t('notePlaceholderAnswered') : t('notePlaceholderOptional')}
              rows={2}
            />
          </div>

          {/* Followup presets */}
          <div className="space-y-1.5">
            <Label>{t('scheduleCallback')}</Label>
            <div className="flex flex-wrap gap-1.5">
              {FOLLOWUP_DEFS.map((p, i) => (
                <button
                  key={p.key}
                  type="button"
                  onClick={() => setFollowup((cur) => (cur === i ? null : i))}
                  className={cn(
                    'px-3 py-1.5 rounded-full text-xs font-medium border transition-colors',
                    followup === i
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'border-border bg-background text-muted-foreground hover:bg-muted',
                  )}
                >
                  {t(`followups.${p.key}`)}
                </button>
              ))}
            </div>
            {followup !== null && (
              <p className="text-3xs text-muted-foreground">
                {t('willCreateTask')}
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={submit} disabled={!outcome || saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            {tCommon('save')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
