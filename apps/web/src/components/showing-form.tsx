'use client';

/**
 * ShowingForm — focused form that creates a property showing.
 *
 * Sprint 2.1: used by QuickCreate (⌘S). For richer event creation (with
 * recurring rules, attendees, etc.) keep using the existing EventForm in the
 * Calendar — that one wraps Showing + Task + Meeting + Call into a unified
 * editor and stays where it is.
 *
 * Future Sprint 6 (Calendar 2.0): when public booking links + drag-reschedule
 * land, this form gets a "send confirmation to client" toggle and the time
 * picker gains a "smart slot" suggester.
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  clients as clientsApi,
  properties as propsApi,
  showings,
  type ClientDetailed,
  type PropertyDetailed,
  type ShowingRow,
} from '@/lib/api';

export interface ShowingFormProps {
  /** Prefilled client (e.g. "schedule a showing for this contact"). */
  defaultClientId?: string;
  /** Prefilled property (e.g. "schedule a showing for this property"). */
  defaultPropertyId?: string;
  /** Optional start date — defaults to "next round 30-min slot from now". */
  defaultScheduledAt?: Date;
  onSuccess?: (showing: ShowingRow) => boolean | void;
  onCancel?: () => void;
  submitLabel?: React.ReactNode;
  bare?: boolean;
}

const DURATIONS = [30, 45, 60, 90, 120] as const;

/** Compute the next round 30-minute slot from `from`. */
function nextRoundSlot(from: Date = new Date()): Date {
  const d = new Date(from);
  d.setSeconds(0, 0);
  const minutes = d.getMinutes();
  const add = minutes <= 30 ? 30 - minutes : 60 - minutes;
  d.setMinutes(d.getMinutes() + add);
  return d;
}

/** Format a Date to <input type="datetime-local"> value (no Z, no seconds). */
function toLocalDatetimeValue(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function ShowingForm({
  defaultClientId,
  defaultPropertyId,
  defaultScheduledAt,
  onSuccess,
  onCancel,
  submitLabel,
  bare,
}: ShowingFormProps) {
  const t = useTranslations('showings');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [clientsList, setClientsList] = useState<ClientDetailed[]>([]);
  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);
  const [clientId, setClientId] = useState(defaultClientId ?? '');
  const [propertyId, setPropertyId] = useState(defaultPropertyId ?? '');
  const initialDate = useMemo(
    () => defaultScheduledAt ?? nextRoundSlot(),
    [defaultScheduledAt],
  );
  const [when, setWhen] = useState(toLocalDatetimeValue(initialDate));
  const [durationMin, setDurationMin] = useState<number>(60);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    clientsApi.list({ pageSize: 100 }).then((d) => setClientsList(d.items));
    propsApi.list({ pageSize: 100 }).then((d) => setPropsList(d.items));
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId || !propertyId || !when) return;
    setSaving(true);
    setError(null);
    try {
      const created = await showings.create({
        clientId,
        propertyId,
        // <input type="datetime-local"> gives a naive local string. Convert
        // through Date so the API receives a proper ISO with timezone offset.
        scheduledAt: new Date(when).toISOString(),
        durationMin,
      });
      const handled = onSuccess?.(created);
      if (handled !== true) {
        router.push('/calendar');
      }
    } catch (err) {
      const e = err as { payload?: { message?: string } };
      setError(e.payload?.message ?? t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const canSubmit = clientId && propertyId && when && !saving;

  const fields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label>{t('client')} *</Label>
        <Select value={clientId} onValueChange={setClientId}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectClient')} />
          </SelectTrigger>
          <SelectContent>
            {clientsList.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.fullName} · {c.primaryPhone}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        <Label>{t('property')} *</Label>
        <Select value={propertyId} onValueChange={setPropertyId}>
          <SelectTrigger>
            <SelectValue placeholder={t('selectProperty')} />
          </SelectTrigger>
          <SelectContent>
            {propsList.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.address} · {p.district}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-2">
          <Label>{t('scheduledAt')} *</Label>
          <div className="grid grid-cols-2 gap-2">
            <Input
              type="date"
              value={when.slice(0, 10)}
              onChange={(e) => {
                const time = when.slice(11) || '10:00';
                setWhen(`${e.target.value}T${time}`);
              }}
              required
            />
            <Input
              type="time"
              value={when.slice(11) || '10:00'}
              onChange={(e) => {
                const date = when.slice(0, 10);
                setWhen(`${date}T${e.target.value}`);
              }}
              required
            />
          </div>
        </div>
        <div className="space-y-2">
          <Label>{t('duration')}</Label>
          <Select
            value={String(durationMin)}
            onValueChange={(v) => setDurationMin(Number(v))}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DURATIONS.map((d) => (
                <SelectItem key={d} value={String(d)}>
                  {d} {t('minutesShort')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
          {submitLabel ?? tCommon('save')}
        </Button>
      </div>
    </div>
  );

  if (bare) {
    return (
      <form onSubmit={submit} className="space-y-4">
        {fields}
      </form>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-xl">
      {fields}
    </form>
  );
}
