'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, Building2, Search, X, Plus } from 'lucide-react';
import { QuickPropertyDialog } from '@/components/quick-property-dialog';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { properties as propertiesApi, showings, users as usersApi } from '@/lib/api';
import type { ClientDetailed, PropertyDetailed, UserBriefList } from '@/lib/api';
import { useAuthStore } from '@/lib/auth-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export function ScheduleShowingDialog({
  client,
  open,
  onOpenChange,
  onScheduled,
}: {
  client: ClientDetailed;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onScheduled?: () => void;
}) {
  const t = useTranslations('scheduleShowing');
  const tCommon = useTranslations('common');
  const tIntent = useTranslations('clients.intent');
  const me = useAuthStore((s) => s.user);
  const isAdmin = me?.role === 'ADMIN' || me?.role === 'MANAGER';

  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);
  const [agentsList, setAgentsList] = useState<UserBriefList[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [propSearch, setPropSearch] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [quickPropertyOpen, setQuickPropertyOpen] = useState(false);
  const [date, setDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    return d.toISOString().slice(0, 10);
  });
  const [time, setTime] = useState('15:00');
  const [durationMin, setDurationMin] = useState('60');
  const [agentId, setAgentId] = useState<string>('');
  const [saving, setSaving] = useState(false);

  // Prefilter property list by client's stated intent (if any).
  const preferredIntent = client.preferences?.dealIntent;

  useEffect(() => {
    if (!open) return;
    propertiesApi.list({ pageSize: 200, status: 'AVAILABLE' }).then((d) => setPropsList(d.items));
    if (isAdmin) usersApi.list().then(setAgentsList).catch(() => undefined);
    setAgentId(me?.id ?? '');
  }, [open, isAdmin, me?.id]);

  const filtered = (() => {
    let arr = propsList;
    if (preferredIntent) arr = arr.filter((p) => (p.dealIntent ?? 'BUY') === preferredIntent);
    if (propSearch.trim()) {
      const q = propSearch.trim().toLowerCase();
      arr = arr.filter((p) =>
        p.address.toLowerCase().includes(q) || p.district.toLowerCase().includes(q),
      );
    }
    return arr;
  })();

  const selected = propsList.find((p) => p.id === propertyId);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!propertyId || !date || !time) return;
    setSaving(true);
    try {
      const scheduledAt = new Date(`${date}T${time}:00`).toISOString();
      await showings.create({
        propertyId,
        clientId: client.id,
        scheduledAt,
        durationMin: Number(durationMin) || 60,
        agentId: isAdmin && agentId !== me?.id ? agentId : undefined,
      });
      toast.success(t('scheduled'));
      onOpenChange(false);
      onScheduled?.();
      // Reset form
      setPropertyId('');
      setPropSearch('');
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('scheduleError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title', { name: client.fullName })}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          {/* Property picker */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label>{t('property')} *</Label>
              <button
                type="button"
                onClick={() => setQuickPropertyOpen(true)}
                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                <Plus className="h-3 w-3" />
                {t('newProperty')}
              </button>
            </div>
            {selected ? (
              <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 h-10 shadow-soft">
                <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1 truncate text-sm">
                  <span className="font-medium">{selected.address}</span>
                  <span className="text-muted-foreground"> · {selected.district}</span>
                </div>
                <button
                  type="button"
                  onClick={() => { setPropertyId(''); setPropSearch(''); }}
                  className="text-muted-foreground hover:text-foreground"
                  aria-label={t('clearSelection')}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
                  <Input
                    value={propSearch}
                    onChange={(e) => { setPropSearch(e.target.value); setPickerOpen(true); }}
                    onFocus={() => setPickerOpen(true)}
                    onBlur={() => setTimeout(() => setPickerOpen(false), 150)}
                    placeholder={preferredIntent
                      ? t('searchForIntent', { intent: tIntent(preferredIntent).toLowerCase() })
                      : t('searchByAddress')}
                    className="pl-9"
                  />
                </div>
                {pickerOpen && (
                  <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-surface shadow-lift max-h-60 overflow-y-auto">
                    {filtered.length === 0 ? (
                      <div className="px-3 py-2.5 text-sm text-muted-foreground">
                        {t('notFound')}
                      </div>
                    ) : (
                      filtered.map((p) => (
                        <button
                          key={p.id}
                          type="button"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setPropertyId(p.id);
                            setPropSearch('');
                            setPickerOpen(false);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center gap-2"
                        >
                          <Building2 className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                          <span className="truncate">
                            <span className="font-medium">{p.address}</span>
                            <span className="text-muted-foreground"> · {p.district}</span>
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Date + time + duration */}
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1.5">
              <Label>{t('date')} *</Label>
              <Input type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('time')} *</Label>
              <Input type="time" required value={time} onChange={(e) => setTime(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t('minutesShort')}</Label>
              <Input
                type="number"
                min={15}
                step={15}
                value={durationMin}
                onChange={(e) => setDurationMin(e.target.value)}
              />
            </div>
          </div>

          {/* Agent picker — admin/manager only */}
          {isAdmin && (
            <div className="space-y-1.5">
              <Label>{t('agent')}</Label>
              <Select value={agentId} onValueChange={setAgentId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {me && <SelectItem value={me.id}>{me.email} ({t('myself')})</SelectItem>}
                  {agentsList
                    .filter((u) => u.id !== me?.id && u.isActive)
                    .map((u) => (
                      <SelectItem key={u.id} value={u.id}>
                        {u.fullName} · {u.role}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={saving || !propertyId}>
              {saving && <Loader2 className={cn('h-4 w-4 animate-spin')} />}
              {t('schedule')}
            </Button>
          </DialogFooter>
        </form>

        <QuickPropertyDialog
          open={quickPropertyOpen}
          onOpenChange={setQuickPropertyOpen}
          initialDealIntent={preferredIntent ?? 'BUY'}
          onCreated={(p) => {
            setPropsList((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
            setPropertyId(p.id);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
