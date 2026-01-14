-- Migration: Fix Admin Ingredients Permissions
-- The ingredients table was missing UPDATE and DELETE grants for authenticated users.
-- RLS policies existed for admin updates, but without the base GRANT, they had no effect.

-- ============================================
-- 1. Grant UPDATE permission to authenticated users
--    (RLS policy already restricts this to admins only)
-- ============================================

GRANT UPDATE ON ingredients TO authenticated;

-- ============================================
-- 2. Grant DELETE permission to authenticated users
--    (Will add RLS policy to restrict to admins)
-- ============================================

GRANT DELETE ON ingredients TO authenticated;

-- ============================================
-- 3. Add DELETE policy for admins
-- ============================================

CREATE POLICY "Admins can delete ingredients"
ON ingredients FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = TRUE
  )
);

-- ============================================
-- 4. Also fix ingredient_nutrition permissions
--    (Currently only has SELECT for authenticated)
-- ============================================

GRANT UPDATE ON ingredient_nutrition TO authenticated;
GRANT DELETE ON ingredient_nutrition TO authenticated;

-- Add DELETE policy for admins on ingredient_nutrition
CREATE POLICY "Admins can delete ingredient_nutrition"
ON ingredient_nutrition FOR DELETE
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM user_profiles
    WHERE user_profiles.id = auth.uid()
    AND user_profiles.is_admin = TRUE
  )
);

-- ============================================
-- 5. Ensure admin_audit_log insert works for authenticated admins
-- ============================================

GRANT INSERT ON admin_audit_log TO authenticated;
