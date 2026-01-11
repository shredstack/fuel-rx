-- Migration: Add meal cooking tracker
-- ============================================
-- Tracks when users cook meals, with options for:
-- - Cooked as-is (followed AI instructions exactly)
-- - Cooked with modifications (user made changes)
--
-- Tracking is done at two levels:
-- 1. Per meal-plan instance (which specific meals in a week's plan were cooked)
-- 2. Global stats on the meal itself (total times cooked across all uses)
-- ============================================

-- ============================================
-- Part 1: Add global cooking stats to meals table
-- ============================================

ALTER TABLE meals
  ADD COLUMN times_cooked INTEGER DEFAULT 0,
  ADD COLUMN times_cooked_with_modifications INTEGER DEFAULT 0,
  ADD COLUMN last_cooked_at TIMESTAMP WITH TIME ZONE;

COMMENT ON COLUMN meals.times_cooked IS 'Total times this meal has been marked as cooked across all uses';
COMMENT ON COLUMN meals.times_cooked_with_modifications IS 'Times this meal was cooked with user modifications';
COMMENT ON COLUMN meals.last_cooked_at IS 'When this meal was most recently cooked';

-- ============================================
-- Part 2: Create meal_plan_meal_cooking_status table
-- Tracks cooking status for meals within a meal plan
-- ============================================

CREATE TABLE meal_plan_meal_cooking_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Link to the specific meal slot in a meal plan
  meal_plan_meal_id UUID NOT NULL REFERENCES meal_plan_meals(id) ON DELETE CASCADE,

  -- Cooking status
  cooking_status TEXT NOT NULL DEFAULT 'not_cooked'
    CHECK (cooking_status IN ('not_cooked', 'cooked_as_is', 'cooked_with_modifications')),

  -- When was it cooked
  cooked_at TIMESTAMP WITH TIME ZONE,

  -- Optional notes about modifications made
  modification_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint: one status per meal slot
CREATE UNIQUE INDEX idx_meal_plan_meal_cooking_status_unique
  ON meal_plan_meal_cooking_status(meal_plan_meal_id);

-- Index for querying by meal plan
CREATE INDEX idx_meal_plan_meal_cooking_status_plan
  ON meal_plan_meal_cooking_status(meal_plan_meal_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_meal_plan_meal_cooking_status_updated_at
  BEFORE UPDATE ON meal_plan_meal_cooking_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE meal_plan_meal_cooking_status ENABLE ROW LEVEL SECURITY;

-- Users can view cooking status for their own meal plan meals
CREATE POLICY "Users can view own meal plan cooking status"
  ON meal_plan_meal_cooking_status FOR SELECT
  USING (
    meal_plan_meal_id IN (
      SELECT mpm.id FROM meal_plan_meals mpm
      JOIN meal_plans mp ON mpm.meal_plan_id = mp.id
      WHERE mp.user_id = auth.uid()
    )
  );

-- Users can insert cooking status for their own meal plan meals
CREATE POLICY "Users can insert own meal plan cooking status"
  ON meal_plan_meal_cooking_status FOR INSERT
  WITH CHECK (
    meal_plan_meal_id IN (
      SELECT mpm.id FROM meal_plan_meals mpm
      JOIN meal_plans mp ON mpm.meal_plan_id = mp.id
      WHERE mp.user_id = auth.uid()
    )
  );

-- Users can update cooking status for their own meal plan meals
CREATE POLICY "Users can update own meal plan cooking status"
  ON meal_plan_meal_cooking_status FOR UPDATE
  USING (
    meal_plan_meal_id IN (
      SELECT mpm.id FROM meal_plan_meals mpm
      JOIN meal_plans mp ON mpm.meal_plan_id = mp.id
      WHERE mp.user_id = auth.uid()
    )
  );

-- Users can delete cooking status for their own meal plan meals
CREATE POLICY "Users can delete own meal plan cooking status"
  ON meal_plan_meal_cooking_status FOR DELETE
  USING (
    meal_plan_meal_id IN (
      SELECT mpm.id FROM meal_plan_meals mpm
      JOIN meal_plans mp ON mpm.meal_plan_id = mp.id
      WHERE mp.user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY "Service role full access on meal_plan_meal_cooking_status"
  ON meal_plan_meal_cooking_status FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON meal_plan_meal_cooking_status TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_meal_cooking_status TO authenticated;

-- ============================================
-- Part 3: Create saved_meal_cooking_status table
-- Tracks cooking status for saved meals (quick cook, party plans)
-- ============================================

CREATE TABLE saved_meal_cooking_status (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- The meal being tracked (from meals table)
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Cooking status
  cooking_status TEXT NOT NULL DEFAULT 'not_cooked'
    CHECK (cooking_status IN ('not_cooked', 'cooked_as_is', 'cooked_with_modifications')),

  -- When was it cooked
  cooked_at TIMESTAMP WITH TIME ZONE,

  -- Optional notes about modifications made
  modification_notes TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Unique constraint: one status per user-meal combination
CREATE UNIQUE INDEX idx_saved_meal_cooking_status_unique
  ON saved_meal_cooking_status(user_id, meal_id);

-- Index for querying by user
CREATE INDEX idx_saved_meal_cooking_status_user
  ON saved_meal_cooking_status(user_id);

-- Index for querying by meal
CREATE INDEX idx_saved_meal_cooking_status_meal
  ON saved_meal_cooking_status(meal_id);

-- Trigger for updated_at
CREATE TRIGGER trigger_saved_meal_cooking_status_updated_at
  BEFORE UPDATE ON saved_meal_cooking_status
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE saved_meal_cooking_status ENABLE ROW LEVEL SECURITY;

-- Users can manage their own saved meal cooking status
CREATE POLICY "Users can view own saved meal cooking status"
  ON saved_meal_cooking_status FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own saved meal cooking status"
  ON saved_meal_cooking_status FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own saved meal cooking status"
  ON saved_meal_cooking_status FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own saved meal cooking status"
  ON saved_meal_cooking_status FOR DELETE
  USING (user_id = auth.uid());

-- Service role can do anything
CREATE POLICY "Service role full access on saved_meal_cooking_status"
  ON saved_meal_cooking_status FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON saved_meal_cooking_status TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON saved_meal_cooking_status TO authenticated;

-- ============================================
-- Part 4: Function to increment meal cooking stats
-- ============================================

CREATE OR REPLACE FUNCTION increment_meal_cooked_stats(
  p_meal_id UUID,
  p_with_modifications BOOLEAN
) RETURNS VOID AS $$
BEGIN
  UPDATE meals
  SET
    times_cooked = COALESCE(times_cooked, 0) + 1,
    times_cooked_with_modifications = COALESCE(times_cooked_with_modifications, 0) +
      CASE WHEN p_with_modifications THEN 1 ELSE 0 END,
    last_cooked_at = NOW(),
    updated_at = NOW()
  WHERE id = p_meal_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION increment_meal_cooked_stats(UUID, BOOLEAN) TO authenticated;

-- ============================================
-- Part 5: Add comments for documentation
-- ============================================

COMMENT ON TABLE meal_plan_meal_cooking_status IS 'Tracks cooking status for meals within a meal plan. Each meal slot can have one status.';
COMMENT ON TABLE saved_meal_cooking_status IS 'Tracks cooking status for saved meals (quick cook, party plans) outside of meal plans.';
COMMENT ON FUNCTION increment_meal_cooked_stats(UUID, BOOLEAN) IS 'Increments the cooking stats on a meal when it is marked as cooked.';
