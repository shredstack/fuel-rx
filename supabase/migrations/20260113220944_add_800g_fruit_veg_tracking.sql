-- Migration: Add 800g Fruit & Vegetable Tracking
-- ============================================
-- Adds fields to track fruit/vegetable grams for the #800gChallenge
-- Includes ingredient category on consumption entries for efficient querying
-- ============================================

-- ============================================
-- Step 1: Add columns to meal_consumption_log
-- ============================================

-- Add grams column for weight tracking (especially for fruits/vegetables)
ALTER TABLE meal_consumption_log
ADD COLUMN grams NUMERIC(10,2);

-- Add ingredient_category to avoid joins when calculating fruit/veg totals
-- Uses the same enum as ingredients table: 'protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'pantry', 'other'
ALTER TABLE meal_consumption_log
ADD COLUMN ingredient_category TEXT CHECK (ingredient_category IN ('protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'pantry', 'other'));

-- Index for efficient fruit/veg queries
CREATE INDEX idx_consumption_log_fruit_veg ON meal_consumption_log(user_id, consumed_date, ingredient_category)
WHERE ingredient_category IN ('fruit', 'vegetable');

-- ============================================
-- Step 2: Add columns to user_frequent_ingredients
-- ============================================

-- Add category to frequent ingredients for quick reference
ALTER TABLE user_frequent_ingredients
ADD COLUMN category TEXT CHECK (category IN ('protein', 'vegetable', 'fruit', 'grain', 'fat', 'dairy', 'pantry', 'other'));

-- Add default grams for common portion sizes
ALTER TABLE user_frequent_ingredients
ADD COLUMN default_grams NUMERIC(10,2);

-- ============================================
-- Step 3: Create daily fruit/veg celebration tracking table
-- ============================================
-- This lightweight table tracks whether user has seen the 800g celebration for a given day
-- Prevents confetti from firing repeatedly

CREATE TABLE daily_fruit_veg_celebration (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  goal_celebrated BOOLEAN DEFAULT FALSE,
  celebrated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, date)
);

-- RLS for celebration tracking
ALTER TABLE daily_fruit_veg_celebration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own celebration tracking"
  ON daily_fruit_veg_celebration FOR ALL
  USING (user_id = auth.uid());

-- Grants
GRANT ALL ON daily_fruit_veg_celebration TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON daily_fruit_veg_celebration TO authenticated;

-- Comment
COMMENT ON TABLE daily_fruit_veg_celebration IS 'Tracks whether user has seen the 800g fruit/veg goal celebration for each day';
COMMENT ON COLUMN meal_consumption_log.grams IS 'Weight in grams (especially for fruits/vegetables tracking toward 800g goal)';
COMMENT ON COLUMN meal_consumption_log.ingredient_category IS 'Category of ingredient (fruit, vegetable, etc.) for efficient 800g tracking';

-- ============================================
-- Step 4: Backfill category data for existing records
-- ============================================
-- Update user_frequent_ingredients with category from ingredients table
UPDATE user_frequent_ingredients ufi
SET category = i.category
FROM ingredients i
WHERE ufi.ingredient_name_normalized = i.name_normalized
  AND ufi.category IS NULL
  AND i.category IS NOT NULL;
