'use client';

/**
 * SlideOver — right-side overlay panel for detail views, quick-create, bulk edit.
 * Built on @radix-ui/react-dialog (a11y, focus trap, ESC, click-outside).
 *
 * Usage:
 *   <SlideOver open={open} onOpenChange={setOpen}>
 *     <SlideOverHeader title="New client" onClose={() => setOpen(false)} />
 *     <SlideOverBody>...form fields...</SlideOverBody>
 *     <SlideOverFooter>
 *       <Button onClick={...}>Save</Button>
 *     </SlideOverFooter>
 *   </SlideOver>
 *
 * Width: 560px default (good for forms + a list column). Pass `width="lg"` for
 * 720px when you need 2-column content inside.
 */

import * as React from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';

const WIDTH_MAP = {
  sm: 'sm:w-[420px]',
  md: 'sm:w-[560px]',
  lg: 'sm:w-[720px]',
  xl: 'sm:w-[880px]',
} as const;

type Width = keyof typeof WIDTH_MAP;

export const SlideOver = DialogPrimitive.Root;
export const SlideOverTrigger = DialogPrimitive.Trigger;
export const SlideOverClose = DialogPrimitive.Close;

export const SlideOverContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    width?: Width;
  }
>(({ className, children, width = 'md', ...props }, ref) => (
  <DialogPrimitive.Portal>
    <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-fade-in data-[state=closed]:opacity-0 transition-opacity" />
    <DialogPrimitive.Content
      ref={ref}
      className={cn(
        'fixed right-0 top-0 z-50 flex h-full w-[92vw] max-w-full flex-col bg-surface shadow-lift outline-none transition-transform duration-200',
        'data-[state=open]:translate-x-0 data-[state=closed]:translate-x-full',
        WIDTH_MAP[width],
        className,
      )}
      {...props}
    >
      {children}
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
));
SlideOverContent.displayName = 'SlideOverContent';

export function SlideOverHeader({
  title,
  description,
  onClose,
  onExpand,
  className,
  children,
}: {
  title?: React.ReactNode;
  description?: React.ReactNode;
  onClose?: () => void;
  onExpand?: () => void;
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <header
      className={cn(
        'flex items-start justify-between gap-3 border-b border-border/60 px-5 py-4',
        className,
      )}
    >
      <div className="min-w-0 flex-1">
        {title ? (
          <DialogPrimitive.Title className="text-base font-semibold leading-tight tracking-tight2 text-foreground">
            {title}
          </DialogPrimitive.Title>
        ) : null}
        {description ? (
          <DialogPrimitive.Description className="mt-0.5 text-xs text-muted-foreground tracking-tightish">
            {description}
          </DialogPrimitive.Description>
        ) : null}
        {children}
      </div>
      <div className="flex shrink-0 items-center gap-1">
        {onExpand ? (
          <button
            type="button"
            onClick={onExpand}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            aria-label="Expand to full page"
          >
            <Maximize2 className="h-4 w-4" strokeWidth={1.75} />
          </button>
        ) : null}
        <SlideOverClose
          onClick={onClose}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          aria-label="Close"
        >
          <X className="h-4 w-4" strokeWidth={1.75} />
        </SlideOverClose>
      </div>
    </header>
  );
}

export function SlideOverBody({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return <div className={cn('flex-1 overflow-y-auto px-5 py-4', className)}>{children}</div>;
}

export function SlideOverFooter({
  className,
  children,
}: {
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <footer
      className={cn(
        'flex items-center justify-end gap-2 border-t border-border/60 px-5 py-3',
        className,
      )}
    >
      {children}
    </footer>
  );
}
