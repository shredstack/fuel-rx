-- Migration: Add extended fields for Quick Cook meals
-- ============================================
-- Adds additional fields to support the rich data from single meal and party meal generation
-- Single meals: emoji, description, cook_time_minutes, servings, tips
-- Party meals: full party_data JSONB for timeline, shopping list, dishes, etc.
-- ============================================

-- Add emoji column for single meals (e.g., "🍳")
ALTER TABLE meals ADD COLUMN IF NOT EXISTS emoji TEXT;

-- Add description column for single meals (brief description of the meal)
ALTER TABLE meals ADD COLUMN IF NOT EXISTS description TEXT;

-- Add cook_time_minutes for single meals (separate from prep_time)
ALTER TABLE meals ADD COLUMN IF NOT EXISTS cook_time_minutes INTEGER;

-- Add servings count for single meals
ALTER TABLE meals ADD COLUMN IF NOT EXISTS servings INTEGER;

-- Add tips array for single meals (pro tips from the LLM)
ALTER TABLE meals ADD COLUMN IF NOT EXISTS tips JSONB DEFAULT '[]'::jsonb;
-- Structure: ["Tip 1...", "Tip 2..."]

-- Add party_data JSONB for party meals (stores the full PartyPrepGuide structure)
-- This is a flexible JSONB column that stores the complete party guide data:
-- {
--   dishes: [{ name, role, description }],
--   timeline: { days_before?, day_of_morning?, hours_before?, right_before? },
--   shopping_list: [{ item, quantity, notes? }],
--   pro_tips: ["tip1", "tip2"],
--   estimated_total_prep_time: "2 hours",
--   estimated_active_time: "45 minutes"
-- }
ALTER TABLE meals ADD COLUMN IF NOT EXISTS party_data JSONB;

-- Update the meal_type constraint to make it optional for party meals
-- Party meals don't have a single meal_type, they contain multiple dishes
ALTER TABLE meals ALTER COLUMN meal_type DROP NOT NULL;

-- Add comments for documentation
COMMENT ON COLUMN meals.emoji IS 'Visual emoji representing the meal (for Quick Cook single meals)';
COMMENT ON COLUMN meals.description IS 'Brief description of the meal (for Quick Cook single meals)';
COMMENT ON COLUMN meals.cook_time_minutes IS 'Active cooking time in minutes (separate from prep time)';
COMMENT ON COLUMN meals.servings IS 'Number of servings the recipe makes';
COMMENT ON COLUMN meals.tips IS 'Array of pro tips for the meal';
COMMENT ON COLUMN meals.party_data IS 'Full party guide data for party_meal source type (dishes, timeline, shopping_list, pro_tips, etc.)';
