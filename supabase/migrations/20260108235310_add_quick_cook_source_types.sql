-- Migration: Add quick_cook and party_meal source types
-- ============================================
-- Extends the source_type CHECK constraint to include meals generated
-- from the Quick Cook feature (single meals and party mode)
-- ============================================

-- Drop the existing constraint
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_source_type_check;

-- Add the new constraint with additional values
ALTER TABLE meals ADD CONSTRAINT meals_source_type_check
  CHECK (source_type IN ('ai_generated', 'user_created', 'community_shared', 'quick_cook', 'party_meal'));

-- Add comment for documentation
COMMENT ON COLUMN meals.source_type IS 'How this meal was created: ai_generated (weekly meal plan), user_created (manual entry), community_shared (copied from another user), quick_cook (Quick Cook single meal), party_meal (Quick Cook party mode)';
