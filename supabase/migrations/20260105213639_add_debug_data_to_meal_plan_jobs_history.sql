-- Add debug_data column to history table to match meal_plan_jobs
ALTER TABLE meal_plan_jobs_history ADD COLUMN debug_data JSONB;

-- Update the trigger function to include debug_data
CREATE OR REPLACE FUNCTION record_meal_plan_job_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO meal_plan_jobs_history (
    job_id,
    user_id,
    status,
    progress_message,
    meal_plan_id,
    error_message,
    debug_data
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.status,
    NEW.progress_message,
    NEW.meal_plan_id,
    NEW.error_message,
    NEW.debug_data
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comment
COMMENT ON COLUMN meal_plan_jobs_history.debug_data IS 'Temporary column for debugging LLM response issues. Copied from meal_plan_jobs.';
