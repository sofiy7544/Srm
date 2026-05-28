'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { Loader2 } from 'lucide-react';
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
import { properties, type PropertyDetailed } from '@/lib/api';

const PROPERTY_TYPES = ['APARTMENT', 'HOUSE', 'COMMERCIAL', 'LAND'] as const;
const PROPERTY_STATUSES = ['AVAILABLE', 'IN_SHOWING', 'RESERVED', 'SOLD', 'ARCHIVED'] as const;
const DEAL_INTENTS = ['BUY', 'RENT'] as const;

type FormState = {
  type: (typeof PROPERTY_TYPES)[number];
  dealIntent: (typeof DEAL_INTENTS)[number];
  status: (typeof PROPERTY_STATUSES)[number];
  district: string;
  address: string;
  rooms: string;
  floor: string;
  totalFloors: string;
  area: string;
  price: string;
  currency: string;
  description: string;
};

const EMPTY: FormState = {
  type: 'APARTMENT',
  dealIntent: 'BUY',
  status: 'AVAILABLE',
  district: '',
  address: '',
  rooms: '',
  floor: '',
  totalFloors: '',
  area: '',
  price: '',
  currency: 'EUR',
  description: '',
};

export function PropertyForm({
  existing,
  defaults,
  onSuccess,
  submitLabel,
}: {
  existing?: PropertyDetailed;
  /** Prefill the empty form (ignored when `existing` is set). */
  defaults?: Partial<FormState>;
  onSuccess?: (property: PropertyDetailed) => boolean | void | Promise<boolean | void>;
  submitLabel?: React.ReactNode;
}) {
  const t = useTranslations('properties');
  const tCommon = useTranslations('common');
  const tIntent = useTranslations('clients.intent');
  const router = useRouter();

  const [form, setForm] = useState<FormState>(() =>
    existing
      ? {
          type: existing.type,
          dealIntent: existing.dealIntent ?? 'BUY',
          status: existing.status,
          district: existing.district,
          address: existing.address,
          rooms: existing.rooms?.toString() ?? '',
          floor: existing.floor?.toString() ?? '',
          totalFloors: existing.totalFloors?.toString() ?? '',
          area: existing.area.toString(),
          price: existing.price.toString(),
          currency: existing.currency,
          description: existing.description ?? '',
        }
      : { ...EMPTY, ...defaults },
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload = {
        type: form.type,
        dealIntent: form.dealIntent,
        status: form.status,
        district: form.district.trim(),
        address: form.address.trim(),
        rooms: form.rooms ? Number(form.rooms) : undefined,
        floor: form.floor ? Number(form.floor) : undefined,
        totalFloors: form.totalFloors ? Number(form.totalFloors) : undefined,
        area: Number(form.area),
        price: Number(form.price),
        currency: form.currency,
        description: form.description.trim() || undefined,
      };
      const result = existing
        ? await properties.update(existing.id, payload)
        : await properties.create(payload);
      const handled = await onSuccess?.(result);
      if (handled !== true) {
        router.push(`/properties/${result.id}`);
        router.refresh();
      }
    } catch (e) {
      const err = e as { payload?: { message?: string } };
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
            <Label>{t('dealIntent')} *</Label>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {DEAL_INTENTS.map((intent) => (
                <button
                  key={intent}
                  type="button"
                  onClick={() => update('dealIntent', intent)}
                  className={
                    'px-4 py-1.5 text-sm font-medium transition-colors ' +
                    (form.dealIntent === intent
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted text-muted-foreground')
                  }
                >
                  {tIntent(intent)}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>{t('type')} *</Label>
            <Select value={form.type} onValueChange={(v) => update('type', v as FormState['type'])}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_TYPES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {t(`types.${p}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>{t('status')} *</Label>
            <Select
              value={form.status}
              onValueChange={(v) => update('status', v as FormState['status'])}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PROPERTY_STATUSES.map((s) => (
                  <SelectItem key={s} value={s}>
                    {t(`statuses.${s}`)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="district">{t('district')} *</Label>
            <Input
              id="district"
              required
              value={form.district}
              onChange={(e) => update('district', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="address">{t('address')} *</Label>
            <Input
              id="address"
              required
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
            />
          </div>

          {/* Rooms / Floor / Total Floors — 3-column row on tablet+, stacked on mobile */}
          <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label htmlFor="rooms">{t('rooms')}</Label>
              <Input
                id="rooms"
                type="number"
                min={0}
                value={form.rooms}
                onChange={(e) => update('rooms', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="floor">{t('floor')}</Label>
              <Input
                id="floor"
                type="number"
                min={1}
                value={form.floor}
                onChange={(e) => update('floor', e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="totalFloors">{t('totalFloors')}</Label>
              <Input
                id="totalFloors"
                type="number"
                min={1}
                value={form.totalFloors}
                onChange={(e) => update('totalFloors', e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="area">{t('area')} (м²) *</Label>
            <Input
              id="area"
              type="number"
              step="0.1"
              required
              value={form.area}
              onChange={(e) => update('area', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="price">{t('price')} *</Label>
            <Input
              id="price"
              type="number"
              required
              value={form.price}
              onChange={(e) => update('price', e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="currency">{t('currency')}</Label>
            <Input
              id="currency"
              maxLength={3}
              value={form.currency}
              onChange={(e) => update('currency', e.target.value.toUpperCase())}
            />
          </div>

          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="desc">{t('description')}</Label>
            <Textarea
              id="desc"
              rows={4}
              value={form.description}
              onChange={(e) => update('description', e.target.value)}
            />
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
