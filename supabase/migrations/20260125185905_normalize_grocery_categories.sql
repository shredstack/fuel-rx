-- Migration: Normalize grocery list categories
-- ============================================
-- Maps AI-generated category variants to standard categories
-- ============================================

CREATE OR REPLACE FUNCTION compute_grocery_list_with_context(p_meal_plan_id UUID)
RETURNS JSONB AS $$
DECLARE
  result JSONB;
BEGIN
  WITH ingredient_meal_refs AS (
    SELECT
      LOWER(TRIM(ing->>'name')) as name_normalized,
      ing->>'name' as name,
      -- Normalize category to standard values
      CASE LOWER(COALESCE(ing->>'category', 'other'))
        -- Produce mappings
        WHEN 'vegetables' THEN 'produce'
        WHEN 'vegetable' THEN 'produce'
        WHEN 'veggies' THEN 'produce'
        WHEN 'fruit' THEN 'produce'
        WHEN 'fruits' THEN 'produce'
        WHEN 'fresh' THEN 'produce'
        WHEN 'greens' THEN 'produce'
        WHEN 'leafy greens' THEN 'produce'
        WHEN 'herbs' THEN 'produce'
        -- Protein mappings
        WHEN 'meat' THEN 'protein'
        WHEN 'meats' THEN 'protein'
        WHEN 'seafood' THEN 'protein'
        WHEN 'fish' THEN 'protein'
        WHEN 'poultry' THEN 'protein'
        WHEN 'eggs' THEN 'protein'
        WHEN 'legumes' THEN 'protein'
        WHEN 'beans' THEN 'protein'
        WHEN 'tofu' THEN 'protein'
        -- Dairy mappings
        WHEN 'milk' THEN 'dairy'
        WHEN 'cheese' THEN 'dairy'
        WHEN 'yogurt' THEN 'dairy'
        -- Grains mappings
        WHEN 'bread' THEN 'grains'
        WHEN 'pasta' THEN 'grains'
        WHEN 'rice' THEN 'grains'
        WHEN 'cereals' THEN 'grains'
        WHEN 'cereal' THEN 'grains'
        WHEN 'oats' THEN 'grains'
        WHEN 'grain' THEN 'grains'
        -- Pantry mappings
        WHEN 'spices' THEN 'pantry'
        WHEN 'spice' THEN 'pantry'
        WHEN 'condiments' THEN 'pantry'
        WHEN 'condiment' THEN 'pantry'
        WHEN 'oils' THEN 'pantry'
        WHEN 'oil' THEN 'pantry'
        WHEN 'sauces' THEN 'pantry'
        WHEN 'sauce' THEN 'pantry'
        WHEN 'canned' THEN 'pantry'
        WHEN 'canned goods' THEN 'pantry'
        WHEN 'baking' THEN 'pantry'
        WHEN 'seasonings' THEN 'pantry'
        WHEN 'seasoning' THEN 'pantry'
        WHEN 'nuts' THEN 'pantry'
        WHEN 'seeds' THEN 'pantry'
        -- Standard categories pass through
        WHEN 'produce' THEN 'produce'
        WHEN 'protein' THEN 'protein'
        WHEN 'dairy' THEN 'dairy'
        WHEN 'grains' THEN 'grains'
        WHEN 'pantry' THEN 'pantry'
        WHEN 'frozen' THEN 'frozen'
        -- Default fallback
        ELSE 'other'
      END as category,
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
    SELECT
      name_normalized,
      (array_agg(name ORDER BY name))[1] as display_name,
      (array_agg(category ORDER BY category))[1] as category,
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
      'category', category,
      'meals', meals
    )
    ORDER BY
      CASE category
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
