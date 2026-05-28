'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { Loader2, UserPlus } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { useLocale, useTranslations } from 'next-intl';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { PhoneInput } from '@/components/ui/phone-input';
import { clients as clientsApi, type ClientDetailed } from '@/lib/api';
import { toast } from 'sonner';

/**
 * Швидке створення клієнта з мінімальних даних (ФІО + телефон).
 *
 * Використовується скрізь, де є client-picker і реалтор зустрів нового контакта,
 * якого ще нема в CRM (форма ліда, форма події в календарі, schedule-showing).
 *
 * Onsave-колбек віддає створений ClientDetailed — інтегратор додає його до свого
 * локального списку і одразу обирає у пікері.
 */
export function QuickClientDialog({
  open,
  onOpenChange,
  initialName = '',
  initialPhone = '',
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialName?: string;
  initialPhone?: string;
  onCreated: (client: ClientDetailed) => void;
}) {
  const locale = useLocale();
  const t = useTranslations('quickClient');
  const tCommon = useTranslations('common');
  const tClients = useTranslations('clients');
  const [fullName, setFullName] = useState(initialName);
  const [primaryPhone, setPrimaryPhone] = useState(initialPhone);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setFullName(initialName);
    setPrimaryPhone(initialPhone);
  }, [open, initialName, initialPhone]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName.trim() || !primaryPhone.trim()) return;
    setSaving(true);
    try {
      // marketingConsent intentionally NOT collected here.
      // Inbound contacts have "legitimate interest" basis under GDPR — service
      // messages are allowed without explicit consent. Consent for marketing
      // newsletters is captured later on the client detail page when relevant.
      const created = await clientsApi.create({
        fullName: fullName.trim(),
        primaryPhone: primaryPhone.trim(),
      });
      toast.success(t('created'));
      // React 18 batches state updates aggressively (even across awaits).
      // We need the parent's `setClientsList` + `setClientId` to commit and
      // re-render BEFORE we tell the dialog to close — otherwise Radix Select
      // sees a new `value` while the matching `<SelectItem>` hasn't mounted yet
      // and falls back to placeholder. `flushSync` forces a synchronous commit.
      flushSync(() => {
        onCreated(created);
      });
      onOpenChange(false);
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <UserPlus className="h-4 w-4 text-primary" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          <div className="space-y-1.5">
            <Label>{tClients('fullName')} *</Label>
            <Input
              required
              autoFocus
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              placeholder={t('namePlaceholder')}
            />
          </div>
          <div className="space-y-1.5">
            <Label>{tClients('primaryPhone')} *</Label>
            <PhoneInput
              required
              value={primaryPhone}
              onChange={setPrimaryPhone}
              locale={locale}
            />
          </div>
          <p className="text-3xs text-muted-foreground">
            {t('fillRestLater')}
          </p>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saving || !fullName.trim() || !primaryPhone.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('createAndSelect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
