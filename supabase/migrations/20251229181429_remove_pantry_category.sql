-- Migration: Remove "pantry" from ingredient selection categories
-- Replace with "dairy" as a more meaningful whole-food category
--
-- This migration:
-- 1. Updates user_profiles.ingredient_variety_prefs to use "dairy" instead of "pantry"
-- 2. Updates meal_plan_ingredients category constraint
-- 3. Migrates existing data from "pantry" to "dairy"

-- ============================================
-- 1. Migrate existing user_profiles data
-- ============================================

-- Update any existing user preferences that have "pantry" to use "dairy" instead
-- This transforms: {"proteins": 3, "pantry": 3, ...}
-- Into: {"proteins": 3, "dairy": 2, ...}
UPDATE user_profiles
SET ingredient_variety_prefs = (
  ingredient_variety_prefs - 'pantry' ||
  jsonb_build_object('dairy', COALESCE((ingredient_variety_prefs->>'pantry')::int, 2))
)
WHERE ingredient_variety_prefs ? 'pantry';

-- Update the default for new users
ALTER TABLE user_profiles
ALTER COLUMN ingredient_variety_prefs SET DEFAULT '{
  "proteins": 3,
  "vegetables": 5,
  "fruits": 2,
  "grains": 2,
  "fats": 3,
  "dairy": 2
}'::jsonb;

-- ============================================
-- 2. Update meal_plan_ingredients table
-- ============================================

-- Drop the old constraint FIRST (must happen before updating values)
ALTER TABLE meal_plan_ingredients
DROP CONSTRAINT IF EXISTS meal_plan_ingredients_category_check;

-- Now migrate any existing "pantry" category items to "dairy"
UPDATE meal_plan_ingredients
SET category = 'dairy'
WHERE category = 'pantry';

-- Add the new constraint with "dairy" instead of "pantry"
ALTER TABLE meal_plan_ingredients
ADD CONSTRAINT meal_plan_ingredients_category_check
CHECK (category IN ('proteins', 'vegetables', 'fruits', 'grains', 'fats', 'dairy'));

-- ============================================
-- 3. Update meal_plans.core_ingredients data
-- ============================================

-- Transform any existing core_ingredients JSONB data
-- From: {"proteins": [...], "pantry": [...], ...}
-- To: {"proteins": [...], "dairy": [...], ...}
UPDATE meal_plans
SET core_ingredients = (
  core_ingredients - 'pantry' ||
  CASE
    WHEN core_ingredients ? 'pantry' AND NOT core_ingredients ? 'dairy'
    THEN jsonb_build_object('dairy', core_ingredients->'pantry')
    WHEN core_ingredients ? 'pantry' AND core_ingredients ? 'dairy'
    THEN jsonb_build_object('dairy', (
      SELECT jsonb_agg(item)
      FROM (
        SELECT jsonb_array_elements_text(core_ingredients->'dairy') AS item
        UNION
        SELECT jsonb_array_elements_text(core_ingredients->'pantry') AS item
      ) combined
    ))
    ELSE '{}'::jsonb
  END
)
WHERE core_ingredients ? 'pantry';
