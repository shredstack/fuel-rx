-- Migration: Add contextual grocery list function
-- ============================================
-- Returns grocery items with meal context references instead of calculated totals.
-- This gives shoppers agency to scale appropriately for their household.
-- ============================================

-- New function that returns grocery items with meal context
CREATE OR REPLACE FUNCTION compute_grocery_list_with_context(p_meal_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  WITH ingredient_meal_refs AS (
    -- Extract each ingredient usage with its meal context
    SELECT
      LOWER(TRIM(ing->>'name')) as name_normalized,
      ing->>'name' as name,
      ing->>'category' as category,
      ing->>'amount' as amount,
      ing->>'unit' as unit,
      mpm.day,
      mpm.meal_type,
      m.name as meal_name,
      mpm.id as meal_plan_meal_id
    FROM meal_plan_meals mpm
    JOIN meals m ON mpm.meal_id = m.id
    CROSS JOIN LATERAL jsonb_array_elements(m.ingredients) AS ing
    WHERE mpm.meal_plan_id = p_meal_plan_id
      AND ing->>'name' IS NOT NULL
  ),
  grouped_ingredients AS (
    -- Group by normalized name, aggregate meal references
    SELECT
      name_normalized,
      -- Use the first non-null name for display (preserves casing)
      (array_agg(name ORDER BY name))[1] as display_name,
      -- Use the most common category
      (array_agg(category ORDER BY category))[1] as category,
      -- Aggregate all meal references as JSON array
      jsonb_agg(
        jsonb_build_object(
          'day', day,
          'meal_type', meal_type,
          'meal_name', meal_name,
          'amount', amount,
          'unit', unit,
          'meal_plan_meal_id', meal_plan_meal_id
        )
        ORDER BY
          CASE day
            WHEN 'monday' THEN 1
            WHEN 'tuesday' THEN 2
            WHEN 'wednesday' THEN 3
            WHEN 'thursday' THEN 4
            WHEN 'friday' THEN 5
            WHEN 'saturday' THEN 6
            WHEN 'sunday' THEN 7
          END,
          CASE meal_type
            WHEN 'breakfast' THEN 1
            WHEN 'lunch' THEN 2
            WHEN 'dinner' THEN 3
            WHEN 'snack' THEN 4
            WHEN 'pre_workout' THEN 5
            WHEN 'post_workout' THEN 6
          END
      ) as meals
    FROM ingredient_meal_refs
    GROUP BY name_normalized
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', display_name,
      'category', COALESCE(category, 'other'),
      'meals', meals
    )
    ORDER BY
      CASE COALESCE(category, 'other')
        WHEN 'produce' THEN 1
        WHEN 'protein' THEN 2
        WHEN 'dairy' THEN 3
        WHEN 'grains' THEN 4
        WHEN 'pantry' THEN 5
        WHEN 'frozen' THEN 6
        ELSE 7
      END,
      display_name
  )
  INTO result
  FROM grouped_ingredients;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant permissions
GRANT EXECUTE ON FUNCTION compute_grocery_list_with_context TO authenticated;
GRANT EXECUTE ON FUNCTION compute_grocery_list_with_context TO service_role;

-- Add comment
COMMENT ON FUNCTION compute_grocery_list_with_context IS
  'Computes grocery list with meal context references for each ingredient. Returns items grouped by name with array of meals that use each ingredient.';
