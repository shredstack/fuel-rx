-- Migration: Add workout meal preferences to user_profiles
-- ============================================
-- Adds user preferences for including pre/post workout meals in their plans:
-- - include_workout_meals: boolean toggle
-- - workout_time: when they typically work out (affects meal placement)
-- - pre_workout_preference: how substantial their pre-workout meal should be
-- ============================================

-- Add workout meal preference columns
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS include_workout_meals BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS workout_time TEXT DEFAULT 'morning'
  CHECK (workout_time IN ('morning', 'midday', 'evening', 'varies')),
ADD COLUMN IF NOT EXISTS pre_workout_preference TEXT DEFAULT 'light'
  CHECK (pre_workout_preference IN ('light', 'moderate', 'substantial'));

-- Add comments for clarity
COMMENT ON COLUMN user_profiles.include_workout_meals IS 'Whether to include pre/post workout meals in generated plans';
COMMENT ON COLUMN user_profiles.workout_time IS 'Typical workout time - affects meal placement (morning: 6-10am, midday: 11am-2pm, evening: 5-8pm, varies: changes daily)';
COMMENT ON COLUMN user_profiles.pre_workout_preference IS 'How substantial pre-workout meal should be: light (~100-150 cal), moderate (~200-300 cal), substantial (~400-500 cal)';
