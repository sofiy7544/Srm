import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-medium tracking-tightish transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98]',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-soft hover:shadow-glow hover:bg-primary/95',
        outline:
          'border border-border bg-surface text-foreground shadow-soft hover:bg-muted hover:border-primary/30',
        ghost: 'text-foreground hover:bg-muted',
        link: 'text-primary underline-offset-4 hover:underline',
        destructive: 'bg-danger text-white shadow-soft hover:bg-danger/90',
        glass: 'glass text-foreground hover:bg-white/85',
      },
      size: {
        // на mobile (< sm) высоты подняты до 44px (WCAG 2.5.5 touch target);
        // на ≥ sm разворачиваются в дизайнерские значения.
        default: 'h-11 sm:h-10 px-4 py-2',
        sm: 'h-10 sm:h-8 px-3 text-xs rounded-lg',
        lg: 'h-12 sm:h-11 px-6 text-base',
        icon: 'h-11 w-11 sm:h-10 sm:w-10',
        iconSm: 'h-10 w-10 sm:h-8 sm:w-8 rounded-lg',
      },
    },
    defaultVariants: { variant: 'default', size: 'default' },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = 'Button';
