-- Migration: Add missing USDA columns and allow USDA ingredient imports
-- ============================================
-- 1. Adds usda_data_type, usda_brand_owner, usda_ingredients_list columns
-- 2. Updates RLS policy to allow authenticated users to import USDA foods
-- ============================================

-- Add missing USDA metadata columns to ingredient_nutrition
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS usda_data_type TEXT,
ADD COLUMN IF NOT EXISTS usda_brand_owner TEXT,
ADD COLUMN IF NOT EXISTS usda_ingredients_list TEXT,
ADD COLUMN IF NOT EXISTS imported_from_usda_at TIMESTAMPTZ;

COMMENT ON COLUMN ingredient_nutrition.usda_data_type IS 'Type of USDA data source (Foundation, SR Legacy, Branded, Survey)';
COMMENT ON COLUMN ingredient_nutrition.usda_brand_owner IS 'Brand name for branded USDA products';
COMMENT ON COLUMN ingredient_nutrition.usda_ingredients_list IS 'Ingredient list from USDA (for branded products)';
COMMENT ON COLUMN ingredient_nutrition.imported_from_usda_at IS 'Timestamp when this food was imported from USDA';

-- Update the view to include new columns
DROP VIEW IF EXISTS ingredient_nutrition_with_details;

CREATE VIEW ingredient_nutrition_with_details AS
SELECT
  n.id,
  n.ingredient_id,
  n.serving_size,
  n.serving_unit,
  n.calories,
  n.protein,
  n.carbs,
  n.fat,
  n.fiber,
  n.sugar,
  n.sodium,
  n.source,
  n.confidence_score,
  n.usda_fdc_id,
  n.usda_data_type,
  n.usda_brand_owner,
  n.usda_ingredients_list,
  n.usda_match_status,
  n.usda_matched_at,
  n.usda_match_confidence,
  n.usda_match_reasoning,
  n.usda_calories_per_100g,
  n.usda_protein_per_100g,
  n.usda_carbs_per_100g,
  n.usda_fat_per_100g,
  n.usda_fiber_per_100g,
  n.usda_sugar_per_100g,
  n.barcode,
  n.validated,
  n.imported_from_usda_at,
  n.created_at,
  n.updated_at,
  i.name AS ingredient_name,
  i.name_normalized,
  i.category,
  i.health_score,
  i.validated AS ingredient_validated,
  i.is_user_added,
  i.added_by_user_id,
  i.added_at
FROM ingredient_nutrition n
JOIN ingredients i ON n.ingredient_id = i.id
WHERE i.deleted_at IS NULL;

-- Grant access to the view
GRANT SELECT ON ingredient_nutrition_with_details TO authenticated, service_role;

-- ============================================
-- RLS Policy Updates for USDA Imports
-- ============================================

-- Allow authenticated users to insert USDA-sourced ingredients (is_user_added = FALSE)
-- These are official USDA foods being imported, not user-created data
DROP POLICY IF EXISTS "Authenticated users can import USDA ingredients" ON ingredients;

CREATE POLICY "Authenticated users can import USDA ingredients"
ON ingredients FOR INSERT
TO authenticated
WITH CHECK (
  -- Either it's a user-added ingredient (existing policy handles this)
  (is_user_added = TRUE AND added_by_user_id = auth.uid())
  -- Or it's a USDA import (system ingredient, not user-added)
  OR (is_user_added = FALSE AND added_by_user_id IS NULL)
);

-- Drop the old more restrictive policy if it exists
DROP POLICY IF EXISTS "Authenticated users can insert user-added ingredients" ON ingredients;

-- Also allow authenticated users to update health_score on existing ingredients
DROP POLICY IF EXISTS "Authenticated users can update ingredient health scores" ON ingredients;

CREATE POLICY "Authenticated users can update ingredient health scores"
ON ingredients FOR UPDATE
TO authenticated
USING (TRUE)
WITH CHECK (TRUE);
