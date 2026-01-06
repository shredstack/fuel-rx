-- Migration: Create grocery list computation function
-- ============================================
-- Computes grocery list from all linked meals in a meal plan
-- Aggregates ingredients by name + unit, sums amounts
-- ============================================

-- Full grocery list computation (used for initial load and refresh)
CREATE OR REPLACE FUNCTION compute_grocery_list(p_meal_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  -- Aggregate all ingredients from all meals in the plan
  -- Group by name + unit, sum amounts
  WITH ingredient_totals AS (
    SELECT
      ing->>'name' as name,
      ing->>'unit' as unit,
      ing->>'category' as category,
      SUM(
        CASE
          WHEN (ing->>'amount') ~ '^[0-9.]+$' THEN (ing->>'amount')::numeric
          ELSE 1  -- Default to 1 if amount is not a number (e.g., "to taste")
        END
      ) as total_amount
    FROM meal_plan_meals mpm
    JOIN meals m ON mpm.meal_id = m.id
    CROSS JOIN LATERAL jsonb_array_elements(m.ingredients) AS ing
    WHERE mpm.meal_plan_id = p_meal_plan_id
    GROUP BY ing->>'name', ing->>'unit', ing->>'category'
  )
  SELECT jsonb_agg(
    jsonb_build_object(
      'name', name,
      'amount', total_amount::text,
      'unit', unit,
      'category', COALESCE(category, 'other')
    )
    ORDER BY COALESCE(category, 'other'), name
  )
  INTO result
  FROM ingredient_totals
  WHERE name IS NOT NULL;

  RETURN COALESCE(result, '[]'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION compute_grocery_list TO authenticated;
GRANT EXECUTE ON FUNCTION compute_grocery_list TO service_role;

-- Create function to compute daily macro totals
CREATE OR REPLACE FUNCTION compute_daily_totals(p_meal_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  WITH daily_macros AS (
    SELECT
      mpm.day,
      SUM(m.calories) as calories,
      SUM(m.protein) as protein,
      SUM(m.carbs) as carbs,
      SUM(m.fat) as fat
    FROM meal_plan_meals mpm
    JOIN meals m ON mpm.meal_id = m.id
    WHERE mpm.meal_plan_id = p_meal_plan_id
    GROUP BY mpm.day
  )
  SELECT jsonb_object_agg(
    day,
    jsonb_build_object(
      'calories', calories,
      'protein', protein,
      'carbs', carbs,
      'fat', fat
    )
  )
  INTO result
  FROM daily_macros;

  RETURN COALESCE(result, '{}'::jsonb);
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION compute_daily_totals TO authenticated;
GRANT EXECUTE ON FUNCTION compute_daily_totals TO service_role;

-- Create function to increment swap counts
CREATE OR REPLACE FUNCTION increment_meal_swap_counts(
  p_swapped_in_id UUID,
  p_swapped_out_id UUID,
  p_swap_count INTEGER DEFAULT 1
)
RETURNS VOID AS $$
BEGIN
  -- Increment times_swapped_in for the new meal
  UPDATE meals
  SET times_swapped_in = times_swapped_in + p_swap_count,
      times_used = times_used + p_swap_count
  WHERE id = p_swapped_in_id;

  -- Increment times_swapped_out for the old meal
  UPDATE meals
  SET times_swapped_out = times_swapped_out + p_swap_count
  WHERE id = p_swapped_out_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION increment_meal_swap_counts TO authenticated;
GRANT EXECUTE ON FUNCTION increment_meal_swap_counts TO service_role;

-- Add comments
COMMENT ON FUNCTION compute_grocery_list IS 'Computes aggregated grocery list from all meals linked to a meal plan';
COMMENT ON FUNCTION compute_daily_totals IS 'Computes macro totals per day for a meal plan';
COMMENT ON FUNCTION increment_meal_swap_counts IS 'Updates swap analytics on meals when a swap occurs';
