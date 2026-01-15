-- Fix meal source_user_id mismatch
-- ============================================
-- Some meals in meal_plan_meals have source_user_id that doesn't match
-- the meal_plan's user_id. This causes RLS to block access.
--
-- Strategy:
-- 1. For meal_plan_meals pointing to "orphaned" meals (wrong source_user_id),
--    check if the correct user already has an equivalent meal (same name_normalized)
-- 2. If yes, repoint meal_plan_meals to the correct user's meal
-- 3. If no, update the meal's source_user_id (only if it won't cause a duplicate)
-- ============================================

-- Step 1: Repoint meal_plan_meals to existing meals owned by the correct user
-- This handles cases where the meal already exists for the meal_plan owner
UPDATE meal_plan_meals
SET meal_id = correct_meal.id
FROM meal_plans mp,
     meals orphan_meal,
     meals correct_meal
WHERE meal_plan_meals.meal_plan_id = mp.id
  AND meal_plan_meals.meal_id = orphan_meal.id
  AND correct_meal.name_normalized = orphan_meal.name_normalized
  AND correct_meal.source_user_id = mp.user_id
  AND orphan_meal.source_user_id != mp.user_id
  AND orphan_meal.source_type = 'ai_generated';

-- Step 2: For remaining orphaned meals (no duplicate exists), update source_user_id
-- This only updates meals that won't cause a unique constraint violation
UPDATE meals
SET source_user_id = mp.user_id
FROM meal_plan_meals mpm,
     meal_plans mp
WHERE mpm.meal_id = meals.id
  AND mpm.meal_plan_id = mp.id
  AND meals.source_user_id != mp.user_id
  AND meals.source_type = 'ai_generated'
  AND NOT EXISTS (
    SELECT 1 FROM meals existing
    WHERE existing.source_user_id = mp.user_id
      AND existing.name_normalized = meals.name_normalized
  );
