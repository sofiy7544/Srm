-- Drop QUALIFIED from LeadStage enum (already unused in data after the
-- previous "add_funnel_stages" migration moved all rows to DIALOG).
-- Postgres doesn't allow direct enum value drop, so we rebuild it.

-- Safety: ensure no rows still reference QUALIFIED
UPDATE leads SET stage = 'DIALOG' WHERE stage::text = 'QUALIFIED';

ALTER TYPE "LeadStage" RENAME TO "LeadStage_old";

CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'FIRST_CONTACT',
  'DIALOG',
  'SELECTION',
  'SHOWING',
  'NEGOTIATION',
  'DEAL',
  'CLOSED_WON',
  'CLOSED_LOST'
);

ALTER TABLE leads
  ALTER COLUMN stage DROP DEFAULT,
  ALTER COLUMN stage TYPE "LeadStage" USING stage::text::"LeadStage",
  ALTER COLUMN stage SET DEFAULT 'NEW';

DROP TYPE "LeadStage_old";
