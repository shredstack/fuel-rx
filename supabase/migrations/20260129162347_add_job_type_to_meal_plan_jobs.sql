-- Add job_type column to meal_plan_jobs to distinguish between different job types
-- This allows tracking batch prep generation separately from meal plan generation

-- Add job_type column to main table
ALTER TABLE meal_plan_jobs
ADD COLUMN job_type TEXT NOT NULL DEFAULT 'meal_plan_generation'
CHECK (job_type IN ('meal_plan_generation', 'batch_prep_generation'));

-- Add job_type column to history table
ALTER TABLE meal_plan_jobs_history
ADD COLUMN job_type TEXT;

-- Update existing records in history table
UPDATE meal_plan_jobs_history SET job_type = 'meal_plan_generation';

-- Update the trigger function to include job_type
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
    job_type
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.status,
    NEW.progress_message,
    NEW.meal_plan_id,
    NEW.error_message,
    NEW.job_type
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add index for querying by job_type
CREATE INDEX idx_meal_plan_jobs_job_type ON meal_plan_jobs(job_type);

-- Add index for querying batch prep jobs by meal_plan_id (useful for finding batch prep job for a specific meal plan)
CREATE INDEX idx_meal_plan_jobs_meal_plan_id_job_type ON meal_plan_jobs(meal_plan_id, job_type) WHERE job_type = 'batch_prep_generation';

-- Add comment for documentation
COMMENT ON COLUMN meal_plan_jobs.job_type IS 'Type of job: meal_plan_generation (main meal plan) or batch_prep_generation (async batch prep transformation)';
