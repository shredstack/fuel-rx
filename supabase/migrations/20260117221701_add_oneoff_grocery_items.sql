-- ============================================
-- One-Off Grocery Items for Meal Plans
-- ============================================
-- Allows users to add custom items to a specific meal plan's grocery list
-- without saving them as permanent staples.

CREATE TABLE meal_plan_custom_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,

  -- Item details
  name TEXT NOT NULL,

  -- Check-off state
  is_checked BOOLEAN DEFAULT FALSE,

  -- Timestamps
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast lookups
CREATE INDEX idx_meal_plan_custom_items_meal_plan
  ON meal_plan_custom_items(meal_plan_id);

-- Row Level Security
ALTER TABLE meal_plan_custom_items ENABLE ROW LEVEL SECURITY;

-- RLS policies (user must own the meal plan)
CREATE POLICY "Users can view custom items for own meal plans"
  ON meal_plan_custom_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert custom items for own meal plans"
  ON meal_plan_custom_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update custom items for own meal plans"
  ON meal_plan_custom_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete custom items for own meal plans"
  ON meal_plan_custom_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_plans mp
      WHERE mp.id = meal_plan_id AND mp.user_id = auth.uid()
    )
  );

-- Grants
GRANT ALL ON meal_plan_custom_items TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_custom_items TO authenticated;

-- Comments
COMMENT ON TABLE meal_plan_custom_items IS
  'One-off grocery items added to a specific meal plan, not saved as permanent staples';
