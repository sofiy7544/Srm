import { Injectable, Logger } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { randomUUID } from 'node:crypto';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs/promises';
import sharp from 'sharp';
import { encode as blurhashEncode } from 'blurhash';
import ffmpegPath from 'ffmpeg-static';
import ffprobeStatic from 'ffprobe-static';
import { StorageService } from './storage.service';

const execFileAsync = promisify(execFile);

/**
 * Best-effort metadata produced from an uploaded media file. EVERY field is
 * optional: if processing fails or times out, the field is simply absent and
 * the upload still succeeds. This type is the contract returned to the client
 * and persisted on PropertyPhoto.
 */
export interface MediaMetadata {
  thumbnailUrl?: string;
  posterUrl?: string;
  blurhash?: string;
  width?: number;
  height?: number;
  durationMs?: number;
}

// Per-operation hard limits (ms). A media file can never block longer than this.
const SHARP_TIMEOUT = 5_000;
const FFMPEG_TIMEOUT = 10_000;
const FFPROBE_TIMEOUT = 5_000;
const TOTAL_BUDGET = 12_000; // worst-case wall time for the whole derivation

// Thumbnail sizing — small enough for instant grid loads.
const THUMB_MAX = 480;
const THUMB_QUALITY = 70;

/** Reject if a promise outlives `ms`. Used to bound sharp/blurhash work. */
function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`${label} timed out after ${ms}ms`)), ms);
    p.then(
      (v) => {
        clearTimeout(t);
        resolve(v);
      },
      (e) => {
        clearTimeout(t);
        reject(e);
      },
    );
  });
}

/**
 * Derives Telegram-grade media metadata (thumbnail, blurhash, poster, dims,
 * duration) from an uploaded buffer and stores the derived objects in the
 * public bucket.
 *
 * HARD GUARANTEE: `derive()` NEVER throws and NEVER hangs. Image work runs in
 * sharp's libuv threadpool (async, off the event loop); video work runs as
 * separate ffmpeg/ffprobe child processes (killed on timeout). Any failure
 * degrades to a partial/empty result so the caller's upload always succeeds.
 */
@Injectable()
export class MediaProcessor {
  private readonly logger = new Logger(MediaProcessor.name);

  constructor(private readonly storage: StorageService) {}

  /** baseKey e.g. "properties/uuid.jpeg" → "properties/uuid-thumb.webp". */
  private derivedKey(baseKey: string, suffix: string, ext: string): string {
    const dir = path.posix.dirname(baseKey);
    const base = path.posix.basename(baseKey, path.posix.extname(baseKey));
    const name = `${base}-${suffix}.${ext}`;
    return dir && dir !== '.' ? `${dir}/${name}` : name;
  }

  async derive(
    kind: 'PHOTO' | 'VIDEO',
    baseKey: string,
    buffer: Buffer,
    mime: string,
  ): Promise<MediaMetadata> {
    try {
      const work = kind === 'VIDEO'
        ? this.deriveVideo(baseKey, buffer, mime)
        : this.deriveImage(baseKey, buffer);
      // Outer budget guard so the whole thing can never exceed TOTAL_BUDGET.
      return await withTimeout(work, TOTAL_BUDGET, 'media derivation');
    } catch (err) {
      this.logger.warn(`Media derivation skipped (${kind}): ${(err as Error).message}`);
      return {};
    }
  }

  // ───────────────────────── images ─────────────────────────

  private async deriveImage(baseKey: string, buffer: Buffer): Promise<MediaMetadata> {
    const meta: MediaMetadata = {};

    // Intrinsic dimensions (account for EXIF orientation swap).
    try {
      const m = await withTimeout(
        sharp(buffer, { failOn: 'none' }).metadata(),
        SHARP_TIMEOUT,
        'sharp.metadata',
      );
      if (m.width && m.height) {
        const swap = (m.orientation ?? 0) >= 5;
        meta.width = swap ? m.height : m.width;
        meta.height = swap ? m.width : m.height;
      }
    } catch (e) {
      this.logger.warn(`image metadata failed: ${(e as Error).message}`);
    }

    // Thumbnail (webp) — uploaded as a separate object.
    try {
      const thumbBuf = await withTimeout(
        sharp(buffer, { failOn: 'none' })
          .rotate()
          .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
          .webp({ quality: THUMB_QUALITY })
          .toBuffer(),
        SHARP_TIMEOUT,
        'sharp.thumbnail',
      );
      const key = this.derivedKey(baseKey, 'thumb', 'webp');
      const up = await this.storage.uploadBuffer(key, thumbBuf, 'image/webp', 'public');
      meta.thumbnailUrl = up.url;
    } catch (e) {
      this.logger.warn(`image thumbnail failed: ${(e as Error).message}`);
    }

    // Blurhash placeholder.
    meta.blurhash = (await this.makeBlurhash(buffer)) ?? undefined;

    return meta;
  }

  /** Encode a compact blurhash from a tiny raster. Returns null on any failure. */
  private async makeBlurhash(imageBuffer: Buffer): Promise<string | null> {
    try {
      const { data, info } = await withTimeout(
        sharp(imageBuffer, { failOn: 'none' })
          .rotate()
          .raw()
          .ensureAlpha()
          .resize(32, 32, { fit: 'inside' })
          .toBuffer({ resolveWithObject: true }),
        SHARP_TIMEOUT,
        'sharp.blurhash',
      );
      return blurhashEncode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
    } catch (e) {
      this.logger.warn(`blurhash failed: ${(e as Error).message}`);
      return null;
    }
  }

  // ───────────────────────── video ─────────────────────────

  private async deriveVideo(baseKey: string, buffer: Buffer, mime: string): Promise<MediaMetadata> {
    const meta: MediaMetadata = {};
    const ext = mime === 'video/webm' ? 'webm' : mime === 'video/quicktime' ? 'mov' : 'mp4';
    const tmpIn = path.join(os.tmpdir(), `mp-${randomUUID()}.${ext}`);
    const tmpPoster = path.join(os.tmpdir(), `mp-${randomUUID()}.jpg`);

    try {
      await fs.writeFile(tmpIn, buffer);

      // Probe dimensions + duration (separate child process).
      try {
        const { stdout } = await execFileAsync(
          ffprobeStatic.path,
          [
            '-v', 'error',
            '-select_streams', 'v:0',
            '-show_entries', 'stream=width,height:format=duration',
            '-of', 'json',
            tmpIn,
          ],
          { timeout: FFPROBE_TIMEOUT },
        );
        const probe = JSON.parse(stdout) as {
          streams?: Array<{ width?: number; height?: number }>;
          format?: { duration?: string };
        };
        const s = probe.streams?.[0];
        if (s?.width && s?.height) {
          meta.width = s.width;
          meta.height = s.height;
        }
        const dur = parseFloat(probe.format?.duration ?? '');
        if (Number.isFinite(dur) && dur > 0) meta.durationMs = Math.round(dur * 1000);
      } catch (e) {
        this.logger.warn(`ffprobe failed: ${(e as Error).message}`);
      }

      // Extract a poster frame ~0.5s in (separate child process; killed on timeout).
      let posterBuf: Buffer | null = null;
      try {
        await execFileAsync(
          ffmpegPath as unknown as string,
          ['-y', '-ss', '0.5', '-i', tmpIn, '-frames:v', '1', '-q:v', '3', tmpPoster],
          { timeout: FFMPEG_TIMEOUT },
        );
        posterBuf = await fs.readFile(tmpPoster);
      } catch (e) {
        this.logger.warn(`ffmpeg poster failed: ${(e as Error).message}`);
      }

      if (posterBuf && posterBuf.length > 0) {
        // Store the poster JPEG (browser-displayable even for .mov).
        try {
          const key = this.derivedKey(baseKey, 'poster', 'jpg');
          const up = await this.storage.uploadBuffer(key, posterBuf, 'image/jpeg', 'public');
          meta.posterUrl = up.url;
        } catch (e) {
          this.logger.warn(`poster upload failed: ${(e as Error).message}`);
        }
        // A small webp thumbnail from the poster, for the grid.
        try {
          const thumbBuf = await withTimeout(
            sharp(posterBuf, { failOn: 'none' })
              .resize(THUMB_MAX, THUMB_MAX, { fit: 'inside', withoutEnlargement: true })
              .webp({ quality: THUMB_QUALITY })
              .toBuffer(),
            SHARP_TIMEOUT,
            'sharp.videoThumb',
          );
          const key = this.derivedKey(baseKey, 'thumb', 'webp');
          const up = await this.storage.uploadBuffer(key, thumbBuf, 'image/webp', 'public');
          meta.thumbnailUrl = up.url;
        } catch (e) {
          this.logger.warn(`video thumbnail failed: ${(e as Error).message}`);
        }
        meta.blurhash = (await this.makeBlurhash(posterBuf)) ?? undefined;
        // Fall back to poster dimensions if ffprobe didn't yield any.
        if (!meta.width || !meta.height) {
          try {
            const m = await withTimeout(
              sharp(posterBuf, { failOn: 'none' }).metadata(),
              SHARP_TIMEOUT,
              'sharp.posterMeta',
            );
            if (m.width && m.height) {
              meta.width = m.width;
              meta.height = m.height;
            }
          } catch {
            /* ignore */
          }
        }
      }
    } catch (e) {
      this.logger.warn(`video derivation failed: ${(e as Error).message}`);
    } finally {
      // Always clean up temp files.
      await fs.rm(tmpIn, { force: true }).catch(() => undefined);
      await fs.rm(tmpPoster, { force: true }).catch(() => undefined);
    }

    return meta;
  }
}
