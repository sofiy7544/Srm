'use client';

import { useState } from 'react';
import { Building2, Star, Play } from 'lucide-react';
import type { PropertyPhoto } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BlurImage, formatDuration } from './media/blur-image';
import { MediaLightbox } from './media/media-lightbox';

/** Best display source for a grid tile: thumbnail → poster → original. */
function thumbSrc(item: PropertyPhoto): string {
  if (item.kind === 'VIDEO') return item.posterUrl || item.thumbnailUrl || item.url;
  return item.thumbnailUrl || item.url;
}

function MediaThumb({ item, className }: { item: PropertyPhoto; className?: string }) {
  const hasPreview = item.kind === 'PHOTO' || !!item.posterUrl || !!item.thumbnailUrl;
  return (
    <div className={cn('relative h-full w-full', className)}>
      {hasPreview ? (
        <BlurImage
          src={thumbSrc(item)}
          blurhash={item.blurhash}
          imgClassName="transition-transform duration-300 group-hover:scale-105"
          className="h-full w-full"
        />
      ) : (
        // Legacy video with no generated poster — fall back to first-frame hack.
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video
          src={`${item.url}#t=0.1`}
          className="h-full w-full bg-black object-cover"
          muted
          playsInline
          preload="metadata"
        />
      )}
      {item.kind === 'VIDEO' && (
        <>
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-black/55 text-white shadow-lift backdrop-blur-sm">
              <Play className="h-5 w-5 fill-current" />
            </span>
          </div>
          {formatDuration(item.durationMs) && (
            <span className="absolute bottom-1.5 right-1.5 rounded bg-black/65 px-1.5 py-0.5 text-3xs font-medium tabular-nums text-white">
              {formatDuration(item.durationMs)}
            </span>
          )}
        </>
      )}
    </div>
  );
}

export function PropertyGallery({ photos }: { photos: PropertyPhoto[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="flex aspect-[16/9] items-center justify-center rounded-2xl bg-gradient-to-br from-muted to-muted/40">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
      </div>
    );
  }

  const cover = photos.find((p) => p.isCover) ?? photos[0];
  const rest = photos.filter((p) => p.id !== cover.id).slice(0, 4);

  return (
    <>
      <div className="grid h-[360px] grid-cols-1 gap-2 overflow-hidden rounded-2xl sm:grid-cols-4">
        <button
          type="button"
          onClick={() => setLightboxIdx(photos.indexOf(cover))}
          className="group relative overflow-hidden bg-muted sm:col-span-3"
        >
          <MediaThumb item={cover} />
          {cover.isCover && (
            <span className="absolute left-3 top-3 flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 text-3xs font-medium text-amber-700 shadow-soft">
              <Star className="h-3 w-3 fill-current" /> Cover
            </span>
          )}
        </button>
        <div className="hidden grid-cols-1 grid-rows-2 gap-2 sm:grid">
          {[0, 1].map((i) => {
            const p = rest[i];
            if (!p) return <div key={i} className="bg-gradient-to-br from-muted to-muted/40" />;
            const showMore = i === 1 && photos.length > 3;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightboxIdx(photos.indexOf(p))}
                className="group relative overflow-hidden bg-muted"
              >
                <MediaThumb item={p} />
                {showMore && (
                  <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-lg font-semibold text-white">
                    +{photos.length - 3}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Mobile thumbnail strip */}
      {photos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 sm:hidden">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-muted"
            >
              <MediaThumb item={p} />
            </button>
          ))}
        </div>
      )}

      <MediaLightbox
        items={photos}
        index={lightboxIdx}
        onIndexChange={setLightboxIdx}
        onClose={() => setLightboxIdx(null)}
      />
    </>
  );
}
