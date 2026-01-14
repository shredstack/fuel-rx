-- Migration: Add USDA matching fields to ingredient_nutrition
-- ============================================
-- Adds fields to track USDA FoodData Central matching status,
-- confidence scores, and raw USDA nutrition values (per 100g standard)
-- ============================================

-- Add USDA match status tracking
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_match_status TEXT DEFAULT 'pending'
  CHECK (usda_match_status IN ('pending', 'matched', 'no_match', 'manual_override'));

-- Add timestamp for when USDA match was made
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_matched_at TIMESTAMPTZ;

-- Add Claude's confidence score for the match (0-1)
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_match_confidence DECIMAL;

-- Add Claude's reasoning for the match selection
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_match_reasoning TEXT;

-- Add raw USDA nutrition values (per 100g standard)
-- These are stored separately from the serving-specific values
-- to preserve the original USDA data for reference
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_calories_per_100g DECIMAL;

ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_protein_per_100g DECIMAL;

ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_carbs_per_100g DECIMAL;

ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_fat_per_100g DECIMAL;

ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_fiber_per_100g DECIMAL;

ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_sugar_per_100g DECIMAL;

-- Index for filtering by USDA match status (useful for admin queries)
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_usda_status
  ON ingredient_nutrition(usda_match_status);

-- Index for finding unmatched ingredients that need processing
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_usda_pending
  ON ingredient_nutrition(usda_match_status, source)
  WHERE usda_match_status = 'pending';

-- Update the ingredient_nutrition_with_details view to include USDA fields
DROP VIEW IF EXISTS ingredient_nutrition_with_details;

CREATE VIEW ingredient_nutrition_with_details AS
SELECT
  n.id,
  n.ingredient_id,
  n.serving_size,
  n.serving_unit,
  n.calories,
  n.protein,
  n.carbs,
  n.fat,
  n.fiber,
  n.sugar,
  n.sodium,
  n.source,
  n.confidence_score,
  n.usda_fdc_id,
  n.usda_match_status,
  n.usda_matched_at,
  n.usda_match_confidence,
  n.usda_match_reasoning,
  n.usda_calories_per_100g,
  n.usda_protein_per_100g,
  n.usda_carbs_per_100g,
  n.usda_fat_per_100g,
  n.usda_fiber_per_100g,
  n.usda_sugar_per_100g,
  n.barcode,
  n.validated,
  n.created_at,
  n.updated_at,
  i.name AS ingredient_name,
  i.name_normalized,
  i.category,
  i.validated AS ingredient_validated,
  i.is_user_added,
  i.added_by_user_id,
  i.added_at
FROM ingredient_nutrition n
JOIN ingredients i ON n.ingredient_id = i.id
WHERE i.deleted_at IS NULL;

-- Grant access to the view
GRANT SELECT ON ingredient_nutrition_with_details TO authenticated, service_role;

-- Add comments for documentation
COMMENT ON COLUMN ingredient_nutrition.usda_match_status IS 'Status of USDA matching: pending (not yet matched), matched (Claude found a match), no_match (no suitable USDA entry found), manual_override (admin manually set the USDA ID)';
COMMENT ON COLUMN ingredient_nutrition.usda_matched_at IS 'Timestamp when the USDA match was made or manually overridden';
COMMENT ON COLUMN ingredient_nutrition.usda_match_confidence IS 'Claude confidence score (0-1) for the USDA match. Below 0.5 is typically marked as no_match';
COMMENT ON COLUMN ingredient_nutrition.usda_match_reasoning IS 'Claude explanation for why this USDA entry was selected as the best match';
COMMENT ON COLUMN ingredient_nutrition.usda_calories_per_100g IS 'Raw USDA calories per 100g (standard USDA measurement)';
COMMENT ON COLUMN ingredient_nutrition.usda_protein_per_100g IS 'Raw USDA protein per 100g';
COMMENT ON COLUMN ingredient_nutrition.usda_carbs_per_100g IS 'Raw USDA carbohydrates per 100g';
COMMENT ON COLUMN ingredient_nutrition.usda_fat_per_100g IS 'Raw USDA fat per 100g';
COMMENT ON COLUMN ingredient_nutrition.usda_fiber_per_100g IS 'Raw USDA fiber per 100g';
COMMENT ON COLUMN ingredient_nutrition.usda_sugar_per_100g IS 'Raw USDA sugar per 100g';

-- ============================================
-- Job tracking table for USDA backfill operations
-- ============================================

CREATE TABLE IF NOT EXISTS usda_backfill_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  status TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'completed', 'failed')),
  total_count INTEGER NOT NULL DEFAULT 0,
  processed_count INTEGER NOT NULL DEFAULT 0,
  matched_count INTEGER NOT NULL DEFAULT 0,
  no_match_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  source_filter TEXT,
  batch_size INTEGER DEFAULT 50,
  error_message TEXT,
  started_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for finding recent jobs
CREATE INDEX IF NOT EXISTS idx_usda_backfill_jobs_created_at
  ON usda_backfill_jobs(created_at DESC);

-- Enable RLS
ALTER TABLE usda_backfill_jobs ENABLE ROW LEVEL SECURITY;

-- Only admins can access job records (via service role)
CREATE POLICY "Service role full access on usda_backfill_jobs"
  ON usda_backfill_jobs FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON usda_backfill_jobs TO postgres, service_role;

COMMENT ON TABLE usda_backfill_jobs IS 'Tracks USDA ingredient backfill job progress and results';
