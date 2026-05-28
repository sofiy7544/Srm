-- Make Source.name unique. Dedup is performed in app code before
-- this migration; the index will fail if any duplicates remain.
CREATE UNIQUE INDEX IF NOT EXISTS "sources_name_key" ON "sources"("name");
DROP INDEX IF EXISTS "sources_name_unique";
