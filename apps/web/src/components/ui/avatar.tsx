import * as React from 'react';
import { cn } from '@/lib/utils';

const COLORS = [
  'from-blue-400 to-blue-600',
  'from-violet-400 to-violet-600',
  'from-emerald-400 to-emerald-600',
  'from-amber-400 to-amber-600',
  'from-rose-400 to-rose-600',
  'from-cyan-400 to-cyan-600',
  'from-indigo-400 to-indigo-600',
  'from-fuchsia-400 to-fuchsia-600',
];

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return '?';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[1][0]).toUpperCase();
}

function pickColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return COLORS[hash % COLORS.length];
}

export interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  name: string;
  size?: 'xs' | 'sm' | 'md' | 'lg';
  src?: string | null;
  /** Alias for src — accepts avatarUrl from API responses directly */
  avatarUrl?: string | null;
}

export function Avatar({ name, size = 'md', src, avatarUrl, className, ...props }: AvatarProps) {
  const resolvedSrc = src ?? avatarUrl;
  const [imgFailed, setImgFailed] = React.useState(false);
  React.useEffect(() => {
    setImgFailed(false);
  }, [resolvedSrc]);
  const showImage = resolvedSrc && !imgFailed;
  const sizeClass = {
    xs: 'h-6 w-6 text-3xs',
    sm: 'h-8 w-8 text-xs',
    md: 'h-10 w-10 text-sm',
    lg: 'h-12 w-12 text-base',
  }[size];
  return (
    <div
      className={cn(
        'rounded-full bg-gradient-to-br flex items-center justify-center font-semibold text-white shrink-0 ring-2 ring-surface shadow-soft overflow-hidden',
        !showImage && pickColor(name || '?'),
        sizeClass,
        className,
      )}
      {...props}
    >
      {showImage ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={resolvedSrc!}
          alt={name}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setImgFailed(true)}
          className="h-full w-full object-cover"
        />
      ) : (
        initials(name || '?')
      )}
    </div>
  );
}
