-- Migration: Allow viewing shared meal photos
-- ============================================
-- Updates the storage policy for meal-photos bucket to allow authenticated users
-- to view any photo in the bucket (needed for community feed cooked meal photos).
-- Users can still only upload/update/delete their own photos.
-- ============================================

-- Drop the restrictive SELECT policy
DROP POLICY IF EXISTS "Users can view own meal photos" ON storage.objects;

-- Create new permissive SELECT policy for all authenticated users
CREATE POLICY "Users can view meal photos"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'meal-photos');
