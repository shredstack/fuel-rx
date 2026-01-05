-- Create meal_plan_jobs_history table for debugging job status transitions
CREATE TABLE meal_plan_jobs_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  job_id UUID NOT NULL REFERENCES meal_plan_jobs(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  progress_message TEXT,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  error_message TEXT,
  recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying history by job
CREATE INDEX idx_meal_plan_jobs_history_job_id ON meal_plan_jobs_history(job_id);

-- Index for querying history by user
CREATE INDEX idx_meal_plan_jobs_history_user_id ON meal_plan_jobs_history(user_id);

-- Index for time-based queries
CREATE INDEX idx_meal_plan_jobs_history_recorded_at ON meal_plan_jobs_history(recorded_at DESC);

-- Enable RLS
ALTER TABLE meal_plan_jobs_history ENABLE ROW LEVEL SECURITY;

-- Users can only view their own job history
CREATE POLICY "Users can view own job history"
  ON meal_plan_jobs_history FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert history (no user-level inserts allowed)
-- History is only written by the trigger below

-- Grant permissions
GRANT ALL ON meal_plan_jobs_history TO postgres, service_role;
GRANT SELECT ON meal_plan_jobs_history TO authenticated;

-- Create trigger function to record history on job updates
CREATE OR REPLACE FUNCTION record_meal_plan_job_history()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO meal_plan_jobs_history (
    job_id,
    user_id,
    status,
    progress_message,
    meal_plan_id,
    error_message
  ) VALUES (
    NEW.id,
    NEW.user_id,
    NEW.status,
    NEW.progress_message,
    NEW.meal_plan_id,
    NEW.error_message
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger on INSERT (initial job creation)
CREATE TRIGGER meal_plan_jobs_history_insert
  AFTER INSERT ON meal_plan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION record_meal_plan_job_history();

-- Trigger on UPDATE (status changes)
CREATE TRIGGER meal_plan_jobs_history_update
  AFTER UPDATE ON meal_plan_jobs
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.error_message IS DISTINCT FROM NEW.error_message)
  EXECUTE FUNCTION record_meal_plan_job_history();

-- Add comment for documentation
COMMENT ON TABLE meal_plan_jobs_history IS 'Audit log of meal plan job status transitions for debugging';
