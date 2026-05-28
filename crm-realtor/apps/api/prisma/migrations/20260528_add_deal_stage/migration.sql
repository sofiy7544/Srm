-- CreateEnum (safe: skip if already exists)
DO $$ BEGIN
  CREATE TYPE "DealStage" AS ENUM ('OFFER', 'DOCS_REVIEW', 'DUE_DILIGENCE', 'CONTRACT', 'CLOSED_WON', 'CLOSED_LOST');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- AlterTable (safe: skip if column already exists)
ALTER TABLE "deals" ADD COLUMN IF NOT EXISTS "stage" "DealStage" NOT NULL DEFAULT 'OFFER';
