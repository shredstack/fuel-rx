-- Migration: Add Admin Fields and Audit Log
-- Enables admin functionality for managing ingredients and tracking changes

-- ============================================
-- 1. Add is_admin to user_profiles
-- ============================================

ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT FALSE;

-- Create index for admin lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_is_admin ON user_profiles(is_admin) WHERE is_admin = TRUE;

-- ============================================
-- 2. Add validated field to ingredients table
-- ============================================

ALTER TABLE ingredients ADD COLUMN IF NOT EXISTS validated BOOLEAN DEFAULT FALSE;

-- Add index on is_user_added for filtering
CREATE INDEX IF NOT EXISTS idx_ingredients_is_user_added ON ingredients(is_user_added);

-- Add index on validated for filtering
CREATE INDEX IF NOT EXISTS idx_ingredients_validated ON ingredients(validated);

-- ============================================
-- 3. Create admin audit log table
-- ============================================

CREATE TABLE IF NOT EXISTS admin_audit_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  admin_user_id UUID NOT NULL REFERENCES auth.users(id),
  action TEXT NOT NULL, -- 'update_ingredient', 'update_nutrition', 'bulk_update_category', 'bulk_update_validated'
  entity_type TEXT NOT NULL, -- 'ingredient', 'ingredient_nutrition'
  entity_id UUID NOT NULL,
  changes JSONB NOT NULL, -- { field: { old: value, new: value } }
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for querying audit log
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_entity ON admin_audit_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_admin ON admin_audit_log(admin_user_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_log_created ON admin_audit_log(created_at DESC);

-- RLS for audit log
ALTER TABLE admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can view audit log
CREATE POLICY "Admins can view audit log"
ON admin_audit_log FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = TRUE
  )
);

-- Service role can insert audit log entries
CREATE POLICY "Service role can insert audit log"
ON admin_audit_log FOR INSERT
WITH CHECK (true);

-- Grant permissions
GRANT ALL ON admin_audit_log TO postgres, service_role;
GRANT SELECT ON admin_audit_log TO authenticated;

-- ============================================
-- 4. RLS policies for admin updates on ingredients
-- ============================================

-- Allow admins to update ingredients
CREATE POLICY "Admins can update ingredients"
ON ingredients FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = TRUE
  )
);

-- Allow admins to update ingredient_nutrition
CREATE POLICY "Admins can update ingredient_nutrition"
ON ingredient_nutrition FOR UPDATE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = TRUE
  )
);

-- ============================================
-- 5. Update ingredient_nutrition_with_details view
--    to include validated field from ingredients
-- ============================================

DROP VIEW IF EXISTS ingredient_nutrition_with_details;

CREATE VIEW ingredient_nutrition_with_details AS
SELECT
  n.id,
  n.ingredient_id,
  i.name AS ingredient_name,
  i.name_normalized,
  i.category,
  i.validated AS ingredient_validated,
  i.is_user_added,
  i.added_by_user_id,
  i.added_at,
  n.serving_size,
  n.serving_unit,
  n.calories,
  n.protein,
  n.carbs,
  n.fat,
  n.fiber,
  n.sugar,
  n.sodium,
  n.source,
  n.confidence_score,
  n.barcode,
  n.created_at,
  n.updated_at
FROM ingredient_nutrition n
JOIN ingredients i ON n.ingredient_id = i.id;

GRANT SELECT ON ingredient_nutrition_with_details TO authenticated;

-- ============================================
-- 6. Add admins
-- ============================================

UPDATE user_profiles SET is_admin = true WHERE id = '6ec02c3f-9093-4171-8b6b-f38fa257967a';


