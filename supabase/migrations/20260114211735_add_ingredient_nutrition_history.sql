-- Migration: Add ingredient nutrition history table for USDA matching audit trail
-- ============================================
-- This table captures snapshots of ingredient_nutrition before USDA updates,
-- allowing for audit, review, and rollback of changes.
-- ============================================

-- Add job tracking column to ingredient_nutrition
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_match_job_id UUID REFERENCES usda_backfill_jobs(id);

-- Index for finding all records updated by a specific job
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_usda_job
  ON ingredient_nutrition(usda_match_job_id)
  WHERE usda_match_job_id IS NOT NULL;

-- ============================================
-- History table for ingredient nutrition changes
-- ============================================

CREATE TABLE IF NOT EXISTS ingredient_nutrition_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Reference to the nutrition record that was changed
  nutrition_id UUID NOT NULL REFERENCES ingredient_nutrition(id) ON DELETE CASCADE,

  -- Reference to the job that triggered this change
  job_id UUID NOT NULL REFERENCES usda_backfill_jobs(id) ON DELETE CASCADE,

  -- Snapshot of values BEFORE the update
  previous_calories INTEGER,
  previous_protein DECIMAL,
  previous_carbs DECIMAL,
  previous_fat DECIMAL,
  previous_fiber DECIMAL,
  previous_sugar DECIMAL,
  previous_source TEXT,
  previous_confidence_score DECIMAL,
  previous_usda_fdc_id TEXT,
  previous_usda_match_status TEXT,
  previous_usda_match_confidence DECIMAL,
  previous_usda_calories_per_100g DECIMAL,
  previous_usda_protein_per_100g DECIMAL,
  previous_usda_carbs_per_100g DECIMAL,
  previous_usda_fat_per_100g DECIMAL,
  previous_usda_fiber_per_100g DECIMAL,
  previous_usda_sugar_per_100g DECIMAL,

  -- Snapshot of values AFTER the update (for easy comparison)
  new_calories INTEGER,
  new_protein DECIMAL,
  new_carbs DECIMAL,
  new_fat DECIMAL,
  new_fiber DECIMAL,
  new_sugar DECIMAL,
  new_source TEXT,
  new_confidence_score DECIMAL,
  new_usda_fdc_id TEXT,
  new_usda_match_status TEXT,
  new_usda_match_confidence DECIMAL,
  new_usda_calories_per_100g DECIMAL,
  new_usda_protein_per_100g DECIMAL,
  new_usda_carbs_per_100g DECIMAL,
  new_usda_fat_per_100g DECIMAL,
  new_usda_fiber_per_100g DECIMAL,
  new_usda_sugar_per_100g DECIMAL,

  -- Ingredient details for context (denormalized for easier querying)
  ingredient_name TEXT NOT NULL,
  serving_size DECIMAL,
  serving_unit TEXT,

  -- Whether this change has been reverted
  reverted_at TIMESTAMPTZ,
  reverted_by UUID REFERENCES auth.users(id),

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding history by nutrition record
CREATE INDEX IF NOT EXISTS idx_nutrition_history_nutrition_id
  ON ingredient_nutrition_history(nutrition_id);

-- Index for finding history by job
CREATE INDEX IF NOT EXISTS idx_nutrition_history_job_id
  ON ingredient_nutrition_history(job_id);

-- Index for finding non-reverted changes
CREATE INDEX IF NOT EXISTS idx_nutrition_history_not_reverted
  ON ingredient_nutrition_history(job_id)
  WHERE reverted_at IS NULL;

-- Enable RLS
ALTER TABLE ingredient_nutrition_history ENABLE ROW LEVEL SECURITY;

-- Service role full access (Inngest functions use service role)
CREATE POLICY "Service role full access on ingredient_nutrition_history"
  ON ingredient_nutrition_history FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON ingredient_nutrition_history TO postgres, service_role;

COMMENT ON TABLE ingredient_nutrition_history IS 'Audit trail of ingredient nutrition changes from USDA matching jobs. Enables review and rollback of bulk updates.';
COMMENT ON COLUMN ingredient_nutrition_history.nutrition_id IS 'The ingredient_nutrition record that was modified';
COMMENT ON COLUMN ingredient_nutrition_history.job_id IS 'The USDA backfill job that triggered this change';
COMMENT ON COLUMN ingredient_nutrition_history.reverted_at IS 'If set, indicates this change was rolled back';
