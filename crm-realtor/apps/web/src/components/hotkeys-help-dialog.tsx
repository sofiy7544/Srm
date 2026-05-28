'use client';

import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useUIStore } from '@/stores/ui-store';

type Row = { keys: string[]; labelKey: string };

const SECTIONS: Array<{ titleKey: string; rows: Row[] }> = [
  {
    titleKey: 'general',
    rows: [
      { keys: ['⌘', 'K'], labelKey: 'palette' },
      { keys: ['Shift', '?'], labelKey: 'thisDialog' },
    ],
  },
  {
    titleKey: 'create',
    rows: [
      { keys: ['⌘', 'N'], labelKey: 'newClient' },
      { keys: ['⌘', 'L'], labelKey: 'newLead' },
      { keys: ['⌘', 'O'], labelKey: 'newProperty' },
      { keys: ['⌘', 'S'], labelKey: 'newShowing' },
    ],
  },
  {
    titleKey: 'navigate',
    rows: [
      { keys: ['G', 'T'], labelKey: 'goToday' },
      { keys: ['G', 'I'], labelKey: 'goInbox' },
      { keys: ['G', 'P'], labelKey: 'goPipeline' },
      { keys: ['G', 'C'], labelKey: 'goCalendar' },
    ],
  },
];

export function HotkeysHelpDialog() {
  const open = useUIStore((s) => s.hotkeysHelpOpen);
  const close = useUIStore((s) => s.closeHotkeysHelp);
  const t = useTranslations('hotkeysHelp');

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? null : close())}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{t('title')}</DialogTitle>
          <DialogDescription>{t('subtitle')}</DialogDescription>
        </DialogHeader>
        <div className="-mx-1 space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.titleKey}>
              <h3 className="mb-2 px-1 text-[11px] font-semibold uppercase tracking-eyebrow text-muted-foreground/80">
                {t(`sections.${section.titleKey}`)}
              </h3>
              <ul className="space-y-0.5">
                {section.rows.map((row) => (
                  <li
                    key={row.labelKey}
                    className="flex items-center justify-between rounded-lg px-2 py-1.5 text-sm tracking-tightish"
                  >
                    <span className="text-foreground/85">{t(`rows.${row.labelKey}`)}</span>
                    <span className="flex items-center gap-1">
                      {row.keys.map((k, i) => (
                        <kbd
                          key={i}
                          className="inline-flex h-6 min-w-[24px] items-center justify-center rounded border border-border/70 bg-muted/40 px-1.5 font-mono text-[11px] text-muted-foreground"
                        >
                          {k}
                        </kbd>
                      ))}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
