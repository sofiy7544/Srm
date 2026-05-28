'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { Trash2, ExternalLink, Loader2, X, Plus } from 'lucide-react';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { QuickClientDialog } from '@/components/quick-client-dialog';
import { QuickPropertyDialog } from '@/components/quick-property-dialog';
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
import {
  clients as clientsApi,
  properties as propsApi,
  showings,
  tasks,
  type ClientDetailed,
  type PropertyDetailed,
} from '@/lib/api';
import {
  deleteEvent,
  type CalendarEvent,
  type CalendarEventKind,
} from '@/lib/calendar';
import { cn } from '@/lib/utils';
import { EVENT_KIND_ICON } from './event-pill';
import { EVENT_KIND_TONE } from '@/lib/calendar';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

/** Поддерживаемые типы для создания вручную в календаре.
 *  CONTRACT и PAYMENT создаются только на странице сделки. */
const CREATABLE_KINDS: CalendarEventKind[] = ['SHOWING', 'MEETING', 'CALL', 'TASK', 'DEADLINE'];

interface EventFormProps {
  open: boolean;
  onClose: () => void;
  /** Если задан — режим редактирования / просмотра. Иначе — создание. */
  event?: CalendarEvent | null;
  /** При создании — стартовая дата (клик по сетке). */
  initialDate?: Date | null;
  onSaved: () => void;
}

export function EventForm({ open, onClose, event, initialDate, onSaved }: EventFormProps) {
  const t = useTranslations('calendar');
  const tEvent = useTranslations('eventForm');
  const tForm = useTranslations('leadForm');
  const tShowing = useTranslations('scheduleShowing');
  const confirm = useConfirm();
  const tCommon = useTranslations('common');

  const isEdit = !!event;
  const canEdit = !event || event.editable;

  const [busy, setBusy] = useState(false);

  // form state
  const [kind, setKind] = useState<CalendarEventKind>('SHOWING');
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [start, setStart] = useState<string>(toInputDateTime(initialDate ?? defaultSlot()));
  const [end, setEnd] = useState<string>(toInputDateTime(addMin(initialDate ?? defaultSlot(), 60)));
  const [clientId, setClientId] = useState('');
  const [propertyId, setPropertyId] = useState('');

  // справочники
  const [clientsList, setClientsList] = useState<ClientDetailed[]>([]);
  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);

  // quick-create dialogs
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [quickPropertyOpen, setQuickPropertyOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    clientsApi.list({ pageSize: 100 }).then((d) => setClientsList(d.items)).catch(() => undefined);
    propsApi.list({ pageSize: 100 }).then((d) => setPropsList(d.items)).catch(() => undefined);
  }, [open]);

  // Заполняем форму при открытии
  useEffect(() => {
    if (!open) return;
    if (event) {
      setKind(event.kind);
      setTitle(event.title);
      setNotes(event.notes ?? '');
      setStart(toInputDateTime(event.start));
      setEnd(toInputDateTime(event.end));
      setClientId(event.client?.id ?? '');
      setPropertyId(event.property?.id ?? '');
    } else {
      const base = initialDate ?? defaultSlot();
      setKind('SHOWING');
      setTitle('');
      setNotes('');
      setStart(toInputDateTime(base));
      setEnd(toInputDateTime(addMin(base, 60)));
      setClientId('');
      setPropertyId('');
    }
  }, [open, event, initialDate]);

  const Icon = EVENT_KIND_ICON[kind];
  const tone = EVENT_KIND_TONE[kind];

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const startDate = new Date(start);
      const endDate = new Date(end);

      if (event) {
        // редактирование
        if (event.source === 'showing') {
          const durationMin = Math.max(5, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
          await showings.update(event.refId, {
            scheduledAt: startDate.toISOString(),
            durationMin,
          });
        } else if (event.source === 'task') {
          await tasks.update(event.refId, {
            title,
            description: notes,
            dueAt: startDate.toISOString(),
          });
        }
      } else {
        // создание
        if (kind === 'SHOWING') {
          if (!clientId || !propertyId) {
            toast.error(`${t('client')} & ${t('property')}`);
            setBusy(false);
            return;
          }
          const durationMin = Math.max(5, Math.round((endDate.getTime() - startDate.getTime()) / 60_000));
          await showings.create({
            clientId,
            propertyId,
            scheduledAt: startDate.toISOString(),
            durationMin,
          });
        } else {
          // MEETING, CALL, TASK, DEADLINE → Task с соответствующим type
          const taskType =
            kind === 'CALL' ? 'CALL' : kind === 'MEETING' ? 'FOLLOWUP' : 'CUSTOM';
          await tasks.create({
            title: title || t(`types.${kind}`),
            type: taskType,
            dueAt: startDate.toISOString(),
            description: notes || undefined,
            clientId: clientId || undefined,
          });
        }
      }
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  async function onDelete() {
    if (!event) return;
    const ok = await confirm({ title: t('form.deleteConfirm'), destructive: true });
    if (!ok) return;
    setBusy(true);
    try {
      await deleteEvent(event);
      onSaved();
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="right" title={isEdit ? t('form.editTitle') : t('form.createTitle')} className="w-full sm:w-[420px] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center shrink-0', tone.bg, tone.text)}>
              <Icon className="h-4 w-4" />
            </div>
            <div className="min-w-0">
              <h2 className="font-semibold tracking-tight2 truncate">
                {isEdit ? t('form.editTitle') : t('form.createTitle')}
              </h2>
              <p className="text-xs text-muted-foreground">{t(`types.${kind}`)}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-11 px-3 -mr-1 rounded-lg hover:bg-muted flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
            aria-label="close"
          >
            <X className="h-4 w-4" />
            <span className="hidden sm:inline">{tCommon('cancel')}</span>
          </button>
        </div>

        {!canEdit && event && (
          <div className="mx-5 mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            {t('form.cannotEditAuto', { source: t(`form.source${capitalize(event.source)}`) })}
          </div>
        )}

        <form onSubmit={onSubmit} className="flex-1 flex flex-col min-h-0">
          <div className="flex-1 overflow-auto p-5 space-y-4">
          {/* Тип события — только при создании */}
          {!isEdit && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('form.kind')}
              </Label>
              <Select value={kind} onValueChange={(v) => setKind(v as CalendarEventKind)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CREATABLE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {t(`types.${k}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {/* Title — для всего, кроме SHOWING (там title = адрес объекта) */}
          {kind !== 'SHOWING' && (
            <div className="space-y-1.5">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('form.title')}
              </Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={t('form.titlePlaceholder')}
                disabled={!canEdit}
                required
              />
            </div>
          )}

          {/* Client */}
          {(kind === 'SHOWING' || kind === 'CALL' || kind === 'MEETING') && !isEdit && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('client')} {kind === 'SHOWING' && '*'}
                </Label>
                <button
                  type="button"
                  onClick={() => setQuickClientOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  {tForm('newContact')}
                </button>
              </div>
              <Select value={clientId} onValueChange={setClientId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
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
          )}

          {/* Property — только для SHOWING */}
          {kind === 'SHOWING' && !isEdit && (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                  {t('property')} *
                </Label>
                <button
                  type="button"
                  onClick={() => setQuickPropertyOpen(true)}
                  className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                >
                  <Plus className="h-3 w-3" />
                  {tShowing('newProperty')}
                </button>
              </div>
              <Select value={propertyId} onValueChange={setPropertyId}>
                <SelectTrigger>
                  <SelectValue placeholder="—" />
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
          )}

          {/* Время */}
          <div className="space-y-2">
            {/* Quick-time chips — only when creating, not editing */}
            {canEdit && !isEdit && (
              <div className="flex gap-1.5 flex-wrap">
                {[
                  { key: 'in1h',       label: tEvent('chips.in1h'),       minsFromNow: 60, dur: 60 },
                  { key: 'at12',       label: '12:00',                    hour: 12, dur: 60 },
                  { key: 'at15',       label: '15:00',                    hour: 15, dur: 60 },
                  { key: 'evening18',  label: tEvent('chips.evening18'),  hour: 18, dur: 60 },
                  { key: 'tomorrow10', label: tEvent('chips.tomorrow10'), tomorrow: true, hour: 10, dur: 60 },
                ].map((chip) => (
                  <button
                    key={chip.key}
                    type="button"
                    onClick={() => {
                      let d = new Date();
                      if (chip.minsFromNow) {
                        d = new Date(d.getTime() + chip.minsFromNow * 60_000);
                        d.setSeconds(0, 0);
                      } else if (chip.hour !== undefined) {
                        if (chip.tomorrow) d.setDate(d.getDate() + 1);
                        d.setHours(chip.hour, 0, 0, 0);
                      }
                      setStart(toInputDateTime(d));
                      setEnd(toInputDateTime(addMin(d, chip.dur)));
                    }}
                    className="rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    {chip.label}
                  </button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('form.start')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={start.slice(0, 10)}
                  onChange={(e) => {
                    const time = start.slice(11) || '10:00';
                    const next = `${e.target.value}T${time}`;
                    setStart(next);
                    if (new Date(next) >= new Date(end)) {
                      setEnd(toInputDateTime(addMin(new Date(next), 60)));
                    }
                  }}
                  disabled={!canEdit}
                  required
                />
                <Input
                  type="time"
                  value={start.slice(11) || '10:00'}
                  onChange={(e) => {
                    const date = start.slice(0, 10);
                    const next = `${date}T${e.target.value}`;
                    setStart(next);
                    if (new Date(next) >= new Date(end)) {
                      setEnd(toInputDateTime(addMin(new Date(next), 60)));
                    }
                  }}
                  disabled={!canEdit}
                  required
                />
              </div>
              <Label className="text-xs uppercase tracking-wide text-muted-foreground pt-1">
                {t('form.end')}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <Input
                  type="date"
                  value={end.slice(0, 10)}
                  onChange={(e) => {
                    const time = end.slice(11) || '11:00';
                    setEnd(`${e.target.value}T${time}`);
                  }}
                  disabled={!canEdit}
                  required
                />
                <Input
                  type="time"
                  value={end.slice(11) || '11:00'}
                  onChange={(e) => {
                    const date = end.slice(0, 10);
                    setEnd(`${date}T${e.target.value}`);
                  }}
                  disabled={!canEdit}
                  required
                />
              </div>
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label className="text-xs uppercase tracking-wide text-muted-foreground">
              {t('form.notes')}
            </Label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('form.notesPlaceholder')}
              disabled={!canEdit}
              rows={3}
            />
          </div>

          {/* Метаданные для просмотра существующего */}
          {event && (
            <div className="rounded-xl border bg-muted/30 p-3 space-y-1.5 text-sm">
              {event.client && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{t('client')}</span>
                  <Link href={`/clients/${event.client.id}`} className="font-medium hover:text-primary truncate">
                    {event.client.fullName}
                  </Link>
                </div>
              )}
              {event.property && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{t('property')}</span>
                  <Link href={`/properties/${event.property.id}`} className="font-medium hover:text-primary truncate">
                    {event.property.address}
                  </Link>
                </div>
              )}
              {event.manager && (
                <div className="flex items-center justify-between gap-2">
                  <span className="text-muted-foreground text-xs">{tEvent('manager')}</span>
                  <span className="font-medium truncate">{event.manager.fullName}</span>
                </div>
              )}
              {event.relatedDealId && (
                <div className="pt-1.5 mt-1.5 border-t">
                  <Link
                    href={`/deals/${event.relatedDealId}`}
                    className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                  >
                    <ExternalLink className="h-3 w-3" />
                    {t('form.relatedDeal')}
                  </Link>
                </div>
              )}
            </div>
          )}
          </div>

          {/* footer */}
          <div className="border-t p-4 flex items-center gap-2">
            {isEdit && canEdit && (
              <Button type="button" variant="outline" onClick={onDelete} disabled={busy}>
                <Trash2 className="h-4 w-4 text-danger" />
                {t('form.delete')}
              </Button>
            )}
            <div className="ml-auto flex gap-2">
              <Button type="button" variant="outline" onClick={onClose}>
                {tCommon('cancel')}
              </Button>
              {canEdit && (
                <Button type="submit" disabled={busy}>
                  {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                  {t('form.save')}
                </Button>
              )}
            </div>
          </div>
        </form>

        <QuickClientDialog
          open={quickClientOpen}
          onOpenChange={setQuickClientOpen}
          onCreated={(c) => {
            setClientsList((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
            setClientId(c.id);
          }}
        />

        <QuickPropertyDialog
          open={quickPropertyOpen}
          onOpenChange={setQuickPropertyOpen}
          onCreated={(p) => {
            setPropsList((prev) => (prev.some((x) => x.id === p.id) ? prev : [p, ...prev]));
            setPropertyId(p.id);
          }}
        />
      </SheetContent>
    </Sheet>
  );
}

function defaultSlot(): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
}

function addMin(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

function toInputDateTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
