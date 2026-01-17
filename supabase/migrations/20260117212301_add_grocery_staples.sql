-- ============================================
-- Profile Grocery Staples Feature
-- ============================================

-- ============================================
-- 1. User Grocery Staples Table
-- ============================================

CREATE TABLE user_grocery_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Item identification
  name TEXT NOT NULL,                    -- e.g., "Milk", "Eggs", "Coffee"
  brand TEXT,                            -- e.g., "Kirkland", "Great Value" (optional)
  variant TEXT,                          -- e.g., "2%", "18ct", "organic" (optional)

  -- Display name computed from parts
  -- Stored for search/display efficiency
  display_name TEXT GENERATED ALWAYS AS (
    CASE
      WHEN brand IS NOT NULL AND variant IS NOT NULL THEN name || ' (' || brand || ', ' || variant || ')'
      WHEN brand IS NOT NULL THEN name || ' (' || brand || ')'
      WHEN variant IS NOT NULL THEN name || ' (' || variant || ')'
      ELSE name
    END
  ) STORED,

  -- Categorization (uses existing grocery categories)
  category TEXT NOT NULL DEFAULT 'other'
    CHECK (category IN ('produce', 'protein', 'dairy', 'grains', 'pantry', 'frozen', 'other')),

  -- Frequency behavior
  add_frequency TEXT NOT NULL DEFAULT 'as_needed'
    CHECK (add_frequency IN ('every_week', 'as_needed')),

  -- Usage tracking (for autocomplete ranking)
  times_added INT DEFAULT 0,
  last_added_at TIMESTAMPTZ,

  -- Future: barcode support (Phase 2)
  barcode TEXT,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate items for same user
  UNIQUE(user_id, name, brand, variant)
);

-- ============================================
-- 2. Meal Plan Staples Junction Table
-- ============================================

-- Links staples to specific meal plans (for "this week" additions)
CREATE TABLE meal_plan_staples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  staple_id UUID NOT NULL REFERENCES user_grocery_staples(id) ON DELETE CASCADE,

  -- Check-off state (independent of the staple's global state)
  is_checked BOOLEAN DEFAULT FALSE,

  -- When this staple was added to this specific plan
  created_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicate staples in same meal plan
  UNIQUE(meal_plan_id, staple_id)
);

-- ============================================
-- 3. Indexes
-- ============================================

-- Fast user lookups
CREATE INDEX idx_user_grocery_staples_user_id
  ON user_grocery_staples(user_id);

-- Frequency filtering (for auto-add logic)
CREATE INDEX idx_user_grocery_staples_frequency
  ON user_grocery_staples(user_id, add_frequency);

-- Category grouping
CREATE INDEX idx_user_grocery_staples_category
  ON user_grocery_staples(user_id, category);

-- Full-text search on display_name for autocomplete
CREATE INDEX idx_user_grocery_staples_search
  ON user_grocery_staples USING gin(to_tsvector('english', display_name));

-- Meal plan staples lookups
CREATE INDEX idx_meal_plan_staples_meal_plan
  ON meal_plan_staples(meal_plan_id);

CREATE INDEX idx_meal_plan_staples_staple
  ON meal_plan_staples(staple_id);

-- ============================================
-- 4. Triggers
-- ============================================

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_grocery_staples_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_grocery_staples_updated_at
  BEFORE UPDATE ON user_grocery_staples
  FOR EACH ROW
  EXECUTE FUNCTION update_grocery_staples_updated_at();

-- ============================================
-- 5. Row Level Security
-- ============================================

ALTER TABLE user_grocery_staples ENABLE ROW LEVEL SECURITY;
ALTER TABLE meal_plan_staples ENABLE ROW LEVEL SECURITY;

-- user_grocery_staples policies
CREATE POLICY "Users can view own grocery staples"
  ON user_grocery_staples FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own grocery staples"
  ON user_grocery_staples FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own grocery staples"
  ON user_grocery_staples FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own grocery staples"
  ON user_grocery_staples FOR DELETE
  USING (auth.uid() = user_id);

-- meal_plan_staples policies (user must own the meal plan)
CREATE POLICY "Users can view staples for own meal plans"
  ON meal_plan_staples FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert staples for own meal plans"
  ON meal_plan_staples FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update staples for own meal plans"
  ON meal_plan_staples FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete staples for own meal plans"
  ON meal_plan_staples FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

-- ============================================
-- 6. Functions
-- ============================================

-- Function to auto-populate meal plan with "every_week" staples
-- Called when a new meal plan is created
CREATE OR REPLACE FUNCTION auto_add_weekly_staples(p_meal_plan_id UUID, p_user_id UUID)
RETURNS INT AS $$
DECLARE
  inserted_count INT;
BEGIN
  INSERT INTO meal_plan_staples (meal_plan_id, staple_id)
  SELECT p_meal_plan_id, id
  FROM user_grocery_staples
  WHERE user_id = p_user_id
    AND add_frequency = 'every_week'
  ON CONFLICT (meal_plan_id, staple_id) DO NOTHING;

  GET DIAGNOSTICS inserted_count = ROW_COUNT;
  RETURN inserted_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to increment times_added for multiple staples at once
CREATE OR REPLACE FUNCTION increment_staple_times_added(staple_ids UUID[])
RETURNS VOID AS $$
BEGIN
  UPDATE user_grocery_staples
  SET
    times_added = times_added + 1,
    last_added_at = NOW()
  WHERE id = ANY(staple_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- 7. Grants
-- ============================================

GRANT ALL ON user_grocery_staples TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_grocery_staples TO authenticated;

GRANT ALL ON meal_plan_staples TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_staples TO authenticated;

GRANT EXECUTE ON FUNCTION auto_add_weekly_staples TO authenticated;
GRANT EXECUTE ON FUNCTION auto_add_weekly_staples TO service_role;

GRANT EXECUTE ON FUNCTION increment_staple_times_added TO authenticated;
GRANT EXECUTE ON FUNCTION increment_staple_times_added TO service_role;

-- ============================================
-- 8. Comments
-- ============================================

COMMENT ON TABLE user_grocery_staples IS
  'User-defined grocery items that are purchased regularly, independent of meal plans';

COMMENT ON TABLE meal_plan_staples IS
  'Junction table linking user staples to specific weekly meal plans';

COMMENT ON COLUMN user_grocery_staples.add_frequency IS
  'every_week = auto-added to new grocery lists; as_needed = manually added per week';

COMMENT ON COLUMN user_grocery_staples.times_added IS
  'Counter for autocomplete ranking - incremented each time added to a meal plan';
