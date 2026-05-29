'use client';

/**
 * Lightweight Zustand store for global UI overlays that need to be opened
 * from anywhere — Command Palette, Quick Create panels, Hotkeys Help.
 *
 * Keep this store small. Domain state (clients, leads, etc.) belongs in
 * TanStack Query, not here.
 */

import { create } from 'zustand';

export type QuickCreateKind = 'client' | 'lead' | 'property' | 'showing';

type UIState = {
  paletteOpen: boolean;
  hotkeysHelpOpen: boolean;
  quickCreate: QuickCreateKind | null;
  quickCaptureOpen: boolean;

  openPalette: () => void;
  closePalette: () => void;
  togglePalette: () => void;

  openHotkeysHelp: () => void;
  closeHotkeysHelp: () => void;

  openQuickCreate: (kind: QuickCreateKind) => void;
  closeQuickCreate: () => void;

  openQuickCapture: () => void;
  closeQuickCapture: () => void;
};

export const useUIStore = create<UIState>((set) => ({
  paletteOpen: false,
  hotkeysHelpOpen: false,
  quickCreate: null,
  quickCaptureOpen: false,

  openPalette: () => set({ paletteOpen: true }),
  closePalette: () => set({ paletteOpen: false }),
  togglePalette: () => set((s) => ({ paletteOpen: !s.paletteOpen })),

  openHotkeysHelp: () => set({ hotkeysHelpOpen: true }),
  closeHotkeysHelp: () => set({ hotkeysHelpOpen: false }),

  openQuickCreate: (kind) => set({ quickCreate: kind }),
  closeQuickCreate: () => set({ quickCreate: null }),

  openQuickCapture: () => set({ quickCaptureOpen: true }),
  closeQuickCapture: () => set({ quickCaptureOpen: false }),
}));
