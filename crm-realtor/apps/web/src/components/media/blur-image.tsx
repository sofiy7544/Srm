'use client';

import { useEffect, useRef, useState } from 'react';
import { decode } from 'blurhash';
import { cn } from '@/lib/utils';

/**
 * Telegram-style progressive image: paints the blurhash placeholder instantly
 * (no network), then fades in the real image once it loads. Falls back to a
 * neutral muted background when there's no blurhash (older media).
 */
export function BlurImage({
  src,
  blurhash,
  alt = '',
  className,
  imgClassName,
  eager = false,
  draggable = false,
  onLoad,
}: {
  src: string;
  blurhash?: string | null;
  alt?: string;
  className?: string;
  imgClassName?: string;
  eager?: boolean;
  draggable?: boolean;
  onLoad?: () => void;
}) {
  const [loaded, setLoaded] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!blurhash || !canvasRef.current) return;
    try {
      const w = 32;
      const h = 32;
      const pixels = decode(blurhash, w, h);
      const ctx = canvasRef.current.getContext('2d');
      if (!ctx) return;
      const imageData = ctx.createImageData(w, h);
      imageData.data.set(pixels);
      ctx.putImageData(imageData, 0, 0);
    } catch {
      /* invalid hash — just skip the placeholder */
    }
  }, [blurhash]);

  return (
    <div className={cn('relative overflow-hidden bg-muted', className)}>
      {blurhash && !loaded && (
        <canvas
          ref={canvasRef}
          width={32}
          height={32}
          aria-hidden
          className="absolute inset-0 h-full w-full scale-105"
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        draggable={draggable}
        loading={eager ? 'eager' : 'lazy'}
        onLoad={() => {
          setLoaded(true);
          onLoad?.();
        }}
        className={cn(
          'relative h-full w-full object-cover transition-opacity duration-500 ease-out',
          loaded ? 'opacity-100' : 'opacity-0',
          imgClassName,
        )}
      />
    </div>
  );
}

/** Format a video duration (ms) as m:ss for the corner badge. */
export function formatDuration(ms?: number | null): string | null {
  if (!ms || ms <= 0) return null;
  const total = Math.round(ms / 1000);
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}
