-- Migration: Create meal plan with meals view
-- ============================================
-- A convenience view for querying meal plans with all meals expanded
-- ============================================

CREATE OR REPLACE VIEW meal_plan_with_meals AS
SELECT
  mp.id AS meal_plan_id,
  mp.user_id,
  mp.week_start_date,
  mp.title,
  mp.theme_id,
  mp.core_ingredients,
  mp.is_favorite,
  mp.created_at AS meal_plan_created_at,
  mpm.id AS meal_plan_meal_id,
  mpm.day,
  mpm.meal_type,
  mpm.snack_number,
  mpm.position,
  mpm.is_original,
  mpm.swapped_from_meal_id,
  mpm.swapped_at,
  m.id AS meal_id,
  m.name AS meal_name,
  m.ingredients,
  m.instructions,
  m.calories,
  m.protein,
  m.carbs,
  m.fat,
  m.prep_time_minutes,
  m.source_type,
  m.image_url,
  m.theme_name AS meal_theme_name,
  m.is_user_created,
  m.is_public
FROM meal_plans mp
LEFT JOIN meal_plan_meals mpm ON mp.id = mpm.meal_plan_id
LEFT JOIN meals m ON mpm.meal_id = m.id
ORDER BY
  mp.id,
  CASE mpm.day
    WHEN 'monday' THEN 1
    WHEN 'tuesday' THEN 2
    WHEN 'wednesday' THEN 3
    WHEN 'thursday' THEN 4
    WHEN 'friday' THEN 5
    WHEN 'saturday' THEN 6
    WHEN 'sunday' THEN 7
  END,
  CASE mpm.meal_type
    WHEN 'breakfast' THEN 1
    WHEN 'lunch' THEN 2
    WHEN 'dinner' THEN 3
    WHEN 'snack' THEN 4
  END,
  COALESCE(mpm.snack_number, 0),
  mpm.position;

-- Grant access (views inherit RLS from underlying tables)
GRANT SELECT ON meal_plan_with_meals TO authenticated;
GRANT SELECT ON meal_plan_with_meals TO service_role;

-- Add comment
COMMENT ON VIEW meal_plan_with_meals IS 'Convenience view joining meal_plans, meal_plan_meals, and meals for easy querying';
