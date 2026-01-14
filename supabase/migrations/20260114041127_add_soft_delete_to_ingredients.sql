-- ============================================
-- Add soft delete support to ingredients table
-- ============================================
-- This migration adds a deleted_at column to support soft deletes.
-- When an admin deletes an ingredient, instead of hard deleting,
-- we set deleted_at. This prevents the ingredient from being
-- auto-recreated by the caching system.

-- 1. Add deleted_at column
ALTER TABLE ingredients
ADD COLUMN deleted_at TIMESTAMPTZ DEFAULT NULL;

-- 2. Add index for efficient filtering of non-deleted ingredients
CREATE INDEX idx_ingredients_not_deleted ON ingredients(name_normalized)
WHERE deleted_at IS NULL;

-- 3. Update the ingredient_nutrition_with_details view to exclude deleted ingredients
DROP VIEW IF EXISTS ingredient_nutrition_with_details;

CREATE VIEW ingredient_nutrition_with_details AS
SELECT
  n.id,
  n.ingredient_id,
  i.name AS ingredient_name,
  i.name_normalized,
  i.category,
  i.validated AS ingredient_validated,
  i.is_user_added,
  i.added_by_user_id,
  i.added_at,
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
  n.barcode,
  n.created_at,
  n.updated_at
FROM ingredient_nutrition n
JOIN ingredients i ON n.ingredient_id = i.id
WHERE i.deleted_at IS NULL;

GRANT SELECT ON ingredient_nutrition_with_details TO authenticated;

-- 4. Update the get_or_create_ingredient function to respect soft deletes
CREATE OR REPLACE FUNCTION get_or_create_ingredient(
  p_name TEXT,
  p_category TEXT DEFAULT 'other'
) RETURNS UUID AS $$
DECLARE
  v_normalized TEXT;
  v_id UUID;
BEGIN
  v_normalized := lower(trim(p_name));

  -- Try to find existing NON-DELETED ingredient
  SELECT id INTO v_id FROM ingredients
  WHERE name_normalized = v_normalized
    AND deleted_at IS NULL;

  -- If not found (or was deleted), don't create - return NULL
  -- This prevents auto-recreation of admin-deleted ingredients
  -- New ingredients should be created explicitly via admin or user actions
  IF v_id IS NULL THEN
    -- Check if there's a deleted version
    SELECT id INTO v_id FROM ingredients
    WHERE name_normalized = v_normalized
      AND deleted_at IS NOT NULL;

    -- If there's a deleted version, don't recreate
    IF v_id IS NOT NULL THEN
      RETURN NULL;
    END IF;

    -- Only create if this is a truly new ingredient
    INSERT INTO ingredients (name, name_normalized, category)
    VALUES (p_name, v_normalized, p_category)
    RETURNING id INTO v_id;
  END IF;

  RETURN v_id;
END;
$$ LANGUAGE plpgsql;

-- 5. Add comment explaining the soft delete pattern
COMMENT ON COLUMN ingredients.deleted_at IS 'Soft delete timestamp. When set, ingredient is considered deleted and will not appear in searches or be auto-recreated.';
