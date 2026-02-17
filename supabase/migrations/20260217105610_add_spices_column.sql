-- Migration: Add spices_and_seasonings column to meal_plans
-- ============================================
-- Stores spices/seasonings extracted from meal instructions so they can be
-- displayed on grocery lists. Users can check off spices they already have.
-- ============================================

-- Add the spices column with default empty array
ALTER TABLE meal_plans
ADD COLUMN spices_and_seasonings JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the column
COMMENT ON COLUMN meal_plans.spices_and_seasonings IS
  'Array of {name: string} objects representing spices/seasonings needed for the meal plan. Extracted from meal instructions during generation.';
