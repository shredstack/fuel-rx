-- Migration: Add workout meal types to meal_consumption_log
-- ============================================
-- Updates the meal_type check constraint on meal_consumption_log
-- to include pre_workout and post_workout meal types.
-- ============================================

-- Update the meal_type check constraint on meal_consumption_log table
ALTER TABLE meal_consumption_log DROP CONSTRAINT IF EXISTS meal_consumption_log_meal_type_check;
ALTER TABLE meal_consumption_log ADD CONSTRAINT meal_consumption_log_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));

-- Add comment for documentation
COMMENT ON CONSTRAINT meal_consumption_log_meal_type_check ON meal_consumption_log IS 'Valid meal types including workout meals: breakfast, lunch, dinner, snack, pre_workout, post_workout';
