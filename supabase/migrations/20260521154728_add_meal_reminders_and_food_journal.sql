-- Migration: Meal Reminder Alarms + Food Journal
-- ============================================
-- Adds an ADHD-friendly persistent meal reminder system and a Food Journal.
--   1. meal_reminder_settings column on user_profiles (per-meal reminder config)
--   2. food_journal_entries table (observational photo journal)
--   3. meal_reminder_resolutions table (records how a reminder was resolved)
--   4. validation_result column on meal_photos (defense-in-depth food check)
-- ============================================


-- ============================================
-- 1. Reminder settings column on user_profiles
-- ============================================
-- Per-meal reminder config stored as JSONB. Validation (ranges, slot caps) is
-- enforced in the API route, not in SQL. All meals default to disabled so users
-- upgrading from a version without reminders get no surprise beeping.

ALTER TABLE user_profiles
  ADD COLUMN IF NOT EXISTS meal_reminder_settings JSONB NOT NULL DEFAULT '{
    "breakfast": {"enabled": false, "start_time": "08:00", "stop_time": "10:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true},
    "lunch":     {"enabled": false, "start_time": "12:00", "stop_time": "14:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true},
    "dinner":    {"enabled": false, "start_time": "18:00", "stop_time": "20:00", "interval_minutes": 15, "sound_enabled": true, "haptics_enabled": true},
    "snack":     {"enabled": false, "start_time": "15:00", "stop_time": "16:00", "interval_minutes": 30, "sound_enabled": true, "haptics_enabled": true}
  }'::jsonb;

COMMENT ON COLUMN user_profiles.meal_reminder_settings IS 'Per-meal reminder configuration (breakfast/lunch/dinner/snack). Validation enforced in API route.';


-- ============================================
-- 2. Defense-in-depth food validation result on meal_photos
-- ============================================
-- The upload route runs validateFoodImage() before persisting a photo. We store
-- the result so downstream consumers (e.g. food journal creation) can verify a
-- photo passed validation without re-running the LLM check.

ALTER TABLE meal_photos
  ADD COLUMN IF NOT EXISTS validation_result JSONB;

COMMENT ON COLUMN meal_photos.validation_result IS 'Food safety/validation result captured at upload time (isSafe, isFood, category).';


-- ============================================
-- 3. Table: food_journal_entries
-- ============================================
-- Observational food journal. Distinct from meal_consumption_log: journal
-- entries are a record that you ate something (with a photo) and do not feed the
-- macro dashboard. A user can later "promote" an entry to a tracked meal.
-- Created before meal_reminder_resolutions because that table references it.

CREATE TABLE food_journal_entries (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Photo link (reuses existing meal_photos infrastructure)
  meal_photo_id UUID NOT NULL REFERENCES meal_photos(id) ON DELETE CASCADE,

  -- Context
  journaled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  note TEXT,

  -- Provenance: reminder dismissal vs. a manual journal-only snap
  source TEXT NOT NULL DEFAULT 'manual'
    CHECK (source IN ('manual', 'reminder_dismiss')),

  -- If/when the user promotes this to a tracked meal
  promoted_consumption_log_id UUID REFERENCES meal_consumption_log(id) ON DELETE SET NULL,

  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_food_journal_entries_user_date
  ON food_journal_entries(user_id, journaled_at DESC);

CREATE TRIGGER trigger_food_journal_entries_updated_at
  BEFORE UPDATE ON food_journal_entries
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE food_journal_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own journal"
  ON food_journal_entries FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own journal"
  ON food_journal_entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own journal"
  ON food_journal_entries FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own journal"
  ON food_journal_entries FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON food_journal_entries TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON food_journal_entries TO authenticated;

COMMENT ON TABLE food_journal_entries IS 'Observational food journal entries (photo + optional note), separate from macro-tracked consumption.';


-- ============================================
-- 4. Table: meal_reminder_resolutions
-- ============================================
-- Records that a meal reminder was resolved on a given date by a given action.
-- Devices reconcile against this on launch so resolved meals stop beeping.
-- The (user_id, reminder_date, meal_type) unique constraint makes inserts
-- idempotent.

CREATE TABLE meal_reminder_resolutions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reminder_date DATE NOT NULL,                          -- user's local date
  meal_type TEXT NOT NULL
    CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  resolved_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolution_source TEXT NOT NULL
    CHECK (resolution_source IN ('meal_logged', 'photo_snapped', 'manual_dismiss')),
  consumption_log_id UUID REFERENCES meal_consumption_log(id) ON DELETE SET NULL,
  food_journal_entry_id UUID REFERENCES food_journal_entries(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, reminder_date, meal_type)
);

CREATE INDEX idx_meal_reminder_resolutions_user_date
  ON meal_reminder_resolutions(user_id, reminder_date DESC);

ALTER TABLE meal_reminder_resolutions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own resolutions"
  ON meal_reminder_resolutions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users insert own resolutions"
  ON meal_reminder_resolutions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users update own resolutions"
  ON meal_reminder_resolutions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users delete own resolutions"
  ON meal_reminder_resolutions FOR DELETE
  USING (auth.uid() = user_id);

GRANT ALL ON meal_reminder_resolutions TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_reminder_resolutions TO authenticated;

COMMENT ON TABLE meal_reminder_resolutions IS 'Records resolution of a meal reminder (one per user/date/meal_type) so reminders stop firing once acted on.';


-- ============================================
-- 5. Realtime: enable cross-device sync
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE food_journal_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE meal_reminder_resolutions;
