'use client';

/**
 * Themed Sonner Toaster — mounted once at the app shell.
 *
 * Use `import { toast } from 'sonner'` anywhere to fire toasts.
 * For Undo: toast.success('Lead moved', { action: { label: 'Undo', onClick: ... } }).
 */

import { Toaster as SonnerToaster } from 'sonner';
import { useTheme } from '@/components/theme-provider';

export function Toaster() {
  // Map the repo's 4 resolved themes onto Sonner's 3 (sepia → light, midnight → dark).
  const resolved = useTheme().resolvedTheme;
  const sonnerTheme: 'light' | 'dark' =
    resolved === 'dark' || resolved === 'midnight' ? 'dark' : 'light';
  return (
    <SonnerToaster
      theme={sonnerTheme}
      position="bottom-right"
      richColors
      closeButton
      toastOptions={{
        className:
          'rounded-xl border border-border shadow-lift bg-surface text-foreground text-sm tracking-tightish',
        descriptionClassName: 'text-xs text-muted-foreground',
      }}
    />
  );
}
