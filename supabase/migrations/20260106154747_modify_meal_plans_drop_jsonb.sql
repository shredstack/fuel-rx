-- Migration: Modify meal_plans table - drop JSONB columns
-- ============================================
-- Remove plan_data and grocery_list columns
-- These are now normalized in meals/meal_plan_meals tables
-- and computed on-demand via functions
-- ============================================

-- Drop the plan_data column (meals are now in meals + meal_plan_meals tables)
ALTER TABLE meal_plans DROP COLUMN IF EXISTS plan_data;

-- Drop the grocery_list column (now computed on-demand via compute_grocery_list function)
ALTER TABLE meal_plans DROP COLUMN IF EXISTS grocery_list;

-- Add comment documenting the change
COMMENT ON TABLE meal_plans IS 'Meal plans metadata. Meals are linked via meal_plan_meals junction table. Grocery list is computed on-demand.';
