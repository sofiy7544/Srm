-- Telegram-grade media metadata for property_photos. Additive + idempotent:
-- all columns nullable so existing rows are untouched (NULL = frontend falls
-- back to the original `url`).
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "poster_url"    TEXT;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "blurhash"      TEXT;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "width"         INTEGER;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "height"        INTEGER;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "duration_ms"   INTEGER;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "mime_type"     TEXT;
ALTER TABLE "property_photos" ADD COLUMN IF NOT EXISTS "size_bytes"    INTEGER;
