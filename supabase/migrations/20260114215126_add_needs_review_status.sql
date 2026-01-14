-- Migration: Add 'needs_review' status to usda_match_status
-- ============================================
-- This allows flagging ingredients that have large discrepancies
-- or uncertain matches for manual review.
-- ============================================

-- Drop and recreate the check constraint to include 'needs_review'
ALTER TABLE ingredient_nutrition
DROP CONSTRAINT IF EXISTS ingredient_nutrition_usda_match_status_check;

ALTER TABLE ingredient_nutrition
ADD CONSTRAINT ingredient_nutrition_usda_match_status_check
CHECK (usda_match_status IN ('pending', 'matched', 'no_match', 'manual_override', 'needs_review'));

-- Create index for finding items that need review
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_needs_review
  ON ingredient_nutrition(usda_match_status)
  WHERE usda_match_status = 'needs_review';

COMMENT ON COLUMN ingredient_nutrition.usda_match_status IS 'Status of USDA matching: pending (not yet matched), matched (Claude found a match), no_match (no suitable USDA entry found), manual_override (admin manually set the USDA ID), needs_review (match found but flagged for manual verification due to uncertainty or large discrepancy)';
