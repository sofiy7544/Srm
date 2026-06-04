'use client';

/**
 * Command Palette (⌘K).
 *
 * Sprint 1 scope:
 *  - Navigation actions (Go to Today, Inbox, Pipeline, Contacts, Inventory, Calendar, Insights).
 *  - Quick-create actions (New client/lead/property/showing) — opens QuickCreate slide-overs.
 *  - Hotkeys help.
 *
 * Sprint 2 will add:
 *  - Recent items (localStorage).
 *  - Live search across contacts/leads/properties via /api/search.
 */

import * as React from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {
  Home,
  Inbox,
  KanbanSquare,
  Users,
  Building2,
  Calendar,
  BarChart3,
  Plus,
  UserPlus,
  HelpCircle,
  Search,
  Settings,
  Zap,
} from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useUIStore } from '@/stores/ui-store';
import { cn } from '@/lib/utils';
import {
  clients as clientsApi,
  leads as leadsApi,
  properties as propertiesApi,
  type ClientDetailed,
  type LeadDetailed,
  type PropertyDetailed,
} from '@/lib/api';

export function CommandPalette() {
  const open = useUIStore((s) => s.paletteOpen);
  const close = useUIStore((s) => s.closePalette);
  const openQuickCreate = useUIStore((s) => s.openQuickCreate);
  const openQuickCapture = useUIStore((s) => s.openQuickCapture);
  const openHotkeysHelp = useUIStore((s) => s.openHotkeysHelp);
  const router = useRouter();
  const t = useTranslations('palette');
  const tNav = useTranslations('nav');
  const tIntent = useTranslations('clients.intent');

  // Live search state
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<{
    clients: ClientDetailed[];
    leads: LeadDetailed[];
    properties: PropertyDetailed[];
  }>({ clients: [], leads: [], properties: [] });

  // Reset on close
  React.useEffect(() => {
    if (!open) setQuery('');
  }, [open]);

  // Debounced live search (≥2 chars, 250ms)
  React.useEffect(() => {
    if (!open) return;
    const q = query.trim();
    if (q.length < 2) {
      setResults({ clients: [], leads: [], properties: [] });
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const [cp, lp, pp] = await Promise.all([
          clientsApi.list({ search: q, pageSize: 5 }).catch(() => ({ items: [] as ClientDetailed[] })),
          leadsApi.list().catch(() => [] as LeadDetailed[]),
          propertiesApi.list({ search: q, pageSize: 5 }).catch(() => ({ items: [] as PropertyDetailed[] })),
        ]);
        const ql = q.toLowerCase();
        const leadMatches = (lp as LeadDetailed[])
          .filter(
            (l) =>
              l.client.fullName.toLowerCase().includes(ql) ||
              l.client.primaryPhone.toLowerCase().includes(ql),
          )
          .slice(0, 5);
        setResults({
          clients: cp.items,
          leads: leadMatches,
          properties: pp.items,
        });
      } catch {
        /* swallow */
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [query, open]);

  const go = React.useCallback(
    (href: string) => {
      close();
      router.push(href);
    },
    [close, router],
  );

  const hasSearch = query.trim().length >= 2;
  const hasAnyResults =
    results.clients.length > 0 || results.leads.length > 0 || results.properties.length > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={(v) => (v ? null : close())}
      label={t('label')}
      className="fixed left-1/2 top-[12vh] z-50 w-[92vw] max-w-[640px] -translate-x-1/2 overflow-hidden rounded-2xl border border-border bg-surface shadow-lift outline-none data-[state=open]:animate-fade-in"
      overlayClassName="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in"
    >
      {/* Radix Dialog under cmdk's hood requires a DialogTitle for screen readers.
          We provide a visually-hidden one so the dialog is announced as "Command palette".
          (Tailwind's `sr-only` class is the standard way to hide visually but keep it
          accessible — equivalent to @radix-ui/react-visually-hidden.) */}
      <DialogPrimitive.Title className="sr-only">{t('label')}</DialogPrimitive.Title>
      <div className="flex items-center gap-2 border-b border-border/70 px-4">
        <Search className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
        <Command.Input
          value={query}
          onValueChange={setQuery}
          placeholder={t('placeholder')}
          className="flex h-12 w-full bg-transparent text-sm tracking-tightish text-foreground placeholder:text-muted-foreground outline-none"
          autoFocus
        />
        <kbd className="hidden sm:inline-flex h-6 select-none items-center rounded border border-border/70 bg-muted/40 px-1.5 font-mono text-[10px] text-muted-foreground">
          ESC
        </kbd>
      </div>

      <Command.List className="max-h-[60vh] overflow-y-auto p-2">
        <Command.Empty className="px-3 py-6 text-center text-sm text-muted-foreground">
          {t('empty')}
        </Command.Empty>

        {hasSearch && hasAnyResults && (
          <>
            {results.clients.length > 0 && (
              <Command.Group
                heading={tNav('contacts')}
                className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {results.clients.map((c) => (
                  <Command.Item
                    key={c.id}
                    value={`client-${c.id}-${c.fullName}-${c.primaryPhone}`}
                    onSelect={() => go(`/clients/${c.id}`)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      'data-[selected=true]:bg-muted',
                      'aria-selected:bg-muted',
                    )}
                  >
                    <UserPlus className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{c.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">{c.primaryPhone}</div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.leads.length > 0 && (
              <Command.Group
                heading={tNav('leads')}
                className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {results.leads.map((l) => (
                  <Command.Item
                    key={l.id}
                    value={`lead-${l.id}-${l.client.fullName}-${l.client.primaryPhone}`}
                    onSelect={() => go(`/leads/${l.id}`)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      'data-[selected=true]:bg-muted',
                      'aria-selected:bg-muted',
                    )}
                  >
                    <KanbanSquare className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{l.client.fullName}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {l.stage} · {(l.dealIntent ?? 'BUY') === 'RENT' ? tIntent('RENT') : tIntent('BUY')}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            {results.properties.length > 0 && (
              <Command.Group
                heading={tNav('inventory')}
                className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
              >
                {results.properties.map((p) => (
                  <Command.Item
                    key={p.id}
                    value={`prop-${p.id}-${p.address}-${p.district}`}
                    onSelect={() => go(`/properties/${p.id}`)}
                    className={cn(
                      'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
                      'data-[selected=true]:bg-muted',
                      'aria-selected:bg-muted',
                    )}
                  >
                    <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
                    <div className="flex-1 min-w-0">
                      <div className="truncate font-medium">{p.address}</div>
                      <div className="text-xs text-muted-foreground truncate">
                        {p.district} · {(p.dealIntent ?? 'BUY') === 'RENT' ? 'Оренда' : 'Продаж'}
                      </div>
                    </div>
                  </Command.Item>
                ))}
              </Command.Group>
            )}
          </>
        )}

        <Command.Group
          heading={t('groups.navigate')}
          className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
        >
          <Item icon={Home} label={tNav('today')} shortcut="G T" onSelect={() => go('/today')} />
          <Item icon={Inbox} label={tNav('pool')} shortcut="G I" onSelect={() => go('/pool')} />
          <Item
            icon={KanbanSquare}
            label={tNav('pipeline')}
            shortcut="G P"
            onSelect={() => go('/pipeline')}
          />
          <Item
            icon={Users}
            label={tNav('contacts')}
            shortcut="G C"
            onSelect={() => go('/contacts')}
          />
          <Item icon={Building2} label={tNav('inventory')} onSelect={() => go('/inventory')} />
          <Item icon={Calendar} label={tNav('calendar')} onSelect={() => go('/calendar')} />
          <Item icon={BarChart3} label={tNav('insights')} onSelect={() => go('/insights')} />
          <Item icon={Settings} label={tNav('settings')} onSelect={() => go('/settings')} />
        </Command.Group>

        <Command.Group
          heading={t('groups.create')}
          className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
        >
          <Item
            icon={Zap}
            label="Швидке захоплення (нічний flow)"
            shortcut="⌘⇧N"
            onSelect={() => {
              close();
              openQuickCapture();
            }}
          />
          <Item
            icon={UserPlus}
            label={t('actions.newClient')}
            shortcut="⌘N"
            onSelect={() => {
              close();
              openQuickCreate('client');
            }}
          />
          <Item
            icon={Plus}
            label={t('actions.newLead')}
            shortcut="⌘L"
            onSelect={() => {
              close();
              openQuickCreate('lead');
            }}
          />
          <Item
            icon={Plus}
            label={t('actions.newProperty')}
            shortcut="⌘O"
            onSelect={() => {
              close();
              openQuickCreate('property');
            }}
          />
          <Item
            icon={Plus}
            label={t('actions.newShowing')}
            shortcut="⌘S"
            onSelect={() => {
              close();
              openQuickCreate('showing');
            }}
          />
        </Command.Group>

        <Command.Group
          heading={t('groups.other')}
          className="text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80 [&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5"
        >
          <Item
            icon={HelpCircle}
            label={t('actions.showHotkeys')}
            shortcut="?"
            onSelect={() => {
              close();
              openHotkeysHelp();
            }}
          />
        </Command.Group>
      </Command.List>
    </Command.Dialog>
  );
}

function Item({
  icon: Icon,
  label,
  shortcut,
  onSelect,
}: {
  icon: React.ComponentType<{ className?: string; strokeWidth?: number | string }>;
  label: string;
  shortcut?: string;
  onSelect: () => void;
}) {
  return (
    <Command.Item
      onSelect={onSelect}
      className={cn(
        'flex cursor-pointer items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm tracking-tightish text-foreground/85',
        'data-[selected=true]:bg-muted data-[selected=true]:text-foreground',
        'aria-selected:bg-muted aria-selected:text-foreground',
      )}
    >
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" strokeWidth={1.75} />
      <span className="flex-1 truncate">{label}</span>
      {shortcut ? (
        <kbd className="hidden font-mono text-[10px] text-muted-foreground sm:inline-block">
          {shortcut}
        </kbd>
      ) : null}
    </Command.Item>
  );
}
