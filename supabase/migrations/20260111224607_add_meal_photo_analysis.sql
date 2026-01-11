-- Migration: Add Meal Photo Analysis
-- ============================================
-- Enables "Snap a Meal" feature - photo-based food logging with AI analysis
-- ============================================

-- ============================================
-- Table 1: meal_photos
-- ============================================
-- Stores uploaded meal photos with analysis results

CREATE TABLE meal_photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,

  -- Storage reference
  storage_path TEXT NOT NULL,  -- Path in Supabase storage bucket
  image_url TEXT NOT NULL,     -- Public/signed URL for display

  -- Analysis status
  analysis_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (analysis_status IN ('pending', 'analyzing', 'completed', 'failed')),
  analysis_error TEXT,
  analyzed_at TIMESTAMP WITH TIME ZONE,

  -- Raw AI response (for debugging/reprocessing)
  raw_analysis JSONB,

  -- Parsed results
  meal_name TEXT,
  meal_description TEXT,
  total_calories INTEGER,
  total_protein DECIMAL,
  total_carbs DECIMAL,
  total_fat DECIMAL,
  confidence_score DECIMAL,  -- 0-1 overall confidence

  -- Links to consumption/library (set after user saves)
  consumption_entry_id UUID REFERENCES meal_consumption_log(id) ON DELETE SET NULL,
  saved_meal_id UUID REFERENCES meals(id) ON DELETE SET NULL,

  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meal_photos_user ON meal_photos(user_id, created_at DESC);
CREATE INDEX idx_meal_photos_status ON meal_photos(user_id, analysis_status);

-- Trigger for updated_at
CREATE TRIGGER trigger_meal_photos_updated_at
  BEFORE UPDATE ON meal_photos
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- RLS
ALTER TABLE meal_photos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own photos"
  ON meal_photos FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own photos"
  ON meal_photos FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own photos"
  ON meal_photos FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "Users can delete own photos"
  ON meal_photos FOR DELETE
  USING (user_id = auth.uid());

-- Grants
GRANT ALL ON meal_photos TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_photos TO authenticated;

-- Comment
COMMENT ON TABLE meal_photos IS 'Stores uploaded meal photos with AI analysis results for Snap a Meal feature';


-- ============================================
-- Table 2: meal_photo_ingredients
-- ============================================
-- Stores ingredients extracted from photo analysis

CREATE TABLE meal_photo_ingredients (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  meal_photo_id UUID NOT NULL REFERENCES meal_photos(id) ON DELETE CASCADE,

  -- Ingredient details
  name TEXT NOT NULL,
  estimated_amount TEXT,      -- e.g., "1", "0.5"
  estimated_unit TEXT,        -- e.g., "cup", "oz", "medium"

  -- Estimated nutrition
  calories INTEGER NOT NULL DEFAULT 0,
  protein DECIMAL NOT NULL DEFAULT 0,
  carbs DECIMAL NOT NULL DEFAULT 0,
  fat DECIMAL NOT NULL DEFAULT 0,

  -- AI metadata
  confidence_score DECIMAL,   -- 0-1 for this ingredient
  category TEXT,              -- protein, vegetable, grain, etc.

  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_meal_photo_ingredients_photo ON meal_photo_ingredients(meal_photo_id);

-- RLS (inherits access via meal_photos)
ALTER TABLE meal_photo_ingredients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view ingredients from own photos"
  ON meal_photo_ingredients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM meal_photos
      WHERE meal_photos.id = meal_photo_ingredients.meal_photo_id
      AND meal_photos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert ingredients to own photos"
  ON meal_photo_ingredients FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM meal_photos
      WHERE meal_photos.id = meal_photo_ingredients.meal_photo_id
      AND meal_photos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update ingredients from own photos"
  ON meal_photo_ingredients FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM meal_photos
      WHERE meal_photos.id = meal_photo_ingredients.meal_photo_id
      AND meal_photos.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete ingredients from own photos"
  ON meal_photo_ingredients FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM meal_photos
      WHERE meal_photos.id = meal_photo_ingredients.meal_photo_id
      AND meal_photos.user_id = auth.uid()
    )
  );

-- Grants
GRANT ALL ON meal_photo_ingredients TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON meal_photo_ingredients TO authenticated;

-- Comment
COMMENT ON TABLE meal_photo_ingredients IS 'Stores ingredients extracted from meal photo AI analysis';


-- ============================================
-- Update meals table for photo-analyzed source type
-- ============================================

-- Update the source_type check constraint to include photo_analyzed
ALTER TABLE meals DROP CONSTRAINT IF EXISTS meals_source_type_check;

ALTER TABLE meals ADD CONSTRAINT meals_source_type_check
  CHECK (source_type IN ('ai_generated', 'user_created', 'community_shared', 'quick_cook', 'party_meal', 'photo_analyzed'));

-- Add column to link saved meals back to source photo
ALTER TABLE meals ADD COLUMN IF NOT EXISTS source_photo_id UUID REFERENCES meal_photos(id) ON DELETE SET NULL;

-- Index for finding meals by source photo
CREATE INDEX IF NOT EXISTS idx_meals_source_photo ON meals(source_photo_id) WHERE source_photo_id IS NOT NULL;

-- Update comment
COMMENT ON COLUMN meals.source_type IS 'How this meal was created: ai_generated (weekly meal plan), user_created (manual entry), community_shared (copied from another user), quick_cook (Quick Cook single meal), party_meal (Quick Cook party mode), photo_analyzed (from Snap a Meal photo)';


-- ============================================
-- Update meal_consumption_log entry_type for photo meals
-- ============================================

-- Update the entry_type check constraint to include photo_meal
ALTER TABLE meal_consumption_log DROP CONSTRAINT IF EXISTS meal_consumption_log_entry_type_check;

ALTER TABLE meal_consumption_log ADD CONSTRAINT meal_consumption_log_entry_type_check
  CHECK (entry_type IN ('meal_plan', 'custom_meal', 'quick_cook', 'ingredient', 'photo_meal'));

-- Add column to link consumption entries back to source photo
ALTER TABLE meal_consumption_log ADD COLUMN IF NOT EXISTS source_photo_id UUID REFERENCES meal_photos(id) ON DELETE SET NULL;

-- Index for finding consumption entries by source photo
CREATE INDEX IF NOT EXISTS idx_consumption_source_photo ON meal_consumption_log(source_photo_id) WHERE source_photo_id IS NOT NULL;
