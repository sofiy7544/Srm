'use client';

/**
 * LeadForm — extracted from the body of `/leads/new/page.tsx` so it can be
 * rendered both at the full route AND inside the QuickCreate slide-over.
 *
 * Sprint 2.1: identical fields and validation to the original page. The /new
 * page becomes a 3-line shell around this component (see PATCH_new_pages.txt).
 *
 * Future Sprint 2.x: replace the Select-based pickers with @tanstack-style
 * combobox + server-side autocomplete (`GET /api/search?q=&kind=client`).
 * 100-row lists hit a wall around 5-10k contacts.
 */

import { useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { AlertTriangle, Loader2, Building2, Search, X, FileText, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from '@/components/ui/dialog';
import { PropertyForm } from '@/components/property-form';
import { QuickClientDialog } from '@/components/quick-client-dialog';
import { toast } from 'sonner';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  clients as clientsApi,
  properties as propertiesApi,
  leads,
  uploads,
} from '@/lib/api';
import { Flame, Star, Snowflake } from 'lucide-react';
import type { ClientDetailed, PropertyDetailed, LeadDetailed } from '@/lib/api';

export interface LeadFormProps {
  /** Prefill the client picker (used by "create lead from contact" CTAs). */
  defaultClientId?: string;
  /**
   * Called on successful creation. Return `true` to suppress the default
   * router.push to /leads/:id redirect.
   */
  onSuccess?: (lead: LeadDetailed) => boolean | void;
  /** Optional Cancel handler — when set, replaces the default router.back(). */
  onCancel?: () => void;
  /** Override the submit-button label (defaults to common.save). */
  submitLabel?: React.ReactNode;
  /**
   * When true, the form is rendered without its outer <Card> chrome — useful
   * when the parent is already a panel (e.g. inside QuickCreate's SlideOver).
   */
  bare?: boolean;
}

const ACTIVE_STAGES = ['NEW', 'CONTACTED', 'QUALIFIED', 'SHOWING', 'NEGOTIATION'] as const;

export function LeadForm({
  defaultClientId,
  onSuccess,
  onCancel,
  submitLabel,
  bare,
}: LeadFormProps) {
  const t = useTranslations('leads');
  const tCommon = useTranslations('common');
  const tForm = useTranslations('leadForm');
  const tIntent = useTranslations('clients.intent');
  const tStages = useTranslations('leads.stages');
  const tPriority = useTranslations('leads.priority');
  const router = useRouter();
  const search = useSearchParams();

  const [clientsList, setClientsList] = useState<ClientDetailed[]>([]);
  const [propsList, setPropsList] = useState<PropertyDetailed[]>([]);
  const [allLeads, setAllLeads] = useState<LeadDetailed[]>([]);
  const [clientId, setClientId] = useState(defaultClientId ?? search.get('clientId') ?? '');
  const [interestPropertyId, setInterest] = useState('');
  const [interestNote, setInterestNote] = useState('');
  const [interestPhotoUrl, setInterestPhotoUrl] = useState<string>('');
  const [photoUploading, setPhotoUploading] = useState(false);
  const [interestMode, setInterestMode] = useState<'crm' | 'note'>('crm');
  const [propSearch, setPropSearch] = useState('');
  const [quickCreateOpen, setQuickCreateOpen] = useState(false);
  const [quickClientOpen, setQuickClientOpen] = useState(false);
  const [dealIntent, setDealIntent] = useState<'BUY' | 'RENT'>('BUY');
  const [priority, setPriority] = useState<'hot' | 'warm' | 'cold'>('warm');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dupLead, setDupLead] = useState<LeadDetailed | null>(null);

  // Keep a ref to avoid closure stale values in the dedup check
  const allLeadsRef = useRef<LeadDetailed[]>([]);

  useEffect(() => {
    clientsApi.list({ pageSize: 100 }).then((d) => setClientsList(d.items));
    propertiesApi.list({ pageSize: 100 }).then((d) => setPropsList(d.items));
    leads.list().then((l) => {
      setAllLeads(l);
      allLeadsRef.current = l;
    });
  }, []);

  // Duplicate-lead check whenever clientId changes
  useEffect(() => {
    if (!clientId) {
      setDupLead(null);
      return;
    }
    const existing = allLeadsRef.current.find(
      (l) =>
        l.clientId === clientId &&
        (ACTIVE_STAGES as readonly string[]).includes(l.stage),
    );
    setDupLead(existing ?? null);
  }, [clientId, allLeads]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!clientId) return;
    setSaving(true);
    setError(null);
    try {
      const lead = await leads.create({
        clientId,
        dealIntent,
        interestPropertyId: interestMode === 'crm' ? (interestPropertyId || null) : null,
        interestNote:       interestMode === 'note' ? (interestNote.trim() || null) : null,
        interestPhotoUrl:   interestMode === 'note' ? (interestPhotoUrl || null) : null,
        priority,
      });
      const handled = onSuccess?.(lead);
      if (handled !== true) {
        router.push(`/leads/${lead.id}`);
      }
    } catch (err) {
      const e = err as { payload?: { message?: string } };
      setError(e.payload?.message ?? t('saveError'));
    } finally {
      setSaving(false);
    }
  }

  const fields = (
    <div className="space-y-4">
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('client')} *</Label>
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

      {/* Blacklist / archive warning */}
      {(() => {
        const c = clientsList.find((cl) => cl.id === clientId);
        if (!c) return null;
        if (c.isBlacklisted) {
          return (
            <div className="flex items-start gap-2.5 rounded-lg border border-red-300 bg-red-50 px-3.5 py-3 text-red-800 dark:border-red-700 dark:bg-red-900/20 dark:text-red-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">{tForm('blacklistedTitle')}</span>{' '}
                {tForm.rich('blacklistedHint', {
                  link: (chunks) => (
                    <a href={`/clients/${c.id}`} className="underline underline-offset-2 hover:opacity-80">{chunks}</a>
                  ),
                })}
              </div>
            </div>
          );
        }
        if (c.isArchived) {
          return (
            <div className="flex items-start gap-2.5 rounded-lg border border-slate-300 bg-slate-50 px-3.5 py-3 text-slate-800 dark:border-slate-600 dark:bg-slate-900/40 dark:text-slate-300">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div className="text-sm">
                <span className="font-medium">{tForm('archivedTitle')}</span>{' '}
                {tForm('archivedHint')}
              </div>
            </div>
          );
        }
        return null;
      })()}

      {/* Duplicate-lead warning */}
      {dupLead && (
        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3.5 py-3 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <div className="text-sm">
            <span className="font-medium">{tForm('attention')}: </span>
            {tForm('duplicatePrefix')}{' '}
            <span className="font-semibold">{tStages(dupLead.stage)}</span>
            .{' '}
            <a
              href={`/leads/${dupLead.id}`}
              className="underline underline-offset-2 hover:opacity-80"
            >
              {tForm('goToLead')} →
            </a>
          </div>
        </div>
      )}

      <div className="space-y-2">
        <Label>{tForm('dealIntent')} *</Label>
        <div className="inline-flex rounded-lg border border-border overflow-hidden">
          {(['BUY', 'RENT'] as const).map((intent) => (
            <button
              key={intent}
              type="button"
              onClick={() => {
                setDealIntent(intent);
                setInterest('');
              }}
              className={cn(
                'px-4 py-1.5 text-sm font-medium transition-colors',
                dealIntent === intent
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground',
              )}
            >
              {tIntent(intent)}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>{t('interestProperty')}</Label>
          <div className="inline-flex rounded-md border border-border overflow-hidden text-xs">
            <button
              type="button"
              onClick={() => setInterestMode('crm')}
              className={cn(
                'px-2.5 py-1 transition-colors flex items-center gap-1',
                interestMode === 'crm'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground',
              )}
            >
              <Building2 className="h-3 w-3" />
              {tForm('interestModeCrm')}
            </button>
            <button
              type="button"
              onClick={() => setInterestMode('note')}
              className={cn(
                'px-2.5 py-1 transition-colors flex items-center gap-1',
                interestMode === 'note'
                  ? 'bg-primary text-primary-foreground'
                  : 'bg-background hover:bg-muted text-muted-foreground',
              )}
            >
              <FileText className="h-3 w-3" />
              {tForm('interestModeNote')}
            </button>
          </div>
        </div>

        {interestMode === 'crm' ? (
          <PropertyCombobox
            value={interestPropertyId}
            onChange={setInterest}
            search={propSearch}
            onSearchChange={setPropSearch}
            options={propsList.filter((p) => (p.dealIntent ?? 'BUY') === dealIntent)}
            onCreateFromSearch={() => setQuickCreateOpen(true)}
          />
        ) : (
          <>
            <Textarea
              value={interestNote}
              onChange={(e) => setInterestNote(e.target.value)}
              placeholder={tForm('notePlaceholder')}
              rows={3}
              className="resize-y"
            />

            {/* Photo upload */}
            <div className="flex items-start gap-3">
              {interestPhotoUrl ? (
                <div className="relative w-24 h-24 rounded-lg overflow-hidden border border-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={interestPhotoUrl}
                    alt={tForm('photoAlt')}
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => setInterestPhotoUrl('')}
                    className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center text-xs"
                    aria-label={tForm('removePhoto')}
                  >
                    ×
                  </button>
                </div>
              ) : (
                <label className="inline-flex items-center gap-1.5 text-xs font-medium text-primary cursor-pointer hover:underline">
                  {photoUploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3 w-3" />}
                  {photoUploading ? tForm('uploading') : tForm('addPhoto')}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      setPhotoUploading(true);
                      try {
                        const { url } = await uploads.image(file);
                        setInterestPhotoUrl(url);
                      } catch {
                        toast.error(tForm('uploadError'));
                      } finally {
                        setPhotoUploading(false);
                        e.target.value = '';
                      }
                    }}
                  />
                </label>
              )}
            </div>

            <button
              type="button"
              disabled={!interestNote.trim()}
              onClick={() => setQuickCreateOpen(true)}
              className={cn(
                'mt-1 inline-flex items-center gap-1.5 text-xs font-medium transition-colors',
                interestNote.trim()
                  ? 'text-primary hover:underline'
                  : 'text-muted-foreground/50 cursor-not-allowed',
              )}
            >
              <Plus className="h-3 w-3" />
              {tForm('createCardFromNote')}
            </button>
          </>
        )}
        <p className="text-3xs text-muted-foreground">
          {interestMode === 'crm' ? tForm('hintCrm') : tForm('hintNote')}
        </p>
      </div>

      <div className="space-y-2">
        <Label>{tForm('priority')}</Label>
        <div className="flex gap-2">
          {([
            { value: 'hot',  icon: Flame,     class: 'text-red-500 border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20' },
            { value: 'warm', icon: Star,      class: 'text-amber-500 border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20' },
            { value: 'cold', icon: Snowflake, class: 'text-sky-500 border-sky-200 bg-sky-50 dark:border-sky-800 dark:bg-sky-900/20' },
          ] as const).map((opt) => {
            const Icon = opt.icon;
            const isSelected = priority === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setPriority(opt.value)}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-sm font-medium transition-all',
                  isSelected ? opt.class + ' ring-1 ring-inset ring-current' : 'border-border text-muted-foreground hover:bg-muted',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tPriority(opt.value)}
              </button>
            );
          })}
        </div>
      </div>

      {error ? <p className="text-sm text-danger">{error}</p> : null}

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel ?? (() => router.back())}>
          {tCommon('cancel')}
        </Button>
        {(() => {
          const c = clientsList.find((cl) => cl.id === clientId);
          const blocked = !!(c && (c.isBlacklisted || c.isArchived));
          return (
            <Button type="submit" disabled={saving || !clientId || blocked}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" strokeWidth={1.75} /> : null}
              {submitLabel ?? tCommon('save')}
            </Button>
          );
        })()}
      </div>
    </div>
  );

  const quickClientDialog = (
    <QuickClientDialog
      open={quickClientOpen}
      onOpenChange={setQuickClientOpen}
      onCreated={(c) => {
        setClientsList((prev) => (prev.some((x) => x.id === c.id) ? prev : [c, ...prev]));
        setClientId(c.id);
      }}
    />
  );

  const quickCreateDialog = (
    <Dialog open={quickCreateOpen} onOpenChange={setQuickCreateOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{tForm('createCrmCard')}</DialogTitle>
        </DialogHeader>
        <PropertyForm
          defaults={{
            dealIntent,
            address: interestMode === 'crm' ? propSearch : '',
            description: interestMode === 'note' ? interestNote : '',
          }}
          submitLabel={tForm('createAndSelect')}
          onSuccess={(property) => {
            // Auto-attach to the lead-form state: switch to CRM mode with the new property selected.
            setPropsList((prev) =>
              prev.some((p) => p.id === property.id) ? prev : [property, ...prev],
            );
            setInterest(property.id);
            setInterestMode('crm');
            setInterestNote('');
            setPropSearch('');
            setQuickCreateOpen(false);
            toast.success(tForm('propertyCreatedAndSelected'));
            return true; // suppress default router.push to /properties/:id
          }}
        />
      </DialogContent>
    </Dialog>
  );

  if (bare) {
    return (
      <>
        <form onSubmit={submit} className="space-y-4">
          {fields}
        </form>
        {quickClientDialog}
        {quickCreateDialog}
      </>
    );
  }

  return (
    <>
      <form onSubmit={submit} className="space-y-4 max-w-xl">
        <Card>
          <CardHeader>
            <CardTitle>{t('mainInfo')}</CardTitle>
          </CardHeader>
          <CardContent>{fields}</CardContent>
        </Card>
      </form>
      {quickClientDialog}
      {quickCreateDialog}
    </>
  );
}

// ─── PropertyCombobox ─────────────────────────────────────────────────────────
// Live-search picker over `options`. If the user types something that doesn't
// match any property, surfaces a hint to switch to the «Свій опис» mode.
function PropertyCombobox({
  value,
  onChange,
  search,
  onSearchChange,
  options,
  onCreateFromSearch,
}: {
  value: string;
  onChange: (id: string) => void;
  search: string;
  onSearchChange: (s: string) => void;
  options: PropertyDetailed[];
  onCreateFromSearch?: () => void;
}) {
  const tForm = useTranslations('leadForm');
  const [open, setOpen] = useState(false);
  const selected = value ? options.find((p) => p.id === value) : null;

  const query = search.trim().toLowerCase();
  const filtered = query
    ? options.filter(
        (p) =>
          p.address.toLowerCase().includes(query) ||
          p.district.toLowerCase().includes(query),
      )
    : options;

  return (
    <div className="relative">
      {selected ? (
        <div className="flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 h-11 sm:h-10 shadow-soft">
          <Building2 className="h-4 w-4 text-muted-foreground shrink-0" />
          <div className="min-w-0 flex-1 truncate text-sm">
            <span className="font-medium">{selected.address}</span>
            <span className="text-muted-foreground"> · {selected.district}</span>
          </div>
          <button
            type="button"
            onClick={() => {
              onChange('');
              onSearchChange('');
              setOpen(false);
            }}
            className="text-muted-foreground hover:text-foreground"
            aria-label={tForm('clearSelection')}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ) : (
        <>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
            <Input
              value={search}
              onChange={(e) => {
                onSearchChange(e.target.value);
                setOpen(true);
              }}
              onFocus={() => setOpen(true)}
              onBlur={() => setTimeout(() => setOpen(false), 150)}
              placeholder={tForm('searchPropertyPlaceholder')}
              className="pl-9"
            />
          </div>
          {open && (
            <div className="absolute z-20 mt-1 w-full rounded-xl border border-border bg-surface shadow-lift max-h-60 overflow-y-auto">
              {filtered.length === 0 ? (
                <>
                  <div className="px-3 py-2.5 text-sm text-muted-foreground">
                    {search.trim() ? tForm('nothingFoundFor', { query: search.trim() }) : tForm('nothingFound')}
                  </div>
                  {onCreateFromSearch && (
                    <button
                      type="button"
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => {
                        onCreateFromSearch();
                        setOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 border-t border-border hover:bg-muted text-sm flex items-center gap-2 text-primary font-medium"
                    >
                      <Plus className="h-3.5 w-3.5 shrink-0" />
                      <span className="truncate">
                        {tForm('createNewProperty')}
                        {search.trim() && (
                          <span className="text-muted-foreground font-normal"> {tForm('withAddress', { addr: search.trim() })}</span>
                        )}
                      </span>
                    </button>
                  )}
                </>
              ) : (
                filtered.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => {
                      onChange(p.id);
                      onSearchChange('');
                      setOpen(false);
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
        </>
      )}
    </div>
  );
}
