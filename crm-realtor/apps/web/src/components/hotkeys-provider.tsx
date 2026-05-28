'use client';

/**
 * HotkeysProvider — mounts global keyboard shortcuts.
 * Mount once inside (app)/layout.tsx.
 *
 * Conventions:
 *   ⌘K / Ctrl+K     → Command Palette
 *   ⌘N / Ctrl+N     → New client
 *   ⌘L / Ctrl+L     → New lead
 *   ⌘O / Ctrl+O     → New property
 *   ⌘S / Ctrl+S     → New showing
 *   G then T/I/P/C  → Go to Today / Inbox / Pipeline / Calendar (Gmail-style)
 *   Shift + ?       → Show hotkeys help
 *
 * react-hotkeys-hook handles input-field suppression by default (no firing
 * when the user is typing in <input>, <textarea>, contentEditable).
 */

import { useRouter } from 'next/navigation';
import { useHotkeys } from 'react-hotkeys-hook';
import { useUIStore } from '@/stores/ui-store';

export function HotkeysProvider() {
  const router = useRouter();
  const togglePalette = useUIStore((s) => s.togglePalette);
  const openQuickCreate = useUIStore((s) => s.openQuickCreate);
  const openQuickCapture = useUIStore((s) => s.openQuickCapture);
  const openHotkeysHelp = useUIStore((s) => s.openHotkeysHelp);

  // Command palette
  useHotkeys(
    'meta+k, ctrl+k',
    (e) => {
      e.preventDefault();
      togglePalette();
    },
    { enableOnFormTags: true, preventDefault: true },
    [togglePalette],
  );

  // Quick capture — нічний flow для риелтора. Один сабмит = повний лід зі сцени.
  useHotkeys(
    'meta+shift+n, ctrl+shift+n',
    (e) => {
      e.preventDefault();
      openQuickCapture();
    },
    { enableOnFormTags: true, preventDefault: true },
    [openQuickCapture],
  );

  // Quick-create. ⌘N/⌘L/⌘O/⌘S all preventDefault so we don't open a browser
  // window/bookmark page/save dialog.
  useHotkeys(
    'meta+n, ctrl+n',
    (e) => {
      e.preventDefault();
      openQuickCreate('client');
    },
    { preventDefault: true },
    [openQuickCreate],
  );
  useHotkeys(
    'meta+l, ctrl+l',
    (e) => {
      e.preventDefault();
      openQuickCreate('lead');
    },
    { preventDefault: true },
    [openQuickCreate],
  );
  useHotkeys(
    'meta+o, ctrl+o',
    (e) => {
      e.preventDefault();
      openQuickCreate('property');
    },
    { preventDefault: true },
    [openQuickCreate],
  );
  useHotkeys(
    'meta+s, ctrl+s',
    (e) => {
      e.preventDefault();
      openQuickCreate('showing');
    },
    { preventDefault: true },
    [openQuickCreate],
  );

  // Go-to navigation. react-hotkeys-hook supports key sequences via comma-less
  // notation like 'g>t' for "press G, then T".
  useHotkeys('g>t', () => router.push('/today'), [router]);
  useHotkeys('g>i', () => router.push('/inbox'), [router]);
  useHotkeys('g>p', () => router.push('/pipeline'), [router]);
  useHotkeys('g>c', () => router.push('/calendar'), [router]);

  // Hotkeys help
  useHotkeys(
    'shift+/',
    (e) => {
      e.preventDefault();
      openHotkeysHelp();
    },
    [openHotkeysHelp],
  );

  return null;
}
