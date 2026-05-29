'use client';

/**
 * LostReasonDialog — replaces `window.prompt(...)` in the lead drag-to-LOST flow.
 *
 * Renders a list of typed reasons (radio) + an "Other" free-text box. Consumers
 * pass `open` and resolve the promise via `onConfirm(reason)` or `onCancel`.
 *
 * Wire it up in leads kanban like:
 *
 *   const [pendingLost, setPendingLost] = useState<{leadId, lead} | null>(null);
 *   ...
 *   if (stage === 'CLOSED_LOST') {
 *     setPendingLost({leadId, lead});
 *     return;
 *   }
 *   ...
 *   <LostReasonDialog
 *     open={!!pendingLost}
 *     onCancel={() => setPendingLost(null)}
 *     onConfirm={async (reason) => { ...do the move...; setPendingLost(null); }}
 *   />
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

const REASON_KEYS = [
  'priceTooHigh',
  'boughtElsewhere',
  'changedMind',
  'noFinancing',
  'badLocation',
  'other',
] as const;

type ReasonKey = (typeof REASON_KEYS)[number];

export function LostReasonDialog({
  open,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}) {
  const t = useTranslations('lostReason');
  const [selected, setSelected] = React.useState<ReasonKey>('priceTooHigh');
  const [customText, setCustomText] = React.useState('');
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelected('priceTooHigh');
      setCustomText('');
      setSubmitting(false);
    }
  }, [open]);

  async function handleConfirm() {
    const reason = selected === 'other' ? customText.trim() : t(`reasons.${selected}`);
    if (!reason) return;
    setSubmitting(true);
    try {
      await onConfirm(reason);
    } finally {
      setSubmitting(false);
    }
  }

  const canConfirm = selected !== 'other' || customText.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : onCancel())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>

        <fieldset className="space-y-1.5">
          <legend className="sr-only">{t('legend')}</legend>
          {REASON_KEYS.map((key) => {
            const id = `lost-reason-${key}`;
            return (
              <label
                key={key}
                htmlFor={id}
                className={`flex cursor-pointer items-center gap-2.5 rounded-lg border px-3 py-2 text-sm tracking-tightish transition-colors ${
                  selected === key
                    ? 'border-primary bg-primary/5 text-foreground'
                    : 'border-border/70 text-foreground/85 hover:bg-muted'
                }`}
              >
                <input
                  id={id}
                  type="radio"
                  name="lost-reason"
                  value={key}
                  checked={selected === key}
                  onChange={() => setSelected(key)}
                  className="h-3.5 w-3.5 accent-primary"
                />
                <span>{t(`reasons.${key}`)}</span>
              </label>
            );
          })}
        </fieldset>

        {selected === 'other' ? (
          <textarea
            value={customText}
            onChange={(e) => setCustomText(e.target.value)}
            placeholder={t('otherPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-lg border border-border bg-surface px-3 py-2 text-sm tracking-tightish text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary focus:ring-2 focus:ring-ring"
          />
        ) : null}

        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={submitting}>
            {t('cancel')}
          </Button>
          <Button variant="destructive" onClick={handleConfirm} disabled={!canConfirm || submitting}>
            {submitting ? t('saving') : t('confirm')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
