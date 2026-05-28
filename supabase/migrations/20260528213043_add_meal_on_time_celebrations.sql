-- Migration: Meal On-Time Celebrations
-- ============================================
-- The positive-reinforcement companion to meal_reminder_resolutions. When a
-- user logs breakfast, lunch, or dinner on or before their configured target
-- time, the app fires a one-time celebration (confetti + local notification +
-- 🎉 badge) and records it here so it doesn't fire again that day.
--   1. Extend meal_reminder_settings default JSON with on_time_target +
--      celebrate_on_time keys (per breakfast / lunch / dinner).
--   2. Create meal_on_time_celebrations table (one row per user/date/meal_type).
--   3. Enable realtime so the cross-device case sees the celebration too.
-- ============================================


-- ============================================
-- 1. Extend default settings JSON
-- ============================================
-- New users (and rows that don't have a settings blob yet) get the celebration
-- keys in their default object. Existing rows are untouched — the API layer's
-- mergeWithDefaults() will fill in missing keys per request.

ALTER TABLE user_profiles
  ALTER COLUMN meal_reminder_settings SET DEFAULT '{
    "breakfast": {"enabled": false, "start_time": "08:00", "stop_time": "10:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true, "on_time_target": "09:00", "celebrate_on_time": false},
    "lunch":     {"enabled": false, "start_time": "12:00", "stop_time": "14:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true, "on_time_target": "13:00", "celebrate_on_time": false},
    "dinner":    {"enabled": false, "start_time": "18:00", "stop_time": "20:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true, "on_time_target": "19:00", "celebrate_on_time": false},
    "snack":     {"enabled": false, "start_time": "15:00", "stop_time": "16:00", "interval_minutes": 30, "sound_enabled": true, "haptics_enabled": true}
  }'::jsonb;


-- ============================================
-- 2. Table: meal_on_time_celebrations
-- ============================================
-- Mirrors the daily_fruit_veg_celebration shape: one row per
-- (user, date, kind). Snack is excluded by the CHECK constraint since snacks
-- have no canonical on-time target in v1.

CREATE TABLE meal_on_time_celebrations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- User's local date when the qualifying log happened.
  celebration_date DATE NOT NULL,

  meal_type TEXT NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner')),

  -- consumed_at of the qualifying log, for analytics + display.
  logged_at TIMESTAMPTZ NOT NULL,

  -- Snapshot of the target at fire time. Moving the target later in the day
  -- does not retroactively change the historical record.
  target_time TIME NOT NULL,

  -- The message we showed (in-app toast + OS notification body). Stored so
  -- re-renders / the "today's celebrations" feed stay stable.
  message TEXT NOT NULL,

  consumption_log_id UUID REFERENCES meal_consumption_log(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, celebration_date, meal_type)
);

CREATE INDEX idx_meal_on_time_celebrations_user_date
  ON meal_on_time_celebrations(user_id, celebration_date DESC);

ALTER TABLE meal_on_time_celebrations ENABLE ROW LEVEL SECURITY;

-- Celebrations are immutable from the user's side — there's no PUT/DELETE
-- route. The server-side hook on POST /api/consumption is the only writer.
CREATE POLICY "Users read own celebrations"
  ON meal_on_time_celebrations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own celebrations"
  ON meal_on_time_celebrations FOR INSERT
  WITH CHECK (auth.uid() = user_id);

GRANT ALL ON meal_on_time_celebrations TO postgres, service_role;
GRANT SELECT, INSERT ON meal_on_time_celebrations TO authenticated;

COMMENT ON TABLE meal_on_time_celebrations IS 'One celebration per user/date/meal_type when a meal is logged on or before its on_time_target.';


-- ============================================
-- 3. Realtime: enable cross-device sync
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE meal_on_time_celebrations;
