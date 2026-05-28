'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { deals, leads, properties, type DealRow, type LeadDetailed, type PropertyDetailed } from '@/lib/api';
import { formatPrice } from '@/lib/formatters';

export default function NewDealPage() {
  const t = useTranslations('deals');
  const tCommon = useTranslations('common');
  const router = useRouter();
  const params = useSearchParams();

  const [leadId, setLeadId] = useState(params.get('leadId') ?? '');
  const [propertyId, setPropertyId] = useState('');
  const [amount, setAmount] = useState('');
  const [commissionPercent, setCommissionPercent] = useState('3');
  const [leadsList, setLeadsList] = useState<LeadDetailed[]>([]);
  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);
  const [allDeals, setAllDeals] = useState<DealRow[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    leads.list().then((all) => setLeadsList(all.filter((l) => !['WON', 'LOST'].includes(l.stage))));
    properties.list({ pageSize: 100 }).then((d) => setPropsList(d.items));
    // Load active deals to detect property conflicts
    deals.list({ status: 'IN_PROGRESS', pageSize: 200 }).then((d) => setAllDeals(d.items));
  }, []);

  useEffect(() => {
    if (leadId) {
      const lead = leadsList.find((l) => l.id === leadId);
      if (lead?.interestPropertyId && !propertyId) setPropertyId(lead.interestPropertyId);
      if (lead?.interestProperty?.price && !amount) setAmount(String(lead.interestProperty.price));
    }
  }, [leadId, leadsList, propertyId, amount]);

  // Check if selected property already has an active deal
  const conflictDeal = propertyId
    ? allDeals.find((d) => d.propertyId === propertyId && d.status === 'IN_PROGRESS')
    : null;

  const computedCommission =
    amount && commissionPercent ? (Number(amount) * Number(commissionPercent)) / 100 : 0;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!leadId || !amount) return;
    setSaving(true);
    setError(null);
    try {
      const deal = await deals.create({
        leadId,
        propertyId: propertyId || undefined,
        amount: Number(amount),
        commissionPercent: Number(commissionPercent),
      });
      router.push(`/deals/${deal.id}`);
    } catch (err) {
      const e = err as { payload?: { message?: string } };
      setError(e.payload?.message ?? t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4 max-w-xl">
      <h1 className="heading-page">{t('newTitle')}</h1>
      <form onSubmit={submit}>
        <Card>
          <CardHeader>
            <CardTitle>{t('mainInfo')}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <Label>{t('lead')} *</Label>
              <Select value={leadId} onValueChange={setLeadId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {leadsList.map((l) => (
                    <SelectItem key={l.id} value={l.id}>
                      {l.client.fullName} · {t(`stagesShort.${l.stage}`, { default: l.stage })}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>{t('property')}</Label>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('propertyPlaceholder')} />
                </SelectTrigger>
                <SelectContent>
                  {propsList.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.address} · {formatPrice(p.price)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Property conflict warning */}
            {conflictDeal && (
              <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-sm">
                  <span className="font-medium">Увага: </span>
                  по цьому об&#39;єкту вже є активна угода з клієнтом{' '}
                  <span className="font-semibold">{conflictDeal.client?.fullName}</span>.{' '}
                  <a
                    href={`/deals/${conflictDeal.id}`}
                    className="underline underline-offset-2 hover:opacity-80"
                  >
                    Переглянути угоду →
                  </a>
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label>{t('amount')} *</Label>
                <Input
                  type="number"
                  required
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label>{t('commissionPercent')} *</Label>
                <Input
                  type="number"
                  step="0.1"
                  required
                  value={commissionPercent}
                  onChange={(e) => setCommissionPercent(e.target.value)}
                />
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              {t('commissionAmount')}: <span className="font-semibold">{formatPrice(computedCommission)}</span>
            </p>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => router.back()}>
                {tCommon('cancel')}
              </Button>
              <Button type="submit" disabled={saving || !leadId || !amount}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                {tCommon('save')}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
