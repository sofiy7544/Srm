'use client';

import { useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { Upload, Trash2, Loader2, Star, Video, ImageIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { properties, uploads, type PropertyPhoto } from '@/lib/api';

// HEIC/HEIF — формат фото с камеры iPhone. Без него Safari не даёт выбрать
// такие снимки. Бэкенд /media их принимает.
const IMAGE_ACCEPT = 'image/jpeg,image/png,image/webp,image/gif,image/heic,image/heif,.heic,.heif';
const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,.mov';
const MEDIA_ACCEPT = `${IMAGE_ACCEPT},${VIDEO_ACCEPT}`;

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
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openPicker(only: 'photo' | 'video' | 'all') {
    setAcceptHint(
      only === 'photo' ? IMAGE_ACCEPT : only === 'video' ? VIDEO_ACCEPT : MEDIA_ACCEPT,
    );
    // updates to <input accept> apply on next render — click in microtask
    queueMicrotask(() => fileRef.current?.click());
  }

  async function onSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const f of files) {
        const { url, kind } = await uploads.media(f);
        const item = await properties.addPhoto(propertyId, url, photos.length === 0, kind);
        setPhotos((prev) => [...prev, item]);
      }
    } catch (err) {
      const e = err as { payload?: { message?: string } };
      setError(e.payload?.message ?? t('uploadError'));
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function removeItem(id: string) {
    await properties.removePhoto(propertyId, id);
    setPhotos((prev) => prev.filter((p) => p.id !== id));
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">{t('photos')}</h3>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPicker('photo')}
            disabled={uploading}
          >
            {uploading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <ImageIcon className="h-4 w-4" />
            )}
            {t('uploadPhotos')}
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => openPicker('video')}
            disabled={uploading}
          >
            <Video className="h-4 w-4" />
            {t('uploadVideo')}
          </Button>
        </div>
        <input
          ref={fileRef}
          type="file"
          accept={acceptHint}
          multiple
          className="hidden"
          onChange={onSelect}
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {photos.length === 0 ? (
        <button
          type="button"
          onClick={() => openPicker('all')}
          disabled={uploading}
          className="block w-full rounded-xl border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-all p-10 text-center group"
        >
          <div className="flex items-center justify-center gap-3 mb-3">
            <ImageIcon className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
            <span className="text-muted-foreground text-lg">+</span>
            <Video className="h-6 w-6 text-muted-foreground group-hover:text-primary transition-colors" />
          </div>
          <p className="font-medium">{t('dropzoneTitle')}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('dropzoneHint')}</p>
        </button>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {photos.map((p) => (
            <div
              key={p.id}
              className="relative group aspect-video bg-muted rounded-md overflow-hidden"
            >
              {p.kind === 'VIDEO' ? (
                <video
                  src={p.url}
                  className="w-full h-full object-cover"
                  muted
                  playsInline
                  preload="metadata"
                  controls={false}
                />
              ) : (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img src={p.url} alt="" className="w-full h-full object-cover" loading="lazy" />
              )}
              {p.kind === 'VIDEO' && (
                <span className="absolute top-1 left-1 bg-black/65 text-white rounded px-1.5 py-0.5 text-3xs font-medium flex items-center gap-1">
                  <Video className="h-3 w-3" /> VIDEO
                </span>
              )}
              {p.isCover && (
                <span className="absolute top-1 right-9 bg-primary text-primary-foreground rounded p-1">
                  <Star className="h-3 w-3 fill-current" />
                </span>
              )}
              <button
                type="button"
                onClick={() => removeItem(p.id)}
                className="absolute top-1 right-1 bg-black/65 text-white rounded p-1.5 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity touch:opacity-100"
                aria-label="delete"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          ))}
          {/* «+» tile to add more */}
          <button
            type="button"
            onClick={() => openPicker('all')}
            disabled={uploading}
            className="aspect-video rounded-md border-2 border-dashed border-border hover:border-primary/60 hover:bg-primary/5 transition-all flex items-center justify-center text-muted-foreground hover:text-primary"
          >
            {uploading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Upload className="h-5 w-5" />
            )}
          </button>
        </div>
      )}
    </div>
  );
}
