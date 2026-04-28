-- =====================================================================
-- Snap-a-Meal evaluation: extract test-fixture corpus from production
-- =====================================================================
--
-- Pulls every cooked-meal photo whose originating recipe we know, joined
-- to the canonical meal record so each row is:
--   photo  +  intended ingredient list  +  intended macros
--
-- Usage:
--   - Run via Supabase Dashboard SQL editor (paste this whole file), OR
--   - Use the TS runner (01-extract-test-fixtures.ts) which executes the
--     same query and downloads each photo to fixtures/photos/.
--
-- Filtering rationale:
--   - cooking_status = 'cooked_as_is'  → recipe-faithful ground truth
--   - cooking_status = 'cooked_with_modifications'  → labeled but degraded
--     (kept for completeness; flagged in `ground_truth_quality`)
--
-- Ground truth quality levels (added by the SELECT):
--   high   = cooked_as_is, no modification_notes
--   medium = cooked_as_is with notes, OR mods with empty notes
--   low    = cooked_with_modifications + notes (assume notable deviation)
--
-- =====================================================================

-- Tier 1: meal-plan cooking-status photos (broadest corpus, all cooked photos)
SELECT
  'meal_plan_cooking' AS source,
  mpcs.id AS cooking_status_id,
  mpcs.cooked_photo_url,
  mpcs.cooking_status,
  mpcs.modification_notes,
  mpcs.cooked_at,

  -- Ground-truth meal data from the recipe
  m.id AS meal_id,
  m.name AS meal_name,
  m.calories AS gt_calories,
  m.protein AS gt_protein,
  m.carbs AS gt_carbs,
  m.fat AS gt_fat,
  m.ingredients AS gt_ingredients,        -- JSONB array

  -- Meal plan context
  mp.user_id,
  mpm.day,
  mpm.meal_type,

  -- Quality flag for downstream filtering
  CASE
    WHEN mpcs.cooking_status = 'cooked_as_is'
         AND (mpcs.modification_notes IS NULL OR mpcs.modification_notes = '')
      THEN 'high'
    WHEN mpcs.cooking_status = 'cooked_as_is'
      THEN 'medium'
    WHEN mpcs.cooking_status = 'cooked_with_modifications'
         AND (mpcs.modification_notes IS NULL OR mpcs.modification_notes = '')
      THEN 'medium'
    ELSE 'low'
  END AS ground_truth_quality

FROM meal_plan_meal_cooking_status mpcs
JOIN meal_plan_meals mpm ON mpm.id = mpcs.meal_plan_meal_id
JOIN meal_plans mp       ON mp.id  = mpm.meal_plan_id
JOIN meals m             ON m.id   = mpm.meal_id
WHERE mpcs.cooked_photo_url IS NOT NULL
  AND mpcs.cooked_photo_url <> ''

UNION ALL

-- Tier 2: saved-meal cooking-status photos (quick-cook, party meals, etc.)
SELECT
  'saved_meal_cooking' AS source,
  smcs.id AS cooking_status_id,
  smcs.cooked_photo_url,
  smcs.cooking_status,
  smcs.modification_notes,
  smcs.cooked_at,

  m.id AS meal_id,
  m.name AS meal_name,
  m.calories AS gt_calories,
  m.protein AS gt_protein,
  m.carbs AS gt_carbs,
  m.fat AS gt_fat,
  m.ingredients AS gt_ingredients,

  smcs.user_id,
  NULL::INTEGER AS day,
  NULL::TEXT AS meal_type,

  CASE
    WHEN smcs.cooking_status = 'cooked_as_is'
         AND (smcs.modification_notes IS NULL OR smcs.modification_notes = '')
      THEN 'high'
    WHEN smcs.cooking_status = 'cooked_as_is'
      THEN 'medium'
    WHEN smcs.cooking_status = 'cooked_with_modifications'
         AND (smcs.modification_notes IS NULL OR smcs.modification_notes = '')
      THEN 'medium'
    ELSE 'low'
  END AS ground_truth_quality

FROM saved_meal_cooking_status smcs
JOIN meals m ON m.id = smcs.meal_id
WHERE smcs.cooked_photo_url IS NOT NULL
  AND smcs.cooked_photo_url <> ''

ORDER BY cooked_at DESC NULLS LAST;

-- =====================================================================
-- Diagnostic: corpus counts by quality tier
-- (run separately to size the test set before downloading photos)
-- =====================================================================
--
-- WITH all_cooked AS (
--   SELECT
--     CASE
--       WHEN mpcs.cooking_status = 'cooked_as_is' AND
--            (mpcs.modification_notes IS NULL OR mpcs.modification_notes = '')
--         THEN 'high'
--       WHEN mpcs.cooking_status = 'cooked_as_is' THEN 'medium'
--       WHEN mpcs.cooking_status = 'cooked_with_modifications' AND
--            (mpcs.modification_notes IS NULL OR mpcs.modification_notes = '')
--         THEN 'medium'
--       ELSE 'low'
--     END AS quality
--   FROM meal_plan_meal_cooking_status mpcs
--   WHERE mpcs.cooked_photo_url IS NOT NULL
-- )
-- SELECT quality, COUNT(*) FROM all_cooked GROUP BY quality ORDER BY 1;
