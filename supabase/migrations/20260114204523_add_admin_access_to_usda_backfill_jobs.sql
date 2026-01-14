-- Migration: Add admin access to usda_backfill_jobs table
-- ============================================
-- The original migration only allowed service_role access, but API routes
-- use authenticated clients. This adds policies for admin users.
-- ============================================

-- Allow admins to insert their own job records
CREATE POLICY "Admins can insert usda_backfill_jobs"
  ON usda_backfill_jobs FOR INSERT
  WITH CHECK (
    auth.uid() = admin_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Allow admins to select their own job records
CREATE POLICY "Admins can select usda_backfill_jobs"
  ON usda_backfill_jobs FOR SELECT
  USING (
    auth.uid() = admin_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Allow admins to update their own job records
CREATE POLICY "Admins can update usda_backfill_jobs"
  ON usda_backfill_jobs FOR UPDATE
  USING (
    auth.uid() = admin_user_id
    AND EXISTS (
      SELECT 1 FROM user_profiles
      WHERE user_profiles.id = auth.uid()
      AND user_profiles.is_admin = true
    )
  );

-- Grant authenticated users ability to interact with the table
GRANT SELECT, INSERT, UPDATE ON usda_backfill_jobs TO authenticated;
