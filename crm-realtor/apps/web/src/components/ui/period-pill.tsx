import { cn } from '@/lib/utils';

export interface PeriodPillProps {
  label: string;
  active: boolean;
  onClick: () => void;
  tone?: 'default' | 'danger';
}

export function PeriodPill({ label, active, onClick, tone = 'default' }: PeriodPillProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'rounded-lg px-3 py-1.5 text-xs font-medium tracking-tightish transition-all whitespace-nowrap',
        active
          ? tone === 'danger'
            ? 'bg-danger text-white shadow-glow'
            : 'bg-primary text-primary-foreground shadow-glow'
          : 'text-foreground/70 hover:bg-muted hover:text-foreground',
      )}
    >
      {label}
    </button>
  );
}
