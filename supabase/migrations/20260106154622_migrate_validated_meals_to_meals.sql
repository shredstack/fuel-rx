-- Migration: Migrate validated_meals_by_user data to meals table
-- ============================================
-- Copies existing custom meals to the new normalized meals table
-- Preserves all user flags and metadata
-- Keeps original table as backup until feature is stable
-- ============================================

-- Insert custom meals from validated_meals_by_user into meals
INSERT INTO meals (
  name,
  name_normalized,
  meal_type,
  ingredients,
  instructions,
  calories,
  protein,
  carbs,
  fat,
  prep_time_minutes,
  prep_instructions,
  -- User flags
  is_user_created,
  is_nutrition_edited_by_user,
  source_type,
  source_user_id,
  is_public,
  image_url,
  created_at,
  updated_at
)
SELECT
  meal_name,
  LOWER(TRIM(meal_name)),
  'dinner',  -- Default meal type for migrated meals, users can update later
  COALESCE(ingredients, '[]'::jsonb),
  -- Convert meal_prep_instructions to instructions array
  COALESCE(
    CASE
      WHEN meal_prep_instructions IS NOT NULL AND meal_prep_instructions != ''
      THEN jsonb_build_array(meal_prep_instructions)
      ELSE '[]'::jsonb
    END,
    '[]'::jsonb
  ),
  calories,
  protein,
  carbs,
  fat,
  -- Convert prep_time string to minutes
  CASE prep_time
    WHEN '5_or_less' THEN 5
    WHEN '15' THEN 15
    WHEN '30' THEN 30
    WHEN 'more_than_30' THEN 45
    ELSE 15
  END,
  meal_prep_instructions,
  -- User flags
  COALESCE(is_user_created, FALSE),
  -- If not user-created, it's an AI meal that user edited nutrition on
  NOT COALESCE(is_user_created, FALSE),
  CASE WHEN COALESCE(is_user_created, FALSE) THEN 'user_created' ELSE 'ai_generated' END,
  user_id,
  COALESCE(share_with_community, FALSE),
  image_url,
  created_at,
  COALESCE(updated_at, created_at)
FROM validated_meals_by_user
ON CONFLICT (source_user_id, name_normalized)
WHERE source_type IN ('user_created', 'ai_generated')
DO NOTHING;

-- Add comment noting backup table status
COMMENT ON TABLE validated_meals_by_user IS 'DEPRECATED: Data migrated to meals table. Kept as backup until meal swap feature is stable.';
