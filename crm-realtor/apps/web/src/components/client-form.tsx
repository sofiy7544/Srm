'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { SourceIcon } from '@/components/source-badge';
import {
  clients,
  sources as sourcesApi,
  type ClientContact,
  type ClientDetailed,
  type Source,
} from '@/lib/api';

type FormState = {
  fullName: string;
  primaryPhone: string;
  email: string;
  sourceId: string;
  notes: string;
  contacts: ClientContact[];
  preferences: {
    propertyType: string;
    dealIntent: string;
    currency: string;
    districts: string;
    priceMin: string;
    priceMax: string;
    roomsMin: string;
    roomsMax: string;
    areaMin: string;
    areaMax: string;
  };
};

const EMPTY: FormState = {
  fullName: '',
  primaryPhone: '',
  email: '',
  sourceId: '',
  notes: '',
  contacts: [],
  preferences: {
    propertyType: '',
    dealIntent: '',
    currency: 'EUR',
    districts: '',
    priceMin: '',
    priceMax: '',
    roomsMin: '',
    roomsMax: '',
    areaMin: '',
    areaMax: '',
  },
};

const CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'PLN', 'CZK', 'UAH'];

const CHANNELS: ClientContact['channel'][] = [
  'WHATSAPP',
  'TELEGRAM',
  'INSTAGRAM',
  'VIBER',
  'EMAIL',
  'PHONE',
];

const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND'];

export function ClientForm({
  existing,
  onSuccess,
  submitLabel,
}: {
  existing?: ClientDetailed;
  /**
   * Called after a successful save with the newly-created (or updated)
   * record. Return `true` to suppress the default router.push redirect.
   */
  onSuccess?: (client: ClientDetailed) => boolean | void;
  /** Override the submit-button label (defaults to common.save). */
  submitLabel?: React.ReactNode;
}) {
  const t = useTranslations('clients');
  const tCommon = useTranslations('common');
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() =>
    existing ? toFormState(existing) : EMPTY,
  );
  const [sources, setSources] = useState<Source[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    sourcesApi.list().then(setSources).catch(() => undefined);
  }, []);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function updatePref<K extends keyof FormState['preferences']>(
    key: K,
    value: FormState['preferences'][K],
  ) {
    setForm((f) => ({ ...f, preferences: { ...f.preferences, [key]: value } }));
  }
  function addContact() {
    setForm((f) => ({
      ...f,
      contacts: [...f.contacts, { channel: 'WHATSAPP', identifier: '', isPrimary: false }],
    }));
  }
  function removeContact(i: number) {
    setForm((f) => ({ ...f, contacts: f.contacts.filter((_, idx) => idx !== i) }));
  }
  function updateContact(i: number, patch: Partial<ClientContact>) {
    setForm((f) => ({
      ...f,
      contacts: f.contacts.map((c, idx) => (idx === i ? { ...c, ...patch } : c)),
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = toPayload(form);
      const result = existing
        ? await clients.update(existing.id, payload)
        : await clients.create(payload);
      const handled = onSuccess?.(result);
      if (handled !== true) {
        router.push(`/clients/${result.id}`);
        router.refresh();
      }
    } catch (e) {
      const err = e as { status?: number; payload?: { message?: string } };
      setError(err.payload?.message ?? t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-3xl">
      <Card>
        <CardHeader>
          <CardTitle>{t('mainInfo')}</CardTitle>
        </CardHeader>
        <CardContent className="grid sm:grid-cols-2 gap-4">
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="fullName">{t('fullName')} *</Label>
            <Input
              id="fullName"
              required
              value={form.fullName}
              onChange={(e) => update('fullName', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="phone">{t('primaryPhone')} *</Label>
            <Input
              id="phone"
              required
              placeholder="+39 333 1234567"
              value={form.primaryPhone}
              onChange={(e) => update('primaryPhone', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">{t('email')}</Label>
            <Input
              id="email"
              type="email"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>{t('source')}</Label>
            <Select value={form.sourceId} onValueChange={(v) => update('sourceId', v)}>
              <SelectTrigger>
                <SelectValue placeholder={t('selectSource')}>
                  {form.sourceId
                    ? (() => {
                        const s = sources.find((x) => x.id === form.sourceId);
                        if (!s) return t('selectSource');
                        return (
                          <span className="inline-flex items-center gap-2">
                            <SourceIcon type={s.type} />
                            {s.name}
                          </span>
                        );
                      })()
                    : null}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {sources.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    <span className="inline-flex items-center gap-2">
                      <SourceIcon type={s.type} />
                      {s.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="notes">{t('notes')}</Label>
            <Textarea
              id="notes"
              rows={3}
              value={form.notes}
              onChange={(e) => update('notes', e.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>{t('contacts')}</CardTitle>
          <Button type="button" variant="outline" size="sm" onClick={addContact}>
            <Plus className="h-4 w-4" />
            {t('addContact')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {form.contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">{t('noContacts')}</p>
          )}
          {form.contacts.map((c, i) => (
            <div key={i} className="flex gap-2 items-end">
              <div className="w-36 space-y-1">
                <Label>{t('channel')}</Label>
                <Select
                  value={c.channel}
                  onValueChange={(v) =>
                    updateContact(i, { channel: v as ClientContact['channel'] })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CHANNELS.map((ch) => (
                      <SelectItem key={ch} value={ch}>
                        {t(`channels.${ch}`)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex-1 space-y-1">
                <Label>{t('identifier')}</Label>
                <Input
                  value={c.identifier}
                  onChange={(e) => updateContact(i, { identifier: e.target.value })}
                />
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={() => removeContact(i)}
                aria-label={tCommon('delete')}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>{t('preferences')}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Deal intent toggle */}
          <div className="space-y-2">
            <Label>{t('dealIntent')}</Label>
            <div className="flex gap-2">
              {[
                { v: 'BUY', label: t('intent.BUY') },
                { v: 'RENT', label: t('intent.RENT') },
              ].map((opt) => (
                <button
                  key={opt.v}
                  type="button"
                  onClick={() =>
                    updatePref('dealIntent', form.preferences.dealIntent === opt.v ? '' : opt.v)
                  }
                  className={`flex-1 rounded-xl border px-4 py-2 text-sm font-medium tracking-tightish transition-all ${
                    form.preferences.dealIntent === opt.v
                      ? 'border-primary bg-primary text-primary-foreground shadow-glow'
                      : 'border-border bg-surface hover:border-primary/30'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t('propertyType')}</Label>
              <Select
                value={form.preferences.propertyType}
                onValueChange={(v) => updatePref('propertyType', v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t('anyType')} />
                </SelectTrigger>
                <SelectContent>
                  {PROPERTY_TYPES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {t(`propertyTypes.${p}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>{t('districts')}</Label>
              <Input
                placeholder={t('districtsPlaceholder')}
                value={form.preferences.districts}
                onChange={(e) => updatePref('districts', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>{t('currency')}</Label>
              <Select
                value={form.preferences.currency}
                onValueChange={(v) => updatePref('currency', v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{t('priceMin')}</Label>
                <Input
                  type="number"
                  value={form.preferences.priceMin}
                  onChange={(e) => updatePref('priceMin', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('priceMax')}</Label>
                <Input
                  type="number"
                  value={form.preferences.priceMax}
                  onChange={(e) => updatePref('priceMax', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{t('roomsMin')}</Label>
                <Input
                  type="number"
                  value={form.preferences.roomsMin}
                  onChange={(e) => updatePref('roomsMin', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('roomsMax')}</Label>
                <Input
                  type="number"
                  value={form.preferences.roomsMax}
                  onChange={(e) => updatePref('roomsMax', e.target.value)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-2">
                <Label>{t('areaMin')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.preferences.areaMin}
                  onChange={(e) => updatePref('areaMin', e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>{t('areaMax')}</Label>
                <Input
                  type="number"
                  step="0.1"
                  value={form.preferences.areaMax}
                  onChange={(e) => updatePref('areaMax', e.target.value)}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()}>
          {tCommon('cancel')}
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="h-4 w-4 animate-spin" />}
          {submitLabel ?? tCommon('save')}
        </Button>
      </div>
    </form>
  );
}

function toFormState(c: ClientDetailed): FormState {
  type PrefsPlus = NonNullable<ClientDetailed['preferences']> & {
    dealIntent?: 'BUY' | 'RENT' | null;
    currency?: string | null;
  };
  const p = c.preferences as PrefsPlus | null;
  return {
    fullName: c.fullName,
    primaryPhone: c.primaryPhone,
    email: c.email ?? '',
    sourceId: c.sourceId ?? '',
    notes: c.notes ?? '',
    contacts: c.contacts ?? [],
    preferences: {
      propertyType: p?.propertyType ?? '',
      dealIntent: p?.dealIntent ?? '',
      currency: p?.currency ?? 'EUR',
      districts: (p?.districts ?? []).join(', '),
      priceMin: p?.priceMin?.toString() ?? '',
      priceMax: p?.priceMax?.toString() ?? '',
      roomsMin: p?.roomsMin?.toString() ?? '',
      roomsMax: p?.roomsMax?.toString() ?? '',
      areaMin: p?.areaMin?.toString() ?? '',
      areaMax: p?.areaMax?.toString() ?? '',
    },
  };
}

function toPayload(f: FormState) {
  const prefs = f.preferences;
  const hasPrefs =
    prefs.propertyType ||
    prefs.dealIntent ||
    prefs.districts ||
    prefs.priceMin ||
    prefs.priceMax ||
    prefs.roomsMin ||
    prefs.roomsMax ||
    prefs.areaMin ||
    prefs.areaMax;

  return {
    fullName: f.fullName.trim(),
    primaryPhone: f.primaryPhone.trim(),
    email: f.email.trim() || undefined,
    sourceId: f.sourceId || undefined,
    notes: f.notes.trim() || undefined,
    contacts: f.contacts.filter((c) => c.identifier.trim()),
    preferences: hasPrefs
      ? {
          propertyType: prefs.propertyType || undefined,
          dealIntent: (prefs.dealIntent || undefined) as 'BUY' | 'RENT' | undefined,
          currency: prefs.currency || 'EUR',
          districts: prefs.districts
            .split(',')
            .map((d) => d.trim())
            .filter(Boolean),
          priceMin: prefs.priceMin ? Number(prefs.priceMin) : undefined,
          priceMax: prefs.priceMax ? Number(prefs.priceMax) : undefined,
          roomsMin: prefs.roomsMin ? Number(prefs.roomsMin) : undefined,
          roomsMax: prefs.roomsMax ? Number(prefs.roomsMax) : undefined,
          areaMin: prefs.areaMin ? Number(prefs.areaMin) : undefined,
          areaMax: prefs.areaMax ? Number(prefs.areaMax) : undefined,
        }
      : undefined,
  };
}
