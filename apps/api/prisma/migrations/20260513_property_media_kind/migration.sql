-- Add kind enum (PHOTO/VIDEO) to property_photos so the table can store both images and videos
CREATE TYPE "PropertyMediaKind" AS ENUM ('PHOTO', 'VIDEO');
ALTER TABLE "property_photos"
  ADD COLUMN "kind" "PropertyMediaKind" NOT NULL DEFAULT 'PHOTO';
