-- Migration: Simplify usda_backfill_jobs RLS policies
-- ============================================
-- The previous policy required admin_user_id = auth.uid() which is too strict
-- since the API already validates admin status before inserting.
-- This simplified policy just checks that the user is an admin.
-- ============================================

-- Drop the existing policies
DROP POLICY IF EXISTS "Admins can insert usda_backfill_jobs" ON usda_backfill_jobs;
DROP POLICY IF EXISTS "Admins can select usda_backfill_jobs" ON usda_backfill_jobs;
DROP POLICY IF EXISTS "Admins can update usda_backfill_jobs" ON usda_backfill_jobs;

-- Simpler policies - any admin can do any operation
CREATE POLICY "Admins can manage usda_backfill_jobs"
  ON usda_backfill_jobs FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );
