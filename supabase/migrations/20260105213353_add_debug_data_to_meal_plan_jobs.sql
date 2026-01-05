-- Add debug_data column to store raw LLM responses for debugging failures
-- This is temporary for debugging intermittent prep session generation issues
-- Can be dropped once the issue is resolved

ALTER TABLE meal_plan_jobs ADD COLUMN debug_data JSONB;

-- Add a comment explaining the purpose
COMMENT ON COLUMN meal_plan_jobs.debug_data IS 'Temporary column for debugging LLM response issues. Stores raw responses on failure. Can be dropped once stable.';
