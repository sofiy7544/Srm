'use client';

/**
 * ConfirmDialog — Radix-based replacement for window.confirm().
 *
 * Usage pattern A (declarative — recommended for delete buttons):
 *
 *   const [confirmingId, setConfirmingId] = useState<string | null>(null);
 *
 *   <Button onClick={() => setConfirmingId(item.id)}>Delete</Button>
 *
 *   <ConfirmDialog
 *     open={confirmingId !== null}
 *     onCancel={() => setConfirmingId(null)}
 *     onConfirm={async () => {
 *       await api.remove(confirmingId!);
 *       toast.success('Deleted');
 *       setConfirmingId(null);
 *     }}
 *     title={t('confirmDelete')}
 *     destructive
 *   />
 *
 * Usage pattern B (imperative — for when the action is triggered from many
 * places and you don't want to thread state through):
 *
 *   const confirm = useConfirm();
 *   ...
 *   async function handleDelete() {
 *     const ok = await confirm({
 *       title: t('confirmDelete'),
 *       destructive: true,
 *     });
 *     if (!ok) return;
 *     await api.remove(id);
 *   }
 *
 *   // mount once at app root
 *   <ConfirmDialogHost />
 */

import * as React from 'react';
import { useTranslations } from 'next-intl';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export type ConfirmDialogProps = {
  open: boolean;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
  title: React.ReactNode;
  description?: React.ReactNode;
  confirmLabel?: React.ReactNode;
  cancelLabel?: React.ReactNode;
  destructive?: boolean;
  /** Optional busy state — if true, the confirm button shows a spinner. */
  busy?: boolean;
};

export function ConfirmDialog({
  open,
  onCancel,
  onConfirm,
  title,
  description,
  confirmLabel,
  cancelLabel,
  destructive,
  busy: externalBusy,
}: ConfirmDialogProps) {
  const tCommon = useTranslations('common');
  const [internalBusy, setInternalBusy] = React.useState(false);
  const busy = externalBusy ?? internalBusy;

  async function handleConfirm() {
    if (busy) return;
    setInternalBusy(true);
    try {
      await onConfirm();
    } finally {
      setInternalBusy(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        if (!v && !busy) onCancel();
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description ? <DialogDescription>{description}</DialogDescription> : null}
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={onCancel} disabled={busy}>
            {cancelLabel ?? tCommon('cancel')}
          </Button>
          <Button
            variant={destructive ? 'destructive' : 'default'}
            onClick={handleConfirm}
            disabled={busy}
          >
            {busy ? tCommon('loading') : confirmLabel ?? tCommon('delete')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Imperative useConfirm() — backed by a zustand store + a single host mount.
// ────────────────────────────────────────────────────────────────────────────

import { create } from 'zustand';

type PendingConfirm = Omit<ConfirmDialogProps, 'open' | 'onCancel' | 'onConfirm'> & {
  resolve: (ok: boolean) => void;
};

type ConfirmStore = {
  pending: PendingConfirm | null;
  request: (opts: Omit<PendingConfirm, 'resolve'>) => Promise<boolean>;
  resolve: (ok: boolean) => void;
};

const useConfirmStore = create<ConfirmStore>((set, get) => ({
  pending: null,
  request: (opts) =>
    new Promise<boolean>((resolve) => {
      // If a confirm is already in flight, reject the new one with `false`
      // rather than queuing — modal stacking is a UX foot-gun.
      if (get().pending) {
        resolve(false);
        return;
      }
      set({ pending: { ...opts, resolve } });
    }),
  resolve: (ok) => {
    const pending = get().pending;
    if (!pending) return;
    pending.resolve(ok);
    set({ pending: null });
  },
}));

/**
 * useConfirm — returns an async function that resolves to true (confirmed) or
 * false (cancelled/dismissed). Requires <ConfirmDialogHost /> mounted once at
 * the app shell.
 */
export function useConfirm() {
  return useConfirmStore((s) => s.request);
}

/** Mount once in (app)/layout.tsx. */
export function ConfirmDialogHost() {
  const pending = useConfirmStore((s) => s.pending);
  const resolve = useConfirmStore((s) => s.resolve);

  return (
    <ConfirmDialog
      open={pending !== null}
      onCancel={() => resolve(false)}
      onConfirm={() => resolve(true)}
      title={pending?.title ?? ''}
      description={pending?.description}
      confirmLabel={pending?.confirmLabel}
      cancelLabel={pending?.cancelLabel}
      destructive={pending?.destructive}
    />
  );
}
