-- Migration: Simplify prep styles from 4 to 2 options
-- Remove 'mixed' and 'night_before' prep styles, keeping only 'day_of' and 'traditional_batch'

-- Update any users with 'mixed' or 'night_before' prep styles to 'day_of' (new default)
UPDATE user_profiles
SET prep_style = 'day_of'
WHERE prep_style IN ('mixed', 'night_before');

-- Add a comment for documentation
COMMENT ON COLUMN user_profiles.prep_style IS 'User prep style preference: day_of (cook fresh each meal) or traditional_batch (prep all meals on Sunday)';
