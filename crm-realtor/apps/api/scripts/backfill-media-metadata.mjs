/**
 * Backfill Telegram-grade media metadata for property_photos rows that predate
 * the media pipeline (blurhash IS NULL). For each such row it downloads the
 * original object, regenerates thumbnail / poster / blurhash / dims / duration,
 * uploads the derived objects, and fills ONLY the new (nullable) columns.
 *
 * Safe by design:
 *   - DRY-RUN by default — pass --apply to write.
 *   - Never modifies `url`, `kind`, `order`, `is_cover` or any CRM data.
 *   - Never deletes originals; only adds derived objects + fills empty columns.
 *   - Per-item failures are logged and skipped (one bad file can't stop the run).
 *
 * Run (from repo root):
 *   set -a; . ./.env; set +a
 *   node apps/api/scripts/backfill-media-metadata.mjs            # dry-run
 *   node apps/api/scripts/backfill-media-metadata.mjs --apply    # write
 */
import { PrismaClient } from '@prisma/client';
import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
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

const exec = promisify(execFile);
const APPLY = process.argv.includes('--apply');

const prisma = new PrismaClient();

const ENDPOINT = process.env.MINIO_ENDPOINT || 'http://127.0.0.1:9000';
const PUBLIC_BASE = (process.env.MINIO_PUBLIC_URL || ENDPOINT).replace(/\/+$/, '');
const PUBLIC_BUCKET = process.env.MINIO_PUBLIC_BUCKET || process.env.MINIO_BUCKET || 'crm-public';

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: process.env.AWS_REGION || 'us-east-1',
  forcePathStyle: true,
  credentials: {
    accessKeyId: process.env.MINIO_ROOT_USER || 'minioadmin',
    secretAccessKey: process.env.MINIO_ROOT_PASSWORD || 'minioadmin_dev',
  },
});

/** Parse "<base>/<bucket>/<key>" out of a stored media URL. */
function parseKey(url) {
  try {
    const u = new URL(url);
    const parts = u.pathname.replace(/^\/+/, '').split('/');
    // strip a leading "media" segment (nginx proxy) and the bucket segment
    let i = 0;
    if (parts[i] === 'media') i++;
    if (parts[i] === PUBLIC_BUCKET) i++;
    return parts.slice(i).join('/');
  } catch {
    return null;
  }
}

async function streamToBuffer(body) {
  const chunks = [];
  for await (const c of body) chunks.push(c);
  return Buffer.concat(chunks);
}

async function getObject(key) {
  const res = await s3.send(new GetObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key }));
  return streamToBuffer(res.Body);
}

async function putObject(key, buf, contentType) {
  await s3.send(
    new PutObjectCommand({ Bucket: PUBLIC_BUCKET, Key: key, Body: buf, ContentType: contentType }),
  );
  return `${PUBLIC_BASE}/${PUBLIC_BUCKET}/${key}`;
}

function derivedKey(baseKey, suffix, ext) {
  const dir = path.posix.dirname(baseKey);
  const base = path.posix.basename(baseKey, path.posix.extname(baseKey));
  const name = `${base}-${suffix}.${ext}`;
  return dir && dir !== '.' ? `${dir}/${name}` : name;
}

async function makeBlurhash(buf) {
  const { data, info } = await sharp(buf, { failOn: 'none' })
    .rotate()
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });
  return blurhashEncode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

async function deriveImage(baseKey, buf) {
  const out = {};
  const m = await sharp(buf, { failOn: 'none' }).metadata();
  if (m.width && m.height) {
    const swap = (m.orientation ?? 0) >= 5;
    out.width = swap ? m.height : m.width;
    out.height = swap ? m.width : m.height;
  }
  const thumb = await sharp(buf, { failOn: 'none' })
    .rotate()
    .resize(480, 480, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 70 })
    .toBuffer();
  out.thumbnailUrl = APPLY ? await putObject(derivedKey(baseKey, 'thumb', 'webp'), thumb, 'image/webp') : '(dry-run)';
  out.blurhash = await makeBlurhash(buf);
  return out;
}

async function deriveVideo(baseKey, buf, mime) {
  const out = {};
  const ext = mime?.includes('webm') ? 'webm' : mime?.includes('quicktime') ? 'mov' : 'mp4';
  const tmpIn = path.join(os.tmpdir(), `bf-${randomUUID()}.${ext}`);
  const tmpPoster = path.join(os.tmpdir(), `bf-${randomUUID()}.jpg`);
  try {
    await fs.writeFile(tmpIn, buf);
    try {
      const { stdout } = await exec(
        ffprobeStatic.path,
        ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height:format=duration', '-of', 'json', tmpIn],
        { timeout: 5000 },
      );
      const p = JSON.parse(stdout);
      if (p.streams?.[0]?.width) {
        out.width = p.streams[0].width;
        out.height = p.streams[0].height;
      }
      const d = parseFloat(p.format?.duration ?? '');
      if (Number.isFinite(d) && d > 0) out.durationMs = Math.round(d * 1000);
    } catch (e) {
      console.warn('   ffprobe:', e.message);
    }
    await exec(ffmpegPath, ['-y', '-ss', '0.5', '-i', tmpIn, '-frames:v', '1', '-q:v', '3', tmpPoster], { timeout: 10000 });
    const poster = await fs.readFile(tmpPoster);
    out.posterUrl = APPLY ? await putObject(derivedKey(baseKey, 'poster', 'jpg'), poster, 'image/jpeg') : '(dry-run)';
    const thumb = await sharp(poster).resize(480, 480, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 70 }).toBuffer();
    out.thumbnailUrl = APPLY ? await putObject(derivedKey(baseKey, 'thumb', 'webp'), thumb, 'image/webp') : '(dry-run)';
    out.blurhash = await makeBlurhash(poster);
  } finally {
    await fs.rm(tmpIn, { force: true }).catch(() => {});
    await fs.rm(tmpPoster, { force: true }).catch(() => {});
  }
  return out;
}

async function main() {
  console.log(`\nMedia backfill — ${APPLY ? 'APPLY (writing)' : 'DRY-RUN (no writes)'}`);
  console.log(`  endpoint=${ENDPOINT}  publicBase=${PUBLIC_BASE}  bucket=${PUBLIC_BUCKET}\n`);

  const rows = await prisma.propertyPhoto.findMany({
    where: { blurhash: null },
    select: { id: true, url: true, kind: true, mimeType: true },
    orderBy: { createdAt: 'asc' },
  });
  const byKind = rows.reduce((a, r) => ((a[r.kind] = (a[r.kind] || 0) + 1), a), {});
  console.log(`Found ${rows.length} row(s) needing metadata: ${JSON.stringify(byKind)}\n`);
  if (rows.length === 0) {
    console.log('Nothing to backfill.\n');
    await prisma.$disconnect();
    return;
  }

  let ok = 0;
  let failed = 0;
  for (const r of rows) {
    const key = parseKey(r.url);
    if (!key) {
      console.warn(`SKIP ${r.id} — cannot parse key from ${r.url}`);
      failed++;
      continue;
    }
    try {
      const buf = await getObject(key);
      const meta = r.kind === 'VIDEO' ? await deriveVideo(key, buf, r.mimeType) : await deriveImage(key, buf);
      console.log(`${APPLY ? 'DONE' : 'WOULD'} ${r.kind} ${r.id}  ${meta.width}x${meta.height} blur=${meta.blurhash?.slice(0, 12)}…`);
      if (APPLY) {
        await prisma.propertyPhoto.update({
          where: { id: r.id },
          data: {
            thumbnailUrl: meta.thumbnailUrl ?? null,
            posterUrl: meta.posterUrl ?? null,
            blurhash: meta.blurhash ?? null,
            width: meta.width ?? null,
            height: meta.height ?? null,
            durationMs: meta.durationMs ?? null,
          },
        });
      }
      ok++;
    } catch (e) {
      console.warn(`FAIL ${r.id} — ${e.message}`);
      failed++;
    }
  }
  console.log(`\nSummary: ${ok} processed, ${failed} skipped/failed. ${APPLY ? 'Changes written.' : 'Re-run with --apply to write.'}\n`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
