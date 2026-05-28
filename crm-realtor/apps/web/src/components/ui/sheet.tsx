'use client';

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

export const Sheet = DialogPrimitive.Root;
export const SheetTrigger = DialogPrimitive.Trigger;
export const SheetClose = DialogPrimitive.Close;
export const SheetTitle = DialogPrimitive.Title;
export const SheetDescription = DialogPrimitive.Description;

export const SheetContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    side?: 'left' | 'right' | 'bottom';
    /**
     * Accessible title for screen readers. If the visible UI already has a
     * heading, omit `title` and add a `<SheetTitle>` inside `children` instead.
     * If neither is provided, Radix logs an a11y warning.
     */
    title?: string;
  }
>(({ className, children, side = 'left', title, ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:opacity-0 transition-opacity" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed z-50 bg-surface shadow-lift outline-none transition-transform',
        // mobile: 90vw (запас для backdrop tap-to-close), desktop фиксированный
        side === 'left' &&
          'left-0 top-0 h-full w-[90vw] max-w-[320px] sm:w-[280px] data-[state=open]:translate-x-0 data-[state=closed]:-translate-x-full',
        side === 'right' &&
          'right-0 top-0 h-full overflow-hidden flex flex-col data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full',
        side === 'bottom' &&
          'inset-x-0 bottom-0 max-h-[90vh] rounded-t-2xl pb-[env(safe-area-inset-bottom,0px)] data-[state=open]:translate-y-0 data-[state=closed]:translate-y-full',
        className,
      )}
      {...props}
    >
      {/* Accessible title — visible-only to screen readers when no header exists.
          Without this Radix logs a warning per WAI-ARIA Dialog spec. */}
      {title && (
        <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
      )}
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SheetContent.displayName = 'SheetContent';

export const SheetCloseIcon = ({ className }: { className?: string }) => (
  <SheetClose
    className={cn(
      'absolute right-3 top-3 h-8 w-8 rounded-lg hover:bg-muted flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors',
      className,
    )}
  >
    <X className="h-4 w-4" />
  </SheetClose>
);
