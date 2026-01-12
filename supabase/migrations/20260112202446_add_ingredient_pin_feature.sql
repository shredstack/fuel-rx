-- Migration: Add ingredient pin (favorites) feature
-- ============================================
-- Allows users to pin/favorite ingredients for quick access

-- Add is_pinned column to user_frequent_ingredients
ALTER TABLE user_frequent_ingredients
ADD COLUMN is_pinned BOOLEAN DEFAULT false;

-- Create index for faster pinned ingredient queries
CREATE INDEX idx_frequent_ingredients_pinned ON user_frequent_ingredients(user_id, is_pinned)
WHERE is_pinned = true;

-- Comment
COMMENT ON COLUMN user_frequent_ingredients.is_pinned IS 'Whether the user has pinned this ingredient as a favorite for quick access';
