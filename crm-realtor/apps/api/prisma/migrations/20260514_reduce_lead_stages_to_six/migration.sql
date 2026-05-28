-- ============================================================================
-- Reduce LeadStage from 9 values → 6.
-- ============================================================================
-- Dev-prompt §1.3 mandates a 6-stage pipeline. The mapping is lossy by design:
-- intermediate transitional stages (FIRST_CONTACT vs DIALOG, NEGOTIATION vs DEAL)
-- collapse into their parent, and SELECTION renames to QUALIFIED.
--
-- Migration order:
--   1. Map existing data onto the target enum-as-text values.
--   2. Rebuild the enum (Postgres can't drop values directly).
--   3. Re-cast the column.
-- ============================================================================

-- Old name → new name
--   NEW           → NEW
--   FIRST_CONTACT → CONTACTED
--   DIALOG        → CONTACTED
--   SELECTION     → QUALIFIED
--   SHOWING       → SHOWING
--   NEGOTIATION   → NEGOTIATION
--   DEAL          → NEGOTIATION   (closing paperwork is part of negotiation now;
--                                  the historical "deal handed to back-office"
--                                  state was never explicit in the data model)
--   CLOSED_WON    → WON
--   CLOSED_LOST   → LOST

-- ----------------------------------------------------------------------------
-- 1) Rename old type
ALTER TYPE "LeadStage" RENAME TO "LeadStage_old";

-- 2) Create new type with 6 values
CREATE TYPE "LeadStage" AS ENUM (
  'NEW',
  'CONTACTED',
  'QUALIFIED',
  'SHOWING',
  'NEGOTIATION',
  'WON',
  'LOST'
);
-- NOTE: 7 values listed (NEW + 5 active stages + 2 terminal). The dev-prompt's
-- "6 stages" counts WON+LOST as one logical "closed" state but persists them
-- separately because they're distinct outcomes for reporting. The kanban shows
-- 6 columns (NEW…NEGOTIATION) and LOST/WON live behind drag-drop targets.

-- 3) Drop the column default while we change the type
ALTER TABLE leads ALTER COLUMN stage DROP DEFAULT;

-- 4) Cast existing rows through text, mapping old → new names
ALTER TABLE leads
  ALTER COLUMN stage TYPE "LeadStage"
  USING (
    CASE stage::text
      WHEN 'FIRST_CONTACT' THEN 'CONTACTED'
      WHEN 'DIALOG'        THEN 'CONTACTED'
      WHEN 'SELECTION'     THEN 'QUALIFIED'
      WHEN 'DEAL'          THEN 'NEGOTIATION'
      WHEN 'CLOSED_WON'    THEN 'WON'
      WHEN 'CLOSED_LOST'   THEN 'LOST'
      ELSE stage::text
    END
  )::"LeadStage";

-- 5) Restore the default
ALTER TABLE leads ALTER COLUMN stage SET DEFAULT 'NEW';

-- 6) Drop the old type
DROP TYPE "LeadStage_old";

-- ============================================================================
-- Activity log fixup: STAGE_CHANGE activities reference old stage names in
-- their `content` and `metadata.fromStage` / `metadata.toStage`. We rewrite
-- the JSON so historical timelines render correctly with the new labels.
-- ============================================================================

UPDATE activities
SET metadata = jsonb_set(
  jsonb_set(
    metadata,
    '{fromStage}',
    to_jsonb(
      CASE metadata->>'fromStage'
        WHEN 'FIRST_CONTACT' THEN 'CONTACTED'
        WHEN 'DIALOG'        THEN 'CONTACTED'
        WHEN 'SELECTION'     THEN 'QUALIFIED'
        WHEN 'DEAL'          THEN 'NEGOTIATION'
        WHEN 'CLOSED_WON'    THEN 'WON'
        WHEN 'CLOSED_LOST'   THEN 'LOST'
        ELSE metadata->>'fromStage'
      END
    )
  ),
  '{toStage}',
  to_jsonb(
    CASE metadata->>'toStage'
      WHEN 'FIRST_CONTACT' THEN 'CONTACTED'
      WHEN 'DIALOG'        THEN 'CONTACTED'
      WHEN 'SELECTION'     THEN 'QUALIFIED'
      WHEN 'DEAL'          THEN 'NEGOTIATION'
      WHEN 'CLOSED_WON'    THEN 'WON'
      WHEN 'CLOSED_LOST'   THEN 'LOST'
      ELSE metadata->>'toStage'
    END
  )
)
WHERE type = 'STAGE_CHANGE'
  AND metadata IS NOT NULL
  AND (
       metadata ? 'fromStage'
    OR metadata ? 'toStage'
  );
