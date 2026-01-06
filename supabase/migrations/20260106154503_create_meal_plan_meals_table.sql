-- Migration: Create meal_plan_meals junction table
-- ============================================
-- Links meals to specific slots in meal plans
-- Enables meal swapping by simply updating the meal_id reference
-- ============================================

CREATE TABLE meal_plan_meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Foreign keys
  meal_plan_id UUID NOT NULL REFERENCES meal_plans(id) ON DELETE CASCADE,
  meal_id UUID NOT NULL REFERENCES meals(id) ON DELETE RESTRICT,

  -- Position in meal plan
  day TEXT NOT NULL CHECK (day IN (
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  )),
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  snack_number INTEGER,  -- 1, 2, 3 for multiple snacks per day (NULL for non-snacks)
  position INTEGER NOT NULL DEFAULT 0,  -- Order within meal type (for sorting)

  -- Swap tracking
  is_original BOOLEAN DEFAULT TRUE,  -- FALSE if this was swapped in
  swapped_from_meal_id UUID REFERENCES meals(id),  -- What was here before
  swapped_at TIMESTAMP WITH TIME ZONE,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_meal_plan_meals_plan_id ON meal_plan_meals(meal_plan_id);
CREATE INDEX idx_meal_plan_meals_meal_id ON meal_plan_meals(meal_id);
CREATE INDEX idx_meal_plan_meals_day ON meal_plan_meals(meal_plan_id, day);
CREATE INDEX idx_meal_plan_meals_type ON meal_plan_meals(meal_plan_id, meal_type);

-- Unique constraint: one meal per slot
-- Each combination of meal_plan + day + meal_type + snack_number must be unique
CREATE UNIQUE INDEX idx_meal_plan_meals_slot_unique
  ON meal_plan_meals(meal_plan_id, day, meal_type, COALESCE(snack_number, 0));

-- Trigger for updated_at
CREATE TRIGGER trigger_meal_plan_meals_updated_at
  BEFORE UPDATE ON meal_plan_meals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE meal_plan_meals ENABLE ROW LEVEL SECURITY;

-- Users can view meal_plan_meals for their own meal plans
CREATE POLICY "Users can view own meal plan meals"
  ON meal_plan_meals FOR SELECT
  USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- Users can insert meal_plan_meals for their own meal plans
CREATE POLICY "Users can insert own meal plan meals"
  ON meal_plan_meals FOR INSERT
  WITH CHECK (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- Users can update meal_plan_meals for their own meal plans
CREATE POLICY "Users can update own meal plan meals"
  ON meal_plan_meals FOR UPDATE
  USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- Users can delete meal_plan_meals for their own meal plans
CREATE POLICY "Users can delete own meal plan meals"
  ON meal_plan_meals FOR DELETE
  USING (
    meal_plan_id IN (
      SELECT id FROM meal_plans WHERE user_id = auth.uid()
    )
  );

-- Service role can do anything
CREATE POLICY "Service role full access on meal_plan_meals"
  ON meal_plan_meals FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON meal_plan_meals TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_plan_meals TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE meal_plan_meals IS 'Junction table linking meals to meal plan slots. Enables meal swapping by updating meal_id.';
COMMENT ON COLUMN meal_plan_meals.snack_number IS 'For snack meal_type only: 1, 2, 3 etc for multiple snacks per day. NULL for breakfast/lunch/dinner.';
COMMENT ON COLUMN meal_plan_meals.is_original IS 'FALSE if this meal slot has been swapped from its original generated meal.';
COMMENT ON COLUMN meal_plan_meals.swapped_from_meal_id IS 'If swapped, references the original meal that was in this slot.';
