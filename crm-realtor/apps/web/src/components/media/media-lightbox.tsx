'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion, type PanInfo } from 'framer-motion';
import { TransformWrapper, TransformComponent } from 'react-zoom-pan-pinch';
import { ChevronLeft, ChevronRight, X, Download } from 'lucide-react';
import type { PropertyPhoto } from '@/lib/api';
import { BlurImage } from './blur-image';

const SWIPE_X = 80; // px to trigger prev/next
const DISMISS_Y = 140; // px (downward) to close

/** Source used for preloading / ambient backdrop (full for photos, poster for video). */
function previewSrc(item: PropertyPhoto): string | undefined {
  return item.kind === 'VIDEO' ? item.posterUrl || item.thumbnailUrl || undefined : item.url;
}

/**
 * Full-screen messenger-grade media viewer. Photos AND videos live in one swipe
 * sequence and you can flip through with ALL of:
 *  - mobile: swipe left/right (swipe down to dismiss)
 *  - desktop: on-screen arrow buttons + keyboard ← / → (Esc closes)
 * Navigation wraps around (last → first) consistently across every input.
 * Photos support pinch / double-tap / wheel zoom; the next/prev image is
 * preloaded so flipping feels instant.
 * Controlled: parent owns `index` (null = closed).
 */
export function MediaLightbox({
  items,
  index,
  onIndexChange,
  onClose,
}: {
  items: PropertyPhoto[];
  index: number | null;
  onIndexChange: (i: number) => void;
  onClose: () => void;
}) {
  const [direction, setDirection] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const n = items.length;
  const open = index !== null;
  const current = open ? items[index] : null;

  // Ref keeps the latest index available to the once-bound keyboard handler.
  const indexRef = useRef(index);
  indexRef.current = index;

  // Move by ±1 with wrap-around. Stable identity (depends only on n + setter).
  const paginate = useCallback(
    (dir: number) => {
      if (n <= 1) return;
      const from = indexRef.current ?? 0;
      setDirection(dir);
      setZoomed(false);
      onIndexChange((((from + dir) % n) + n) % n);
    },
    [n, onIndexChange],
  );

  // Keyboard: bound once per open (paginate/onClose are stable enough).
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight') paginate(1);
      else if (e.key === 'ArrowLeft') paginate(-1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, paginate, onClose]);

  // Lock body scroll while open.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  // Preload neighbours so flipping is instant.
  useEffect(() => {
    if (!open || n <= 1) return;
    for (const d of [1, -1]) {
      const neighbour = items[((((index ?? 0) + d) % n) + n) % n];
      const src = neighbour && previewSrc(neighbour);
      if (src) {
        const img = new Image();
        img.src = src;
      }
    }
  }, [open, index, items, n]);

  function onDragEnd(_e: unknown, info: PanInfo) {
    if (zoomed) return;
    const { offset, velocity } = info;
    // Mostly-vertical downward swipe dismisses.
    if (offset.y > DISMISS_Y && offset.y > Math.abs(offset.x)) {
      onClose();
      return;
    }
    if (offset.x < -SWIPE_X || velocity.x < -500) paginate(1);
    else if (offset.x > SWIPE_X || velocity.x > 500) paginate(-1);
  }

  const variants = {
    enter: (dir: number) => ({ x: dir > 0 ? 320 : -320, opacity: 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? -320 : 320, opacity: 0 }),
  };

  return (
    <AnimatePresence>
      {open && current && (
        <motion.div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-black/90"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
        >
          {/* Ambient blurred backdrop from the current item */}
          {current.blurhash && (
            <div className="pointer-events-none absolute inset-0 opacity-30">
              <BlurImage
                src={previewSrc(current) || current.url}
                blurhash={current.blurhash}
                className="h-full w-full"
                imgClassName="opacity-0"
              />
            </div>
          )}

          {/* Top toolbar with counter */}
          <div
            className="absolute left-0 right-0 top-0 z-20 flex items-center justify-between p-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <span className="rounded-full bg-white/10 px-3 py-1 text-sm tabular-nums">
              {(index ?? 0) + 1} / {n}
            </span>
            <div className="flex items-center gap-2">
              <a
                href={current.url}
                download
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                aria-label="Download"
              >
                <Download className="h-5 w-5" />
              </a>
              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10 transition-colors hover:bg-white/20"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
          </div>

          {/* Prev / next — always available (wrap-around) when there's more than one item */}
          {n > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  paginate(-1);
                }}
                className="absolute left-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:left-4"
                aria-label="Previous"
              >
                <ChevronLeft className="h-6 w-6" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  paginate(1);
                }}
                className="absolute right-2 top-1/2 z-20 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-colors hover:bg-white/20 sm:right-4"
                aria-label="Next"
              >
                <ChevronRight className="h-6 w-6" />
              </button>
            </>
          )}

          {/* Slide */}
          <AnimatePresence custom={direction} mode="popLayout" initial={false}>
            <motion.div
              key={current.id}
              custom={direction}
              variants={variants}
              initial="enter"
              animate="center"
              exit="exit"
              transition={{ x: { type: 'spring', stiffness: 300, damping: 30 }, opacity: { duration: 0.15 } }}
              drag={zoomed ? false : true}
              dragElastic={0.6}
              dragConstraints={{ left: 0, right: 0, top: 0, bottom: 0 }}
              onDragEnd={onDragEnd}
              onClick={(e) => e.stopPropagation()}
              className="flex h-full w-full items-center justify-center px-12 sm:px-20"
            >
              {current.kind === 'VIDEO' ? (
                // eslint-disable-next-line jsx-a11y/media-has-caption
                <video
                  src={current.url}
                  poster={current.posterUrl ?? undefined}
                  controls
                  autoPlay
                  playsInline
                  className="max-h-[86vh] max-w-[92vw] rounded-lg shadow-2xl"
                  onClick={(e) => e.stopPropagation()}
                />
              ) : (
                <TransformWrapper
                  doubleClick={{ mode: 'toggle', step: 2 }}
                  wheel={{ step: 0.15 }}
                  pinch={{ step: 5 }}
                  minScale={1}
                  maxScale={4}
                  panning={{ disabled: !zoomed }}
                  onTransform={(_ref: unknown, state: { scale: number }) =>
                    setZoomed(state.scale > 1.01)
                  }
                >
                  <TransformComponent
                    wrapperClass="!w-full !h-full !flex !items-center !justify-center"
                    contentClass="!flex !items-center !justify-center"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={current.url}
                      alt=""
                      draggable={false}
                      className="max-h-[86vh] max-w-[92vw] select-none rounded-lg object-contain shadow-2xl"
                    />
                  </TransformComponent>
                </TransformWrapper>
              )}
            </motion.div>
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
