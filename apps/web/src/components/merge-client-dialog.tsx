'use client';

import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Loader2, GitMerge, Search, AlertTriangle } from 'lucide-react';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { clients as clientsApi, type ClientDetailed } from '@/lib/api';
import { useConfirm } from '@/components/ui/confirm-dialog';
import { toast } from 'sonner';

/**
 * Merge two contacts. The CURRENT page (winner) is the survivor.
 * The user picks the duplicate (loser) from a searchable list — all its
 * leads, deals, activities, tasks, messages move to the winner, then the
 * loser record is deleted.
 *
 * Destructive: requires explicit confirm-dialog. Backend writes AuditLog.
 */
export function MergeClientDialog({
  open,
  onOpenChange,
  winner,
  onMerged,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  winner: ClientDetailed;
  onMerged: (merged: ClientDetailed) => void;
}) {
  const t = useTranslations('mergeClient');
  const tCommon = useTranslations('common');
  const confirm = useConfirm();
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<ClientDetailed[]>([]);
  const [loading, setLoading] = useState(false);
  const [picked, setPicked] = useState<ClientDetailed | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    clientsApi
      .list({ pageSize: 200 })
      .then((d) => setCandidates(d.items.filter((c) => c.id !== winner.id)))
      .finally(() => setLoading(false));
  }, [open, winner.id]);

  const filtered = (() => {
    const q = search.trim().toLowerCase();
    if (!q) return candidates.slice(0, 20);
    return candidates
      .filter(
        (c) =>
          c.fullName.toLowerCase().includes(q) ||
          c.primaryPhone.toLowerCase().includes(q) ||
          (c.email ?? '').toLowerCase().includes(q),
      )
      .slice(0, 30);
  })();

  async function handleMerge() {
    if (!picked) return;
    const ok = await confirm({
      title: t('confirmTitle', { name: picked.fullName }),
      description: t('confirmDescription', { loser: picked.fullName, winner: winner.fullName }),
      destructive: true,
      confirmLabel: t('confirmYes'),
    });
    if (!ok) return;
    setBusy(true);
    try {
      const merged = await clientsApi.merge(winner.id, picked.id);
      toast.success(t('mergedToast', { loser: picked.fullName, winner: winner.fullName }));
      onMerged(merged);
      onOpenChange(false);
    } catch (e) {
      const err = e as { payload?: { message?: string } };
      toast.error(err.payload?.message ?? t('mergeError'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <GitMerge className="h-4 w-4 text-primary" />
            {t('title')}
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2.5 text-amber-800 dark:border-amber-700 dark:bg-amber-900/20 dark:text-amber-300 text-xs">
          <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          <div>
            {t('winnerHint', { name: winner.fullName })}
          </div>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground pointer-events-none" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('searchPlaceholder')}
            className="pl-9"
            autoFocus
          />
        </div>

        <div className="flex-1 overflow-y-auto -mx-2 px-2">
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">{t('nothingFound')}</p>
          ) : (
            <div className="space-y-1">
              {filtered.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setPicked(c)}
                  className={
                    'w-full text-left px-3 py-2 rounded-lg border transition-colors ' +
                    (picked?.id === c.id
                      ? 'border-primary bg-primary/5'
                      : 'border-border hover:bg-muted')
                  }
                >
                  <div className="font-medium text-sm">{c.fullName}</div>
                  <div className="text-xs text-muted-foreground">
                    {c.primaryPhone}
                    {c.email && ` · ${c.email}`}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {tCommon('cancel')}
          </Button>
          <Button onClick={handleMerge} disabled={!picked || busy}>
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {t('mergeButton')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
