-- Migration: Replace meals_per_day with selected_meal_types and snack_count
-- ============================================
-- This gives users explicit control over which meal types they want,
-- rather than inferring snack counts from a single number.
-- ============================================

-- Add new columns for explicit meal type selection
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS selected_meal_types TEXT[] DEFAULT ARRAY['breakfast', 'lunch', 'dinner'],
ADD COLUMN IF NOT EXISTS snack_count INTEGER DEFAULT 0 CHECK (snack_count >= 0 AND snack_count <= 4);

-- Migrate existing data: convert meals_per_day to selected_meal_types + snack_count
-- meals_per_day 3 = breakfast, lunch, dinner, 0 snacks
-- meals_per_day 4 = breakfast, lunch, dinner, 1 snack
-- meals_per_day 5 = breakfast, lunch, dinner, 2 snacks
-- meals_per_day 6 = breakfast, lunch, dinner, 3 snacks
UPDATE user_profiles
SET
  selected_meal_types = CASE
    WHEN include_workout_meals = TRUE THEN ARRAY['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner']
    ELSE ARRAY['breakfast', 'lunch', 'dinner']
  END,
  snack_count = CASE
    WHEN meals_per_day = 3 THEN 0
    WHEN meals_per_day = 4 THEN 1
    WHEN meals_per_day = 5 THEN 2
    WHEN meals_per_day = 6 THEN 3
    ELSE 0
  END
WHERE selected_meal_types IS NULL OR selected_meal_types = ARRAY['breakfast', 'lunch', 'dinner'];

-- Add comments for clarity
COMMENT ON COLUMN user_profiles.selected_meal_types IS 'Array of meal types user wants in their plan: breakfast, pre_workout, lunch, post_workout, dinner (snacks handled separately by snack_count)';
COMMENT ON COLUMN user_profiles.snack_count IS 'Number of snacks per day (0-4)';

-- Note: We keep meals_per_day and include_workout_meals for backward compatibility
-- They can be removed in a future migration after confirming the new fields work correctly
