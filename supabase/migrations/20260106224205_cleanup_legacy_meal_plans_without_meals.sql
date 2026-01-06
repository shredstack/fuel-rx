-- Migration: Clean up legacy meal plans without linked meals
-- ============================================
-- Deletes meal plans that have no entries in meal_plan_meals.
-- These are pre-migration plans whose meal data was stored in the
-- now-dropped plan_data JSONB column and was not migrated.
--
-- This prevents users from seeing confusing empty meal plans.
-- Related prep_sessions will be cascade deleted automatically.
-- ============================================

DELETE FROM meal_plans
WHERE id NOT IN (
  SELECT DISTINCT meal_plan_id FROM meal_plan_meals
);
