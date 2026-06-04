'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { toast } from 'sonner';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { Upload, Trash2, Loader2, Star, Video, ImageIcon, GripVertical, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { properties, uploads, type PropertyPhoto } from '@/lib/api';
import { cn } from '@/lib/utils';
import { BlurImage, formatDuration } from './media/blur-image';
import { MediaLightbox } from './media/media-lightbox';

const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mov';
const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;
const UNDO_MS = 4500;

type Uploading = { id: string; previewUrl: string; progress: number; isVideo: boolean };

function rid() {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function thumbSrc(p: PropertyPhoto): string {
  if (p.kind === 'VIDEO') return p.posterUrl || p.thumbnailUrl || p.url;
  return p.thumbnailUrl || p.url;
}

/** Circular upload-progress indicator drawn over the optimistic preview. */
function ProgressRing({ value }: { value: number }) {
  const r = 18;
  const c = 2 * Math.PI * r;
  return (
    <svg viewBox="0 0 44 44" className="h-11 w-11 -rotate-90">
      <circle cx="22" cy="22" r={r} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="3" />
      <circle
        cx="22"
        cy="22"
        r={r}
        fill="none"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, Math.max(0, value)))}
        className="transition-[stroke-dashoffset] duration-200"
      />
    </svg>
  );
}

function SortablePhoto({
  photo,
  onSetCover,
  onRemove,
  onOpen,
}: {
  photo: PropertyPhoto;
  onSetCover: (id: string) => void;
  onRemove: (photo: PropertyPhoto) => void;
  onOpen: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: photo.id,
  });
  const style: React.CSSProperties = {
    transform: transform ? `translate3d(${transform.x}px, ${transform.y}px, 0)` : undefined,
    transition,
    zIndex: isDragging ? 30 : undefined,
  };
  const hasPreview = photo.kind === 'PHOTO' || !!photo.posterUrl || !!photo.thumbnailUrl;
  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        'group relative aspect-video overflow-hidden rounded-md bg-muted',
        isDragging && 'opacity-80 shadow-lift ring-2 ring-primary',
      )}
    >
      {hasPreview ? (
        <BlurImage src={thumbSrc(photo)} blurhash={photo.blurhash} className="h-full w-full" />
      ) : (
        // eslint-disable-next-line jsx-a11y/media-has-caption
        <video src={`${photo.url}#t=0.1`} className="h-full w-full bg-black object-cover" muted playsInline preload="metadata" />
      )}

      {/* Tap the media to open the fullscreen viewer at this item. Sits above the
          image but below the controls (which have z-10), so star/delete/drag win. */}
      <button
        type="button"
        onClick={onOpen}
        aria-label="Open in viewer"
        className="absolute inset-0 z-[1] cursor-zoom-in"
      />

      {photo.kind === 'VIDEO' && (
        <span className="pointer-events-none absolute inset-0 z-[1] flex items-center justify-center">
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-black/55 text-white">
            <Play className="h-4 w-4 fill-current" />
          </span>
        </span>
      )}

      {/* drag handle */}
      <button
        type="button"
        {...attributes}
        {...listeners}
        className="absolute left-1 top-1 z-10 cursor-grab touch-none rounded bg-black/55 p-1 text-white opacity-100 active:cursor-grabbing sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="Drag to reorder"
      >
        <GripVertical className="h-3.5 w-3.5" />
      </button>

      {photo.kind === 'VIDEO' && (
        <span className="pointer-events-none absolute bottom-1 left-1 z-10 flex items-center gap-1 rounded bg-black/65 px-1.5 py-0.5 text-3xs font-medium text-white">
          <Video className="h-3 w-3" />
          {formatDuration(photo.durationMs) ?? 'VIDEO'}
        </span>
      )}

      {/* set cover */}
      <button
        type="button"
        onClick={() => onSetCover(photo.id)}
        className={cn(
          'absolute right-9 top-1 z-10 rounded p-1 transition-colors',
          photo.isCover
            ? 'bg-primary text-primary-foreground'
            : 'bg-black/55 text-white opacity-100 hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100',
        )}
        aria-label="Set as cover"
        title="Set as cover"
      >
        <Star className={cn('h-3 w-3', photo.isCover && 'fill-current')} />
      </button>

      {/* delete */}
      <button
        type="button"
        onClick={() => onRemove(photo)}
        className="absolute right-1 top-1 z-10 rounded bg-black/55 p-1.5 text-white opacity-100 transition-opacity hover:bg-black/75 sm:opacity-0 sm:group-hover:opacity-100"
        aria-label="delete"
      >
        <Trash2 className="h-3 w-3" />
      </button>
    </div>
  );
}

export function PropertyPhotos({
  propertyId,
  initial,
}: {
  propertyId: string;
  initial: PropertyPhoto[];
}) {
  const t = useTranslations('properties');
  const fileRef = useRef<HTMLInputElement>(null);
  const [acceptHint, setAcceptHint] = useState(MEDIA_ACCEPT);
  const [photos, setPhotos] = useState<PropertyPhoto[]>(initial);
  const [uploading, setUploading] = useState<Uploading[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  const photosRef = useRef(photos);
  photosRef.current = photos;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(TouchSensor, { activationConstraint: { delay: 180, tolerance: 8 } }),
  );

  const handleFiles = useCallback(
    async (files: File[]) => {
      const media = files.filter((f) => f.type.startsWith('image/') || f.type.startsWith('video/') || /\.(mov|heic|heif)$/i.test(f.name));
      if (!media.length) return;
      const batch = media.map((f) => ({
        id: rid(),
        file: f,
        previewUrl: URL.createObjectURL(f),
        isVideo: f.type.startsWith('video/') || /\.mov$/i.test(f.name),
      }));
      setUploading((prev) => [
        ...prev,
        ...batch.map((b) => ({ id: b.id, previewUrl: b.previewUrl, progress: 0, isVideo: b.isVideo })),
      ]);
      const hadNoPhotos = photosRef.current.length === 0;

      await Promise.all(
        batch.map(async (b, i) => {
          try {
            const uploaded = await uploads.mediaWithProgress(b.file, (frac) =>
              setUploading((prev) => prev.map((u) => (u.id === b.id ? { ...u, progress: frac } : u))),
            );
            const isCover = hadNoPhotos && i === 0;
            const photo = await properties.addPhoto(propertyId, { ...uploaded, isCover });
            setPhotos((prev) => [...prev, photo]);
          } catch (err) {
            const e = err as { message?: string; payload?: { message?: string } };
            toast.error(e.payload?.message ?? e.message ?? t('uploadError'));
          } finally {
            URL.revokeObjectURL(b.previewUrl);
            setUploading((prev) => prev.filter((u) => u.id !== b.id));
          }
        }),
      );
    },
    [propertyId, t],
  );

  // Clipboard paste support (screenshots, copied images).
  useEffect(() => {
    function onPaste(e: ClipboardEvent) {
      const files = Array.from(e.clipboardData?.files ?? []);
      if (files.length) {
        e.preventDefault();
        void handleFiles(files);
      }
    }
    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [handleFiles]);

  function openPicker(only: 'photo' | 'video' | 'all') {
    setAcceptHint(only === 'photo' ? IMAGE_ACCEPT : only === 'video' ? VIDEO_ACCEPT : MEDIA_ACCEPT);
    queueMicrotask(() => fileRef.current?.click());
  }

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    await handleFiles(files);
  }

  function onDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    setPhotos((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      if (oldIndex < 0 || newIndex < 0) return prev;
      const next = arrayMove(prev, oldIndex, newIndex);
      void properties
        .reorderPhotos(propertyId, next.map((p) => p.id))
        .catch(() => toast.error(t('uploadError')));
      return next;
    });
  }

  async function setCover(photoId: string) {
    setPhotos((prev) => prev.map((p) => ({ ...p, isCover: p.id === photoId })));
    try {
      await properties.setCover(propertyId, photoId);
      toast.success(t('coverUpdated'));
    } catch {
      toast.error(t('uploadError'));
    }
  }

  // Optimistic delete with Undo — the destructive API call is deferred so an
  // accidental delete can be taken back.
  function removeItem(photo: PropertyPhoto) {
    const index = photos.findIndex((p) => p.id === photo.id);
    setPhotos((prev) => prev.filter((p) => p.id !== photo.id));
    let undone = false;
    const timer = setTimeout(() => {
      if (!undone) properties.removePhoto(propertyId, photo.id).catch(() => undefined);
    }, UNDO_MS);
    toast(t('removed'), {
      duration: UNDO_MS,
      action: {
        label: t('undo'),
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          setPhotos((prev) => {
            if (prev.some((p) => p.id === photo.id)) return prev;
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, photo);
            return next;
          });
        },
      },
    });
  }

  const isEmpty = photos.length === 0 && uploading.length === 0;

  return (
    <div
      className="space-y-3"
      onDragOver={(e) => {
        e.preventDefault();
        if (!dragOver) setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setDragOver(false);
      }}
      onDrop={(e) => {
        e.preventDefault();
        setDragOver(false);
        void handleFiles(Array.from(e.dataTransfer.files));
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t('photos')}</h3>
        <div className="flex gap-2">
          <Button type="button" variant="outline" size="sm" onClick={() => openPicker('photo')}>
            <ImageIcon className="h-4 w-4" />
            {t('uploadPhotos')}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => openPicker('video')}>
            <Video className="h-4 w-4" />
            {t('uploadVideo')}
          </Button>
        </div>
        <input ref={fileRef} type="file" accept={acceptHint} multiple className="hidden" onChange={onSelect} />
      </div>

      {isEmpty ? (
        <button
          type="button"
          onClick={() => openPicker('all')}
          className={cn(
            'block w-full rounded-xl border-2 border-dashed p-10 text-center transition-all',
            dragOver
              ? 'border-primary bg-primary/10'
              : 'border-border hover:border-primary/60 hover:bg-primary/5',
          )}
        >
          <div className="mb-3 flex items-center justify-center gap-3">
            <ImageIcon className="h-6 w-6 text-muted-foreground" />
            <span className="text-lg text-muted-foreground">+</span>
            <Video className="h-6 w-6 text-muted-foreground" />
          </div>
          <p className="font-medium">{t('dropzoneTitle')}</p>
          <p className="mt-1 text-xs text-muted-foreground">{t('dropzoneHint')}</p>
        </button>
      ) : (
        <div
          className={cn(
            'rounded-xl transition-colors',
            dragOver && 'bg-primary/10 ring-2 ring-dashed ring-primary',
          )}
        >
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={photos.map((p) => p.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {photos.map((p, i) => (
                  <SortablePhoto
                    key={p.id}
                    photo={p}
                    onSetCover={setCover}
                    onRemove={removeItem}
                    onOpen={() => setLightboxIdx(i)}
                  />
                ))}

                {/* in-flight uploads */}
                {uploading.map((u) => (
                  <div key={u.id} className="relative aspect-video overflow-hidden rounded-md bg-muted">
                    {u.isVideo ? (
                      // eslint-disable-next-line jsx-a11y/media-has-caption
                      <video src={u.previewUrl} className="h-full w-full bg-black object-cover opacity-60" muted playsInline />
                    ) : (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={u.previewUrl} alt="" className="h-full w-full object-cover opacity-60" />
                    )}
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <ProgressRing value={u.progress} />
                    </div>
                  </div>
                ))}

                {/* add-more tile */}
                <button
                  type="button"
                  onClick={() => openPicker('all')}
                  className="flex aspect-video items-center justify-center rounded-md border-2 border-dashed border-border text-muted-foreground transition-all hover:border-primary/60 hover:bg-primary/5 hover:text-primary"
                >
                  {uploading.length > 0 ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <Upload className="h-5 w-5" />
                  )}
                </button>
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}

      {/* Fullscreen swipeable viewer — opened by tapping any tile above. */}
      <MediaLightbox
        items={photos}
        index={lightboxIdx}
        onIndexChange={setLightboxIdx}
        onClose={() => setLightboxIdx(null)}
      />
    </div>
  );
}
