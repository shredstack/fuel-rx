-- Table to track meal plan generation jobs
CREATE TABLE meal_plan_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'generating_ingredients', 'generating_meals', 'generating_prep', 'saving', 'completed', 'failed')),
  progress_message TEXT,
  meal_plan_id UUID REFERENCES meal_plans(id) ON DELETE SET NULL,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index for querying user's jobs
CREATE INDEX idx_meal_plan_jobs_user_id ON meal_plan_jobs(user_id);

-- RLS policies
ALTER TABLE meal_plan_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own jobs"
  ON meal_plan_jobs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own jobs"
  ON meal_plan_jobs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Function to update updated_at
CREATE OR REPLACE FUNCTION update_meal_plan_jobs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_meal_plan_jobs_updated_at
  BEFORE UPDATE ON meal_plan_jobs
  FOR EACH ROW
  EXECUTE FUNCTION update_meal_plan_jobs_updated_at();
