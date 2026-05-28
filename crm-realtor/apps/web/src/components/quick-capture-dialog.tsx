'use client';

/**
 * Quick Capture — нічний flow для риелтора.
 *
 * Один сабмит = до 4 сутностей створюються транзакційно з боку клієнта:
 *   1. Контакт (якщо телефон ще не в CRM — створюється)
 *   2. Об'єкт (якщо вибраний «свій» — створюється в inventory)
 *   3. Лід (з прив'язкою до контакта та об'єкта)
 *   4. Інтеракція:
 *      - Показ → створюється `Showing` з датою/часом
 *      - Інтерес → створюється `Activity.NOTE` з коментарем
 *
 * UX-правила:
 *   - Поля жорстко мінімізовані: тільки те, що не можна додати потім
 *   - Авто-вибір створеного контакта/об'єкта
 *   - Швидкі чіпи для коментаря («Перезвонити», «Домовленість», «Уточнити деталі»)
 *   - Працює без сторінки переходів — закрив і пішов далі
 */

import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useLocale, useTranslations } from 'next-intl';
import {
  Loader2, Sparkles, Calendar, MessageSquare, PhoneCall,
  Handshake, HelpCircle,
} from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { PhoneInput } from '@/components/ui/phone-input';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import {
  clients as clientsApi,
  properties as propsApi,
  leads as leadsApi,
  showings as showingsApi,
  tasks as tasksApi,
  clientActions,
  type ClientDetailed,
  type PropertyDetailed,
} from '@/lib/api';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

type Intent = 'BUY' | 'RENT';
type Action = 'showing' | 'interest';
type InterestPreset = 'callback' | 'agreement' | 'clarify' | 'custom';

const PRESET_ICON: Record<InterestPreset, React.ComponentType<{ className?: string }>> = {
  callback:  PhoneCall,
  agreement: Handshake,
  clarify:   HelpCircle,
  custom:    MessageSquare,
};
const PRESET_ORDER: InterestPreset[] = ['callback', 'agreement', 'clarify', 'custom'];

export function QuickCaptureDialog() {
  const open = useUIStore((s) => s.quickCaptureOpen);
  const close = useUIStore((s) => s.closeQuickCapture);
  const router = useRouter();
  const locale = useLocale();
  const t = useTranslations('quickCapture');
  const tCommon = useTranslations('common');

  const PRESET_TEXTS: Record<InterestPreset, string> = useMemo(() => ({
    callback:  t('presets.callbackText'),
    agreement: t('presets.agreementText'),
    clarify:   t('presets.clarifyText'),
    custom:    '',
  }), [t]);

  // --- Form state ---
  const [step, setStep] = useState<'form' | 'saving'>('form');

  // 1) Contact
  const [clientsList, setClientsList] = useState<ClientDetailed[]>([]);
  const [clientId, setClientId] = useState('');
  const [newClientName, setNewClientName] = useState('');
  const [newClientPhone, setNewClientPhone] = useState('');
  const [clientMode, setClientMode] = useState<'existing' | 'new'>('new');

  // 2) Intent + property
  const [intent, setIntent] = useState<Intent>('BUY');
  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);
  const [propertyId, setPropertyId] = useState('');
  const [propMode, setPropMode] = useState<'existing' | 'new' | 'skip'>('new');
  const [newPropDistrict, setNewPropDistrict] = useState('');
  const [newPropAddress, setNewPropAddress] = useState('');
  const [newPropPrice, setNewPropPrice] = useState('');

  // 3) Action
  const [action, setAction] = useState<Action>('interest');
  const [showingWhen, setShowingWhen] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(12, 0, 0, 0);
    return toLocalDT(d);
  });
  const [interestPreset, setInterestPreset] = useState<InterestPreset>('callback');
  const [interestNote, setInterestNote] = useState('');
  // Optional reminder: when "callback" preset is chosen, realtor can set
  // exactly WHEN to call back — we create a FOLLOWUP task with that dueAt.
  const [callbackWhen, setCallbackWhen] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() + 1);
    d.setHours(10, 0, 0, 0);
    return toLocalDT(d);
  });

  // Seed initial note text once translations are ready
  useEffect(() => {
    if (!interestNote) setInterestNote(PRESET_TEXTS.callback);
  }, [PRESET_TEXTS, interestNote]);

  useEffect(() => {
    if (!open) return;
    // Load existing options (for "existing" picker fallback)
    clientsApi.list({ pageSize: 100 }).then((d) => setClientsList(d.items)).catch(() => undefined);
    propsApi.list({ pageSize: 100 }).then((d) => setPropsList(d.items)).catch(() => undefined);
  }, [open]);

  useEffect(() => {
    if (!open) {
      // Reset on close
      setStep('form');
      setClientId('');
      setNewClientName('');
      setNewClientPhone('');
      setClientMode('new');
      setIntent('BUY');
      setPropertyId('');
      setPropMode('new');
      setNewPropDistrict('');
      setNewPropAddress('');
      setNewPropPrice('');
      setAction('interest');
      setInterestPreset('callback');
      setInterestNote(PRESET_TEXTS.callback);
    }
  }, [open, PRESET_TEXTS]);

  // Update note when preset switches (unless user customized)
  function pickPreset(p: InterestPreset) {
    setInterestPreset(p);
    if (p !== 'custom') setInterestNote(PRESET_TEXTS[p]);
    else if (!interestNote.trim()) setInterestNote('');
  }

  const filteredProps = useMemo(
    () => propsList.filter((p) => (p.dealIntent ?? 'BUY') === intent),
    [propsList, intent],
  );

  // Compute the first missing requirement so we can tell the user what's blocking submit.
  const blockedReason: string | null = (() => {
    if (clientMode === 'existing' && !clientId) return t('blocked.pickClient');
    if (clientMode === 'new' && !newClientName.trim()) return t('blocked.clientName');
    if (clientMode === 'new' && !newClientPhone.trim()) return t('blocked.clientPhone');
    if (action === 'showing') {
      if (propMode === 'skip') return t('blocked.propertyForShowing');
      if (propMode === 'existing' && !propertyId) return t('blocked.pickProperty');
      if (propMode === 'new') {
        if (!newPropDistrict.trim()) return t('blocked.district');
        if (!newPropAddress.trim()) return t('blocked.address');
        if (!newPropPrice.trim()) return t('blocked.price');
      }
      if (!showingWhen) return t('blocked.showingWhen');
    } else {
      if (!interestNote.trim()) return t('blocked.interestNote');
      // Partial property in "new" mode — disallow.
      if (propMode === 'new' && (newPropDistrict || newPropAddress || newPropPrice)) {
        if (!newPropDistrict.trim()) return t('blocked.district');
        if (!newPropAddress.trim()) return t('blocked.address');
        if (!newPropPrice.trim()) return t('blocked.price');
      }
    }
    return null;
  })();
  const canSubmit = blockedReason === null;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) return;
    setStep('saving');
    try {
      // 1. Contact
      let resolvedClientId = clientId;
      if (clientMode === 'new') {
        const c = await clientsApi.create({
          fullName: newClientName.trim(),
          primaryPhone: newClientPhone.trim(),
        });
        resolvedClientId = c.id;
      }

      // 2. Property
      let resolvedPropertyId: string | null = null;
      if (propMode === 'existing' && propertyId) {
        resolvedPropertyId = propertyId;
      } else if (propMode === 'new' && newPropDistrict.trim()) {
        const p = await propsApi.create({
          type: 'APARTMENT',
          dealIntent: intent,
          status: 'AVAILABLE',
          district: newPropDistrict.trim(),
          address: newPropAddress.trim(),
          price: Number(newPropPrice),
          area: 1, // дозаповните пізніше — area required by schema (validation min 1)
          currency: 'EUR',
        } as Parameters<typeof propsApi.create>[0]);
        resolvedPropertyId = p.id;
      }

      // 3. Lead
      const leadBody: Parameters<typeof leadsApi.create>[0] = {
        clientId: resolvedClientId,
        dealIntent: intent,
        priority: 'warm',
      };
      if (resolvedPropertyId) leadBody.interestPropertyId = resolvedPropertyId;
      const lead = await leadsApi.create(leadBody);

      // 4. Action
      if (action === 'showing' && resolvedPropertyId) {
        await showingsApi.create({
          clientId: resolvedClientId,
          propertyId: resolvedPropertyId,
          scheduledAt: new Date(showingWhen).toISOString(),
          durationMin: 60,
        });
      } else if (action === 'interest' && interestNote.trim()) {
        await clientActions.addNote(resolvedClientId, interestNote.trim());
        // If preset is "callback" and a time was set — schedule a FOLLOWUP task
        // so the realtor sees it in /today at the right moment.
        if (interestPreset === 'callback' && callbackWhen) {
          await tasksApi.create({
            title: t('callbackTaskTitle', { name: clientMode === 'new' ? newClientName.trim() : (clientsList.find((c) => c.id === resolvedClientId)?.fullName ?? '') }),
            type: 'CALL',
            dueAt: new Date(callbackWhen).toISOString(),
            clientId: resolvedClientId,
            leadId: lead.id,
            description: interestNote.trim() || undefined,
          }).catch(() => undefined); // non-fatal — note is already saved
        }
      }

      toast.success(t('toastSaved', { extra: action === 'showing' ? t('toastSavedShowing') : t('toastSavedInterest') }));
      close();
      router.push(`/leads/${lead.id}`);
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('toastError'));
      setStep('form');
    }
  }

  if (!open) return null;

  const showingTimeChips = [
    { key: 'tomorrow10', tomorrow: true, hour: 10 },
    { key: 'tomorrow15', tomorrow: true, hour: 15 },
    { key: 'in2days',    days: 2,        hour: 12 },
    { key: 'weekend',    weekend: true,  hour: 12 },
  ] as const;

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="max-w-md sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            {t('title')}
          </DialogTitle>
          <p className="text-xs text-muted-foreground">
            {t('subtitle')}
          </p>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-5">
          {/* 1. Contact */}
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('section1')}
              </Label>
              <SegTabs
                value={clientMode}
                onChange={(v) => setClientMode(v as 'existing' | 'new')}
                items={[
                  { value: 'new',      label: t('contactMode.new') },
                  { value: 'existing', label: t('contactMode.existing') },
                ]}
              />
            </div>
            {clientMode === 'new' ? (
              <div className="grid sm:grid-cols-2 gap-2">
                <Input
                  required
                  autoFocus
                  value={newClientName}
                  onChange={(e) => setNewClientName(e.target.value)}
                  placeholder={t('clientNamePlaceholder')}
                />
                <PhoneInput
                  required
                  value={newClientPhone}
                  onChange={setNewClientPhone}
                  locale={locale}
                />
              </div>
            ) : (
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pickContact')} />
                </SelectTrigger>
                <SelectContent>
                  {clientsList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.fullName} · {c.primaryPhone}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </section>

          {/* 2. Intent + Property */}
          <section className="space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('section2')}
              </Label>
              <div className="flex items-center gap-2 flex-wrap">
                <SegTabs
                  value={intent}
                  onChange={(v) => { setIntent(v as Intent); setPropertyId(''); }}
                  items={[
                    { value: 'BUY',  label: t('intent.BUY') },
                    { value: 'RENT', label: t('intent.RENT') },
                  ]}
                />
                <SegTabs
                  value={propMode}
                  onChange={(v) => setPropMode(v as 'existing' | 'new' | 'skip')}
                  items={[
                    { value: 'new',      label: t('propMode.new') },
                    { value: 'existing', label: t('propMode.existing') },
                    { value: 'skip',     label: t('propMode.skip') },
                  ]}
                />
              </div>
            </div>

            {propMode === 'new' && (
              <div className="grid sm:grid-cols-3 gap-2">
                <Input
                  value={newPropDistrict}
                  onChange={(e) => setNewPropDistrict(e.target.value)}
                  placeholder={t('district')}
                />
                <Input
                  className="sm:col-span-2"
                  value={newPropAddress}
                  onChange={(e) => setNewPropAddress(e.target.value)}
                  placeholder={t('address')}
                />
                <Input
                  className="sm:col-span-3"
                  type="number"
                  value={newPropPrice}
                  onChange={(e) => setNewPropPrice(e.target.value)}
                  placeholder={intent === 'RENT' ? t('pricePerMonth') : t('price')}
                />
                <p className="sm:col-span-3 text-3xs text-muted-foreground">
                  {t('propertyHint')}
                </p>
              </div>
            )}

            {propMode === 'existing' && (
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder={t('pickProperty', { intent: intent === 'RENT' ? t('intent.RENT').toLowerCase() : t('intent.BUY').toLowerCase() })} />
                </SelectTrigger>
                <SelectContent>
                  {filteredProps.length === 0 ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">
                      {t('noPropertiesFor', { intent: intent === 'RENT' ? t('intent.RENT').toLowerCase() : t('intent.BUY').toLowerCase() })}
                    </div>
                  ) : (
                    filteredProps.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.address} · {p.district}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            )}

            {propMode === 'skip' && (
              <p className="text-xs text-muted-foreground italic px-1">
                {t('skipHint')}
              </p>
            )}
          </section>

          {/* 3. Action */}
          <section className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('section3')}
            </Label>
            <div className="grid sm:grid-cols-2 gap-2">
              <ActionCard
                active={action === 'interest'}
                icon={MessageSquare}
                title={t('actions.interestTitle')}
                hint={t('actions.interestHint')}
                onClick={() => setAction('interest')}
              />
              <ActionCard
                active={action === 'showing'}
                icon={Calendar}
                title={t('actions.showingTitle')}
                hint={t('actions.showingHint')}
                onClick={() => setAction('showing')}
              />
            </div>

            {action === 'showing' ? (
              <div className="space-y-2 pt-1">
                <Label className="text-xs">{t('dateTime')} *</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <Input
                    type="date"
                    value={showingWhen.slice(0, 10)}
                    onChange={(e) => {
                      const time = showingWhen.slice(11) || '10:00';
                      setShowingWhen(`${e.target.value}T${time}`);
                    }}
                    required
                  />
                  <Input
                    type="time"
                    value={showingWhen.slice(11) || '10:00'}
                    onChange={(e) => {
                      const date = showingWhen.slice(0, 10);
                      setShowingWhen(`${date}T${e.target.value}`);
                    }}
                    required
                  />
                </div>
                <div className="flex gap-1 flex-wrap">
                  {['10:00', '12:00', '15:00', '17:00', '19:00'].map((h) => (
                    <button
                      key={h}
                      type="button"
                      onClick={() => {
                        const date = showingWhen.slice(0, 10);
                        setShowingWhen(`${date}T${h}`);
                      }}
                      className={cn(
                        'rounded-md border px-2 py-0.5 text-2xs font-medium tabular-nums transition-colors',
                        showingWhen.slice(11, 16) === h
                          ? 'bg-primary text-primary-foreground border-primary'
                          : 'border-border bg-background text-muted-foreground hover:bg-muted',
                      )}
                    >
                      {h}
                    </button>
                  ))}
                </div>
                <div className="flex gap-1.5 flex-wrap pt-1">
                  {showingTimeChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={() => {
                        const d = new Date();
                        if ('tomorrow' in chip && chip.tomorrow) d.setDate(d.getDate() + 1);
                        else if ('days' in chip && chip.days) d.setDate(d.getDate() + chip.days);
                        else if ('weekend' in chip && chip.weekend) {
                          const day = d.getDay();
                          const daysUntilSat = (6 - day + 7) % 7 || 7;
                          d.setDate(d.getDate() + daysUntilSat);
                        }
                        d.setHours(chip.hour, 0, 0, 0);
                        setShowingWhen(toLocalDT(d));
                      }}
                      className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                    >
                      {t(`whenChip.${chip.key}`)}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              <div className="space-y-2 pt-1">
                <div className="flex flex-wrap gap-1.5">
                  {PRESET_ORDER.map((value) => {
                    const Icon = PRESET_ICON[value];
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => pickPreset(value)}
                        className={cn(
                          'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium transition-colors',
                          interestPreset === value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'border-border bg-background text-muted-foreground hover:bg-muted',
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {t(`presets.${value}`)}
                      </button>
                    );
                  })}
                </div>
                <Textarea
                  value={interestNote}
                  onChange={(e) => { setInterestNote(e.target.value); setInterestPreset('custom'); }}
                  rows={2}
                  placeholder={t('interestPlaceholder')}
                />

                {/* Callback time — only when preset is "callback" */}
                {interestPreset === 'callback' && (
                  <div className="space-y-2 rounded-lg border border-dashed border-border bg-muted/30 p-2.5">
                    <Label className="text-xs flex items-center gap-1.5">
                      <PhoneCall className="h-3 w-3 text-primary" />
                      {t('callbackWhen')}
                    </Label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <Input
                        type="date"
                        value={callbackWhen.slice(0, 10)}
                        onChange={(e) => {
                          const time = callbackWhen.slice(11) || '10:00';
                          setCallbackWhen(`${e.target.value}T${time}`);
                        }}
                      />
                      <Input
                        type="time"
                        value={callbackWhen.slice(11) || '10:00'}
                        onChange={(e) => {
                          const date = callbackWhen.slice(0, 10);
                          setCallbackWhen(`${date}T${e.target.value}`);
                        }}
                      />
                    </div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[
                        { key: 'in1h',       mins: 60 },
                        { key: 'in3h',       mins: 180 },
                        { key: 'tomorrow10', tomorrow: true, hour: 10 },
                        { key: 'tomorrow15', tomorrow: true, hour: 15 },
                      ].map((chip) => (
                        <button
                          key={chip.key}
                          type="button"
                          onClick={() => {
                            const d = new Date();
                            if ('mins' in chip && chip.mins) {
                              d.setMinutes(d.getMinutes() + chip.mins);
                              d.setSeconds(0, 0);
                            } else if ('tomorrow' in chip && chip.tomorrow) {
                              d.setDate(d.getDate() + 1);
                              d.setHours(chip.hour ?? 10, 0, 0, 0);
                            }
                            setCallbackWhen(toLocalDT(d));
                          }}
                          className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          {t(`callbackChip.${chip.key}`)}
                        </button>
                      ))}
                    </div>
                    <p className="text-3xs text-muted-foreground">
                      {t('callbackHint')}
                    </p>
                  </div>
                )}
              </div>
            )}
          </section>

          {/* Inline hint about what's missing — explains why submit is disabled. */}
          {blockedReason && (
            <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/60 rounded-lg px-3 py-2">
              <span className="font-medium">{t('blocked.label')}:</span> {blockedReason}
            </p>
          )}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={close} disabled={step === 'saving'}>
              {tCommon('cancel')}
            </Button>
            <Button type="submit" disabled={!canSubmit || step === 'saving'}>
              {step === 'saving' && <Loader2 className="h-4 w-4 animate-spin" />}
              {t('createLead')}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function SegTabs<T extends string>({
  value, onChange, items,
}: {
  value: T;
  onChange: (v: T) => void;
  items: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
      {items.map((it) => (
        <button
          key={it.value}
          type="button"
          onClick={() => onChange(it.value)}
          className={cn(
            'px-2.5 py-1 transition-colors',
            value === it.value
              ? 'bg-primary text-primary-foreground'
              : 'bg-background hover:bg-muted text-muted-foreground',
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  );
}

function ActionCard({
  active, icon: Icon, title, hint, onClick,
}: {
  active: boolean;
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  hint: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-start gap-1 rounded-lg border px-3 py-2.5 text-left transition-all',
        active
          ? 'border-primary bg-primary/5 ring-1 ring-inset ring-primary/20'
          : 'border-border hover:bg-muted',
      )}
    >
      <div className="flex items-center gap-1.5 font-medium text-sm">
        <Icon className={cn('h-3.5 w-3.5', active ? 'text-primary' : 'text-muted-foreground')} />
        {title}
      </div>
      <div className="text-2xs text-muted-foreground">{hint}</div>
    </button>
  );
}

function toLocalDT(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
