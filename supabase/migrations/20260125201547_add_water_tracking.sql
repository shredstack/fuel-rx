-- daily_water_log table for tracking water intake
-- CrossFit athletes should aim for 100 oz daily
CREATE TABLE daily_water_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  ounces_consumed INTEGER DEFAULT 0,
  goal_ounces INTEGER DEFAULT 100,
  goal_celebrated BOOLEAN DEFAULT FALSE,
  celebrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- RLS policies
ALTER TABLE daily_water_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own water tracking"
  ON daily_water_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own water tracking"
  ON daily_water_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own water tracking"
  ON daily_water_log FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own water tracking"
  ON daily_water_log FOR DELETE
  USING (user_id = auth.uid());

-- Enable Realtime for cross-device sync
ALTER PUBLICATION supabase_realtime ADD TABLE daily_water_log;

-- Index for efficient queries
CREATE INDEX idx_water_log_user_date ON daily_water_log(user_id, date);

-- Grants
GRANT ALL ON daily_water_log TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_water_log TO authenticated;
