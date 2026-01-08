-- Add prep_style column to meal_plans table to preserve the prep style used when generating the plan
-- This ensures historical meal plans display correctly even if the user changes their preference later

ALTER TABLE meal_plans
ADD COLUMN prep_style VARCHAR(50) DEFAULT 'day_of';

-- Backfill existing meal plans with 'day_of' as the default (since we can't know what was used)
-- New plans will have the correct prep_style saved at generation time
UPDATE meal_plans SET prep_style = 'day_of' WHERE prep_style IS NULL;

-- Add a comment explaining the column
COMMENT ON COLUMN meal_plans.prep_style IS 'The prep style preference used when this meal plan was generated (traditional_batch or day_of)';
