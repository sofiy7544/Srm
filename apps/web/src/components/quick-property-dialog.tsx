'use client';

import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { useTranslations } from 'next-intl';
import { Loader2, Building2 } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { properties as propsApi, type PropertyDetailed, type DealIntent } from '@/lib/api';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

/**
 * Швидке створення CRM-картки об'єкта з мінімальних даних:
 * адреса + район + ціна + тип + призначення. Без фото/площі/опису — їх можна
 * дозаповнити пізніше на сторінці об'єкта.
 *
 * Сценарій: реалтор у формі ліда/події не знаходить об'єкт у CRM — клікає
 * «+ Новий об'єкт» → коротка модалка → save → автоматично обраний у пікері.
 */
export function QuickPropertyDialog({
  open,
  onOpenChange,
  initialAddress = '',
  initialDealIntent = 'BUY',
  onCreated,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialAddress?: string;
  initialDealIntent?: DealIntent;
  onCreated: (property: PropertyDetailed) => void;
}) {
  const t = useTranslations('quickProperty');
  const tCommon = useTranslations('common');
  const tIntent = useTranslations('clients.intent');
  const tTypes = useTranslations('properties.types');
  const tProps = useTranslations('properties');
  const tForm = useTranslations('leadForm');
  const [address, setAddress]       = useState(initialAddress);
  const [district, setDistrict]     = useState('');
  const [price, setPrice]           = useState('');
  const [area, setArea]             = useState('');
  const [currency, setCurrency]     = useState('EUR');
  const [type, setType]             = useState<'APARTMENT' | 'HOUSE' | 'COMMERCIAL' | 'LAND'>('APARTMENT');
  const [dealIntent, setDealIntent] = useState<DealIntent>(initialDealIntent);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setAddress(initialAddress);
    setDealIntent(initialDealIntent);
    setDistrict('');
    setPrice('');
    setArea('');
    setType('APARTMENT');
    setCurrency('EUR');
  }, [open, initialAddress, initialDealIntent]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!address.trim() || !district.trim() || !price.trim() || !area.trim()) return;
    setSaving(true);
    try {
      const created = await propsApi.create({
        type,
        dealIntent,
        status: 'AVAILABLE',
        address: address.trim(),
        district: district.trim(),
        price: Number(price),
        area: Number(area),
        currency,
      } as Parameters<typeof propsApi.create>[0]);
      toast.success(t('created'));
      // See QuickClientDialog for rationale — flushSync prevents Radix Select
      // from rendering the placeholder while the new option is still mounting.
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
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-primary" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={submit} className="space-y-3">
          {/* Intent toggle */}
          <div className="space-y-1.5">
            <Label>{tProps('dealIntent')}</Label>
            <div className="inline-flex rounded-lg border border-border overflow-hidden">
              {(['BUY', 'RENT'] as const).map((i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setDealIntent(i)}
                  className={cn(
                    'px-3 py-1.5 text-sm font-medium transition-colors',
                    dealIntent === i
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-background hover:bg-muted text-muted-foreground',
                  )}
                >
                  {tIntent(i)}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1.5">
              <Label>{tProps('type')}</Label>
              <Select value={type} onValueChange={(v) => setType(v as typeof type)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="APARTMENT">{tTypes('APARTMENT')}</SelectItem>
                  <SelectItem value="HOUSE">{tTypes('HOUSE')}</SelectItem>
                  <SelectItem value="COMMERCIAL">{tTypes('COMMERCIAL')}</SelectItem>
                  <SelectItem value="LAND">{tTypes('LAND')}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{tProps('district')} *</Label>
              <Input
                required
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder={t('districtPlaceholder')}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label>{tProps('address')} *</Label>
            <Input
              required
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder={t('addressPlaceholder')}
            />
          </div>

          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>{dealIntent === 'RENT' ? `${t('pricePerMonth')} *` : `${tProps('price')} *`}</Label>
              <Input
                required
                type="number"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder={dealIntent === 'RENT' ? '20000' : '3500000'}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{t('areaLabel')} *</Label>
              <Input
                required
                type="number"
                step="0.1"
                value={area}
                onChange={(e) => setArea(e.target.value)}
                placeholder="62"
              />
            </div>
            <div className="space-y-1.5">
              <Label>{tProps('currency')}</Label>
              <Select value={currency} onValueChange={setCurrency}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="EUR">EUR</SelectItem>
                  <SelectItem value="USD">USD</SelectItem>
                  <SelectItem value="GBP">GBP</SelectItem>
                  <SelectItem value="CHF">CHF</SelectItem>
                  <SelectItem value="PLN">PLN</SelectItem>
                  <SelectItem value="UAH">UAH</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <p className="text-3xs text-muted-foreground">
            {t('fillRestLater')}
          </p>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saving || !address.trim() || !district.trim() || !price.trim()}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />}
              {tForm('createAndSelect')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
