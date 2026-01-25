-- Migration: Persist grocery list shopping progress
-- ============================================
-- Stores checked state for grocery items (from AI-generated ingredients)
-- ============================================

CREATE TABLE meal_plan_grocery_checks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,

  -- Normalized item name (lowercase, trimmed) for matching
  item_name_normalized TEXT NOT NULL,

  -- Check state
  is_checked BOOLEAN DEFAULT TRUE,

  -- Timestamps
  checked_at TIMESTAMPTZ DEFAULT NOW(),

  -- Prevent duplicates
  UNIQUE(meal_plan_id, item_name_normalized)
);

-- Index for fast lookups
CREATE INDEX idx_meal_plan_grocery_checks_plan
  ON meal_plan_grocery_checks(meal_plan_id);

-- Enable RLS
ALTER TABLE meal_plan_grocery_checks ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own grocery checks"
  ON meal_plan_grocery_checks FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own grocery checks"
  ON meal_plan_grocery_checks FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own grocery checks"
  ON meal_plan_grocery_checks FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own grocery checks"
  ON meal_plan_grocery_checks FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

-- Grants
GRANT ALL ON meal_plan_grocery_checks TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_grocery_checks TO authenticated;

-- Comment
COMMENT ON TABLE meal_plan_grocery_checks IS
  'Persists shopping progress (checked items) for AI-generated grocery list items';
