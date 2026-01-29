-- Migration: Split prep_sessions into day-of and batch prep columns
-- This enables:
-- 1. Always generating day-of fresh cooking instructions first
-- 2. Async batch prep transformation from day-of instructions
-- 3. Any user can view either prep style in the UI

-- ============================================
-- 1. Add new JSONB columns for storing prep session data
-- ============================================

-- Store the day-of fresh cooking instructions (always generated)
ALTER TABLE meal_plans
ADD COLUMN prep_sessions_day_of JSONB;

-- Store the batch prep instructions (generated asynchronously)
ALTER TABLE meal_plans
ADD COLUMN prep_sessions_batch JSONB;

-- Track the status of batch prep generation
ALTER TABLE meal_plans
ADD COLUMN batch_prep_status VARCHAR(20) DEFAULT 'pending';

-- Add comments explaining the columns
COMMENT ON COLUMN meal_plans.prep_sessions_day_of IS
  'Day-of fresh cooking instructions - always generated during meal plan creation';

COMMENT ON COLUMN meal_plans.prep_sessions_batch IS
  'Batch prep instructions - generated asynchronously from day-of instructions';

COMMENT ON COLUMN meal_plans.batch_prep_status IS
  'Status of batch prep generation: pending, generating, completed, failed';

-- ============================================
-- 2. Migrate existing data based on prep_style
-- ============================================

-- For day_of plans: Reconstruct PrepModeResponse from prep_sessions table
-- For batch plans: Mark as needing day_of regeneration, copy existing to batch
UPDATE meal_plans mp
SET prep_sessions_day_of = (
  SELECT jsonb_build_object(
    'prepSessions', jsonb_agg(
      jsonb_build_object(
        'sessionName', ps.session_name,
        'sessionOrder', ps.session_order,
        'estimatedMinutes', ps.estimated_minutes,
        'prepItems', ps.prep_items,
        'instructions', ps.instructions,
        'sessionType', ps.session_type,
        'sessionDay', ps.session_day,
        'sessionTimeOfDay', ps.session_time_of_day,
        'prepForDate', ps.prep_for_date,
        'prepTasks', COALESCE(ps.prep_tasks->'tasks', '[]'::jsonb),
        'displayOrder', ps.display_order
      ) ORDER BY ps.session_order
    ),
    'dailyAssembly', COALESCE(
      (SELECT ps2.daily_assembly FROM prep_sessions ps2
       WHERE ps2.meal_plan_id = mp.id
       AND ps2.daily_assembly IS NOT NULL
       LIMIT 1),
      '{}'::jsonb
    )
  )
  FROM prep_sessions ps
  WHERE ps.meal_plan_id = mp.id
)
WHERE mp.prep_style = 'day_of'
  AND EXISTS (SELECT 1 FROM prep_sessions WHERE meal_plan_id = mp.id);

-- For batch prep plans: copy existing sessions to batch column, mark day_of as needing generation
UPDATE meal_plans mp
SET prep_sessions_batch = (
  SELECT jsonb_build_object(
    'prepSessions', jsonb_agg(
      jsonb_build_object(
        'sessionName', ps.session_name,
        'sessionOrder', ps.session_order,
        'estimatedMinutes', ps.estimated_minutes,
        'prepItems', ps.prep_items,
        'instructions', ps.instructions,
        'sessionType', ps.session_type,
        'sessionDay', ps.session_day,
        'sessionTimeOfDay', ps.session_time_of_day,
        'prepForDate', ps.prep_for_date,
        'prepTasks', COALESCE(ps.prep_tasks->'tasks', '[]'::jsonb),
        'displayOrder', ps.display_order
      ) ORDER BY ps.session_order
    ),
    'dailyAssembly', COALESCE(
      (SELECT ps2.daily_assembly FROM prep_sessions ps2
       WHERE ps2.meal_plan_id = mp.id
       AND ps2.daily_assembly IS NOT NULL
       LIMIT 1),
      '{}'::jsonb
    )
  )
  FROM prep_sessions ps
  WHERE ps.meal_plan_id = mp.id
),
batch_prep_status = 'completed'
WHERE mp.prep_style = 'traditional_batch'
  AND EXISTS (SELECT 1 FROM prep_sessions WHERE meal_plan_id = mp.id);

-- For plans without prep_style set, assume day_of
UPDATE meal_plans mp
SET prep_sessions_day_of = (
  SELECT jsonb_build_object(
    'prepSessions', jsonb_agg(
      jsonb_build_object(
        'sessionName', ps.session_name,
        'sessionOrder', ps.session_order,
        'estimatedMinutes', ps.estimated_minutes,
        'prepItems', ps.prep_items,
        'instructions', ps.instructions,
        'sessionType', ps.session_type,
        'sessionDay', ps.session_day,
        'sessionTimeOfDay', ps.session_time_of_day,
        'prepForDate', ps.prep_for_date,
        'prepTasks', COALESCE(ps.prep_tasks->'tasks', '[]'::jsonb),
        'displayOrder', ps.display_order
      ) ORDER BY ps.session_order
    ),
    'dailyAssembly', COALESCE(
      (SELECT ps2.daily_assembly FROM prep_sessions ps2
       WHERE ps2.meal_plan_id = mp.id
       AND ps2.daily_assembly IS NOT NULL
       LIMIT 1),
      '{}'::jsonb
    )
  )
  FROM prep_sessions ps
  WHERE ps.meal_plan_id = mp.id
)
WHERE mp.prep_style IS NULL
  AND EXISTS (SELECT 1 FROM prep_sessions WHERE meal_plan_id = mp.id);

-- ============================================
-- 3. Create index for batch prep job queries
-- ============================================

CREATE INDEX idx_meal_plans_batch_prep_pending
ON meal_plans (user_id, batch_prep_status)
WHERE batch_prep_status = 'pending';

-- ============================================
-- 4. Note on prep_sessions table
-- ============================================
-- The prep_sessions table is kept for backwards compatibility.
-- New code will read from the JSONB columns on meal_plans.
-- The prep_sessions table can be deprecated in a future migration.
