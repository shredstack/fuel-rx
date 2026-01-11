-- Migration: Add user-added ingredient tracking
-- ============================================
-- Allows tracking which ingredients were added by users vs. FuelRx system
-- Also adds barcode field for barcode-scanned products
-- ============================================

-- Add user-added tracking columns to ingredients table
ALTER TABLE ingredients
ADD COLUMN IF NOT EXISTS is_user_added BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS added_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();

-- Add index for querying user-added ingredients
CREATE INDEX IF NOT EXISTS idx_ingredients_user_added
ON ingredients(is_user_added) WHERE is_user_added = TRUE;

CREATE INDEX IF NOT EXISTS idx_ingredients_added_by_user
ON ingredients(added_by_user_id) WHERE added_by_user_id IS NOT NULL;

-- Add barcode field to ingredient_nutrition for barcode-scanned products
ALTER TABLE ingredient_nutrition
ADD COLUMN IF NOT EXISTS barcode TEXT;

-- Index for barcode lookups
CREATE INDEX IF NOT EXISTS idx_ingredient_nutrition_barcode
ON ingredient_nutrition(barcode) WHERE barcode IS NOT NULL;

-- Update RLS policy to allow authenticated users to insert user-added ingredients
-- (existing policy only allows service role to insert)
DROP POLICY IF EXISTS "Authenticated users can insert user-added ingredients" ON ingredients;

CREATE POLICY "Authenticated users can insert user-added ingredients"
ON ingredients FOR INSERT
TO authenticated
WITH CHECK (
  is_user_added = TRUE
  AND added_by_user_id = auth.uid()
);

-- Allow users to view all ingredients (including user-added ones from other users)
-- This policy should already exist but let's make sure
DROP POLICY IF EXISTS "Anyone can view ingredients" ON ingredients;

CREATE POLICY "Anyone can view ingredients"
ON ingredients FOR SELECT
TO authenticated
USING (TRUE);

-- Add is_user_added tracking to user_frequent_ingredients
-- so we know when a frequent ingredient came from a user-added source
ALTER TABLE user_frequent_ingredients
ADD COLUMN IF NOT EXISTS is_user_added BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS ingredient_id UUID REFERENCES ingredients(id) ON DELETE SET NULL;

-- Comment explaining the is_user_added field
COMMENT ON COLUMN ingredients.is_user_added IS 'TRUE if this ingredient was added by a user (not FuelRx validated). User-added ingredients may have less accurate nutrition data.';
COMMENT ON COLUMN ingredients.added_by_user_id IS 'The user who added this ingredient (NULL for system-added ingredients)';
COMMENT ON COLUMN ingredient_nutrition.barcode IS 'Product barcode (UPC/EAN) for barcode-scanned products';
