-- Migration: Add Meal Consumption Tracking
-- ============================================
-- Tracks what users ate and when, with macro snapshots
-- Supports meals from plans, custom meals, and standalone ingredients
-- ============================================

-- ============================================
-- Table 1: meal_consumption_log
-- ============================================
-- Main consumption log table

CREATE TABLE meal_consumption_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- What was consumed (ONE of these will be set based on entry_type)
  meal_plan_meal_id UUID REFERENCES meal_plan_meals(id) ON DELETE SET NULL,
  meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,
  ingredient_name TEXT,  -- For standalone ingredient logging

  -- Entry type for easier querying
  entry_type TEXT NOT NULL CHECK (entry_type IN ('meal_plan', 'custom_meal', 'quick_cook', 'ingredient')),

  -- When it was eaten
  consumed_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  consumed_date DATE NOT NULL DEFAULT CURRENT_DATE,  -- Denormalized for fast daily queries

  -- What was eaten (snapshot - survives edits to source meal)
  display_name TEXT NOT NULL,  -- "Mediterranean Scramble" or "Banana"
  meal_type TEXT CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),  -- NULL for ingredients

  -- Amount (for ingredients only)
  amount DECIMAL,  -- e.g., 1.5
  unit TEXT,       -- e.g., "medium", "cup", "oz"

  -- Macros consumed (snapshot at time of logging)
  calories INTEGER NOT NULL,
  protein DECIMAL NOT NULL,
  carbs DECIMAL NOT NULL,
  fat DECIMAL NOT NULL,

  -- Optional user notes
  notes TEXT,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for common queries
CREATE INDEX idx_consumption_user_date ON meal_consumption_log(user_id, consumed_date);
CREATE INDEX idx_consumption_user_date_type ON meal_consumption_log(user_id, consumed_date, entry_type);
CREATE INDEX idx_consumption_meal_plan_meal ON meal_consumption_log(meal_plan_meal_id) WHERE meal_plan_meal_id IS NOT NULL;
CREATE INDEX idx_consumption_meal ON meal_consumption_log(meal_id) WHERE meal_id IS NOT NULL;
CREATE INDEX idx_consumption_ingredient ON meal_consumption_log(user_id, ingredient_name) WHERE ingredient_name IS NOT NULL;

-- Trigger for updated_at
CREATE TRIGGER trigger_consumption_log_updated_at
  BEFORE UPDATE ON meal_consumption_log
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE meal_consumption_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own consumption logs"
  ON meal_consumption_log FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own consumption logs"
  ON meal_consumption_log FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own consumption logs"
  ON meal_consumption_log FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own consumption logs"
  ON meal_consumption_log FOR DELETE
  USING (user_id = auth.uid());

-- Grants
GRANT ALL ON meal_consumption_log TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_consumption_log TO authenticated;

-- Comment
COMMENT ON TABLE meal_consumption_log IS 'Tracks what users ate and when, with macro snapshots that survive edits to source meals';


-- ============================================
-- Table 2: user_frequent_ingredients
-- ============================================
-- Tracks ingredients users log frequently for personalized quick-add UI

CREATE TABLE user_frequent_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Ingredient identity
  ingredient_name TEXT NOT NULL,
  ingredient_name_normalized TEXT NOT NULL,  -- lowercase, trimmed for matching

  -- Default serving (user's typical amount)
  default_amount DECIMAL NOT NULL DEFAULT 1,
  default_unit TEXT NOT NULL,

  -- Nutrition per default serving
  calories_per_serving INTEGER NOT NULL,
  protein_per_serving DECIMAL NOT NULL,
  carbs_per_serving DECIMAL NOT NULL,
  fat_per_serving DECIMAL NOT NULL,

  -- Usage tracking for sorting
  times_logged INTEGER DEFAULT 1,
  last_logged_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  UNIQUE(user_id, ingredient_name_normalized)
);

-- Index for fetching user's frequent ingredients
CREATE INDEX idx_frequent_ingredients_user ON user_frequent_ingredients(user_id, times_logged DESC);

-- Trigger for updated_at
CREATE TRIGGER trigger_frequent_ingredients_updated_at
  BEFORE UPDATE ON user_frequent_ingredients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE user_frequent_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own frequent ingredients"
  ON user_frequent_ingredients FOR ALL
  USING (user_id = auth.uid());

-- Grants
GRANT ALL ON user_frequent_ingredients TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_frequent_ingredients TO authenticated;

-- Comment
COMMENT ON TABLE user_frequent_ingredients IS 'Tracks ingredients users log frequently for quick-add UI, sorted by usage frequency';


-- ============================================
-- Helper Function: increment_frequent_ingredient_count
-- ============================================
-- Used to increment times_logged on upsert operations

CREATE OR REPLACE FUNCTION increment_frequent_ingredient_count(
  p_user_id UUID,
  p_name_normalized TEXT
) RETURNS VOID AS $$
BEGIN
  UPDATE user_frequent_ingredients
  SET
    times_logged = times_logged + 1,
    last_logged_at = NOW(),
    updated_at = NOW()
  WHERE user_id = p_user_id
    AND ingredient_name_normalized = p_name_normalized;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION increment_frequent_ingredient_count(UUID, TEXT) TO authenticated;
