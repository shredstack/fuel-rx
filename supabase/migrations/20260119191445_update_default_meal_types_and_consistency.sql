-- Migration: Update default meal types to include workout meals and snacks
-- Also update default meal consistency to make breakfast, lunch, and snacks "Same Daily"
-- ============================================

-- Update the default for selected_meal_types to include workout meals
-- New users will now default to: breakfast, pre_workout, lunch, post_workout, dinner
ALTER TABLE user_profiles
ALTER COLUMN selected_meal_types SET DEFAULT ARRAY['breakfast', 'pre_workout', 'lunch', 'post_workout', 'dinner'];

-- Update the default snack_count from 0 to 1
ALTER TABLE user_profiles
ALTER COLUMN snack_count SET DEFAULT 1;

-- Update the default meal_consistency_prefs to make breakfast, lunch, and snack "consistent" (Same Daily)
-- Dinner remains "varied", workout meals stay "consistent"
ALTER TABLE user_profiles
ALTER COLUMN meal_consistency_prefs SET DEFAULT '{"breakfast": "consistent", "pre_workout": "consistent", "lunch": "consistent", "post_workout": "consistent", "snack": "consistent", "dinner": "varied"}'::jsonb;

-- Add comments documenting the change
COMMENT ON COLUMN user_profiles.selected_meal_types IS 'Array of meal types user wants in their plan. Default: breakfast, pre_workout, lunch, post_workout, dinner. Snacks handled separately by snack_count.';
COMMENT ON COLUMN user_profiles.snack_count IS 'Number of snacks per day (0-4). Default: 1';
COMMENT ON COLUMN user_profiles.meal_consistency_prefs IS 'User preferences for meal variety. Default: breakfast, lunch, snack are "consistent" (Same Daily), dinner is "varied". Workout meals are always consistent.';
