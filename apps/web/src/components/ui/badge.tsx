import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tightish transition-colors',
  {
    variants: {
      variant: {
        default: 'border-transparent bg-primary/10 text-primary-700',
        secondary: 'border-transparent bg-muted text-foreground/80',
        outline: 'border-border text-foreground/80 bg-surface',
        success: 'border-transparent bg-emerald-50 text-emerald-700 ring-1 ring-emerald-100',
        warning: 'border-transparent bg-amber-50 text-amber-700 ring-1 ring-amber-100',
        destructive: 'border-transparent bg-red-50 text-red-700 ring-1 ring-red-100',
        accent: 'border-transparent bg-violet-50 text-violet-700 ring-1 ring-violet-100',
        dot: 'border-transparent bg-transparent px-1.5',
      },
    },
    defaultVariants: { variant: 'default' },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
