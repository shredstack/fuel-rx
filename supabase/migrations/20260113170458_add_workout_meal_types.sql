-- Migration: Add workout meal types (pre_workout, post_workout)
-- ============================================
-- Adds two new meal types for workout nutrition:
-- - pre_workout: Quick energy before training
-- - post_workout: Recovery nutrition after training
-- ============================================

-- Update the meal_type check constraint on meals table
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_meal_type_check;
ALTER TABLE meals ADD CONSTRAINT meals_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));

-- Update the meal_type check constraint on meal_plan_meals table
ALTER TABLE meal_plan_meals DROP CONSTRAINT IF EXISTS meal_plan_meals_meal_type_check;
ALTER TABLE meal_plan_meals ADD CONSTRAINT meal_plan_meals_meal_type_check
  CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));

-- Update meal_consumption if it has a meal_type constraint
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_name = 'meal_consumption' AND constraint_type = 'CHECK'
  ) THEN
    ALTER TABLE meal_consumption DROP CONSTRAINT IF EXISTS meal_consumption_meal_type_check;
    ALTER TABLE meal_consumption ADD CONSTRAINT meal_consumption_meal_type_check
      CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack', 'pre_workout', 'post_workout'));
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON CONSTRAINT meals_meal_type_check ON meals IS 'Valid meal types including workout meals: breakfast, lunch, dinner, snack, pre_workout, post_workout';
COMMENT ON CONSTRAINT meal_plan_meals_meal_type_check ON meal_plan_meals IS 'Valid meal types including workout meals: breakfast, lunch, dinner, snack, pre_workout, post_workout';
