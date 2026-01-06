-- Migration: Create meals table
-- ============================================
-- This table stores normalized meal data, replacing embedded JSONB in meal_plans.plan_data
-- Meals can be AI-generated, user-created, or shared from community
-- ============================================

CREATE TABLE meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),

  -- Identity
  name TEXT NOT NULL,
  name_normalized TEXT NOT NULL,  -- lowercase, trimmed for dedup matching

  -- Meal classification
  meal_type TEXT NOT NULL CHECK (meal_type IN ('breakfast', 'lunch', 'dinner', 'snack')),

  -- Content (JSONB for flexibility)
  -- Ingredients include inline nutrition (copied from ingredient_nutrition cache at creation time)
  ingredients JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: [{ name, amount, unit, category, calories, protein, carbs, fat }]

  instructions JSONB NOT NULL DEFAULT '[]'::jsonb,
  -- Structure: ["Step 1...", "Step 2..."]

  -- Macros (denormalized for query performance - sum of ingredient macros)
  calories INTEGER NOT NULL,
  protein DECIMAL NOT NULL,
  carbs DECIMAL NOT NULL,
  fat DECIMAL NOT NULL,

  -- Prep info
  prep_time_minutes INTEGER NOT NULL DEFAULT 15,
  prep_instructions TEXT,  -- Optional additional prep notes

  -- === USER FLAGS (migrated from validated_meals_by_user) ===
  -- TRUE if user manually created this meal in "My Meals"
  is_user_created BOOLEAN DEFAULT FALSE,
  -- TRUE if user edited the nutrition facts (overriding LLM estimates)
  is_nutrition_edited_by_user BOOLEAN DEFAULT FALSE,

  -- Source tracking
  source_type TEXT NOT NULL DEFAULT 'ai_generated'
    CHECK (source_type IN ('ai_generated', 'user_created', 'community_shared')),
  source_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  source_meal_plan_id UUID,  -- Which plan first generated this meal (for AI meals)

  -- Sharing & visibility (for community features)
  is_public BOOLEAN DEFAULT FALSE,  -- TRUE = shared with community

  -- Theme association (optional, for AI-generated meals)
  theme_id UUID REFERENCES meal_plan_themes(id) ON DELETE SET NULL,
  theme_name TEXT,  -- Denormalized for display

  -- Analytics
  times_used INTEGER DEFAULT 1,
  times_swapped_in INTEGER DEFAULT 0,
  times_swapped_out INTEGER DEFAULT 0,

  -- Media
  image_url TEXT,

  -- Timestamps
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_meals_name_normalized ON meals(name_normalized);
CREATE INDEX idx_meals_source_user_id ON meals(source_user_id);
CREATE INDEX idx_meals_is_public ON meals(is_public) WHERE is_public = TRUE;
CREATE INDEX idx_meals_meal_type ON meals(meal_type);
CREATE INDEX idx_meals_theme_id ON meals(theme_id);
CREATE INDEX idx_meals_macros ON meals(calories, protein);
CREATE INDEX idx_meals_user_created ON meals(source_user_id, is_user_created) WHERE is_user_created = TRUE;

-- Unique constraint for deduplication (within user scope)
-- We allow same name for different users
CREATE UNIQUE INDEX idx_meals_user_name_unique
  ON meals(source_user_id, name_normalized)
  WHERE source_type IN ('user_created', 'ai_generated');

-- Trigger for updated_at
CREATE TRIGGER trigger_meals_updated_at
  BEFORE UPDATE ON meals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable RLS
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

-- Everyone can view public meals
CREATE POLICY "Anyone can view public meals"
  ON meals FOR SELECT
  USING (is_public = TRUE);

-- Users can view their own meals
CREATE POLICY "Users can view own meals"
  ON meals FOR SELECT
  USING (source_user_id = auth.uid());

-- Users can insert their own meals
CREATE POLICY "Users can insert own meals"
  ON meals FOR INSERT
  WITH CHECK (source_user_id = auth.uid() OR source_user_id IS NULL);

-- Users can update their own meals
CREATE POLICY "Users can update own meals"
  ON meals FOR UPDATE
  USING (source_user_id = auth.uid());

-- Users can delete their own meals
CREATE POLICY "Users can delete own meals"
  ON meals FOR DELETE
  USING (source_user_id = auth.uid());

-- Service role can do anything (for LLM generation)
CREATE POLICY "Service role full access"
  ON meals FOR ALL
  USING (auth.role() = 'service_role');

-- Grant permissions
GRANT ALL ON meals TO postgres, service_role;
GRANT SELECT ON meals TO authenticated;
GRANT INSERT, UPDATE, DELETE ON meals TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE meals IS 'Normalized meal storage. Meals are entities that can be linked to multiple meal plans via meal_plan_meals junction table.';
COMMENT ON COLUMN meals.name_normalized IS 'Lowercase, trimmed meal name for deduplication matching';
COMMENT ON COLUMN meals.is_user_created IS 'TRUE if user manually created this meal in My Meals section';
COMMENT ON COLUMN meals.is_nutrition_edited_by_user IS 'TRUE if user edited the nutrition facts (overriding LLM estimates)';
COMMENT ON COLUMN meals.source_type IS 'How this meal was created: ai_generated, user_created, or community_shared';
