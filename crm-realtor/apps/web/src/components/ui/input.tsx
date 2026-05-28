import * as React from 'react';
import { cn } from '@/lib/utils';

export type InputProps = React.InputHTMLAttributes<HTMLInputElement>;

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn(
        // mobile: h-11 (44px touch), text-base (16px чтобы iOS не зумил при focus)
        // desktop: h-10, text-sm — дизайнерская плотность
        'flex h-11 sm:h-10 w-full rounded-xl border border-border bg-surface px-3.5 py-2 text-base sm:text-sm tracking-tightish shadow-soft transition-all placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary focus-visible:shadow-glow disabled:cursor-not-allowed disabled:opacity-50',
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = 'Input';
