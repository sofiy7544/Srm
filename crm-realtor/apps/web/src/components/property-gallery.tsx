'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Building2, Star, Play } from 'lucide-react';
import type { PropertyPhoto } from '@/lib/api';
import { cn } from '@/lib/utils';

function MediaThumb({ item, className }: { item: PropertyPhoto; className?: string }) {
  if (item.kind === 'VIDEO') {
    return (
      <div className={cn('relative w-full h-full', className)}>
        <video
          src={item.url}
          className="w-full h-full object-cover"
          muted
          playsInline
          preload="metadata"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <span className="h-10 w-10 rounded-full bg-black/55 text-white flex items-center justify-center shadow-lift">
            <Play className="h-5 w-5 fill-current" />
          </span>
        </div>
      </div>
    );
  }
  return (
    /* eslint-disable-next-line @next/next/no-img-element */
    <img
      src={item.url}
      alt=""
      loading="lazy"
      className={cn(
        'w-full h-full object-cover transition-transform duration-300 group-hover:scale-105',
        className,
      )}
    />
  );
}

export function PropertyGallery({ photos }: { photos: PropertyPhoto[] }) {
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  if (photos.length === 0) {
    return (
      <div className="aspect-[16/9] rounded-2xl bg-gradient-to-br from-muted to-muted/40 flex items-center justify-center">
        <Building2 className="h-12 w-12 text-muted-foreground/40" />
      </div>
    );
  }

  const cover = photos.find((p) => p.isCover) ?? photos[0];
  const rest = photos.filter((p) => p.id !== cover.id).slice(0, 4);

  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 rounded-2xl overflow-hidden h-[360px]">
        <button
          type="button"
          onClick={() => setLightboxIdx(photos.indexOf(cover))}
          className="relative sm:col-span-3 group overflow-hidden bg-muted"
        >
          <MediaThumb item={cover} />
          {cover.isCover && (
            <span className="absolute top-3 left-3 bg-white/95 text-amber-700 rounded-full px-2.5 py-1 text-3xs font-medium flex items-center gap-1 shadow-soft">
              <Star className="h-3 w-3 fill-current" /> Cover
            </span>
          )}
        </button>
        <div className="hidden sm:grid grid-cols-1 grid-rows-2 gap-2">
          {[0, 1].map((i) => {
            const p = rest[i];
            if (!p) return <div key={i} className="bg-gradient-to-br from-muted to-muted/40" />;
            const showMore = i === 1 && photos.length > 3;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setLightboxIdx(photos.indexOf(p))}
                className="relative group overflow-hidden bg-muted"
              >
                <MediaThumb item={p} />
                {showMore && (
                  <div className="absolute inset-0 bg-black/55 text-white flex items-center justify-center font-semibold text-lg">
                    +{photos.length - 3}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Thumbnails strip for mobile */}
      {photos.length > 1 && (
        <div className="sm:hidden flex gap-2 overflow-x-auto pb-1">
          {photos.map((p, i) => (
            <button
              key={p.id}
              type="button"
              onClick={() => setLightboxIdx(i)}
              className="shrink-0 h-16 w-24 rounded-lg overflow-hidden bg-muted relative"
            >
              <MediaThumb item={p} />
            </button>
          ))}
        </div>
      )}

      {/* Lightbox */}
      {lightboxIdx !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center animate-fade-in"
          onClick={() => setLightboxIdx(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightboxIdx(null);
            }}
            className="absolute top-4 right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
          {lightboxIdx > 0 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx(lightboxIdx - 1);
              }}
              className="absolute left-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronLeft className="h-5 w-5" />
            </button>
          )}
          {lightboxIdx < photos.length - 1 && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setLightboxIdx(lightboxIdx + 1);
              }}
              className="absolute right-4 h-10 w-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20 transition-colors"
            >
              <ChevronRight className="h-5 w-5" />
            </button>
          )}
          {photos[lightboxIdx].kind === 'VIDEO' ? (
            <video
              src={photos[lightboxIdx].url}
              autoPlay
              controls
              playsInline
              className="max-h-[90vh] max-w-[90vw] rounded-lg shadow-lift animate-scale-in"
              onClick={(e) => e.stopPropagation()}
            />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={photos[lightboxIdx].url}
              alt=""
              className={cn(
                'max-h-[90vh] max-w-[90vw] object-contain rounded-lg shadow-lift animate-scale-in',
              )}
              onClick={(e) => e.stopPropagation()}
            />
          )}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/70 text-sm">
            {lightboxIdx + 1} / {photos.length}
          </div>
        </div>
      )}
    </>
  );
}
