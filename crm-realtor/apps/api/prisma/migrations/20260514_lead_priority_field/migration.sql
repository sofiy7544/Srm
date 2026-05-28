-- Add priority field to leads table
ALTER TABLE "leads" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(10) DEFAULT 'warm';
