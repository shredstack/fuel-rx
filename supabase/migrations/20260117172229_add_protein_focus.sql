-- ============================================
-- Add protein_focus column to meal_plans table
-- ============================================
--
-- This stores the protein focus constraint used during generation.
-- Stored as JSONB to allow flexible schema evolution.
-- NULL means no protein focus was used.

ALTER TABLE meal_plans
ADD COLUMN protein_focus JSONB DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN meal_plans.protein_focus IS
  'Optional protein focus constraint used during generation. Schema: {mealType, protein, count, varyCuisines}';

-- Index for potential future querying (e.g., "show me all my shrimp weeks")
CREATE INDEX idx_meal_plans_protein_focus
ON meal_plans USING GIN (protein_focus)
WHERE protein_focus IS NOT NULL;

-- ============================================
-- Create protein_focus_history table
-- ============================================
--
-- Tracks which proteins users have focused on before.
-- Used to populate the "Recent" section in the protein picker.

CREATE TABLE protein_focus_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  protein TEXT NOT NULL,
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),
  used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),

  -- One entry per user/protein/meal_type combo, updated on reuse
  UNIQUE(user_id, protein, meal_type)
);

-- Index for fetching recent proteins
CREATE INDEX idx_protein_focus_history_user_recent
ON protein_focus_history(user_id, used_at DESC);

-- Enable RLS
ALTER TABLE protein_focus_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own protein history"
  ON protein_focus_history FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own protein history"
  ON protein_focus_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own protein history"
  ON protein_focus_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Grant permissions
GRANT ALL ON protein_focus_history TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE ON protein_focus_history TO authenticated;
