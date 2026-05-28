-- Add floor and total_floors to properties table
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "floor" INTEGER;
ALTER TABLE "properties" ADD COLUMN IF NOT EXISTS "total_floors" INTEGER;
