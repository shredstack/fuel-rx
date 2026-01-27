-- Migration: Create profile-photos storage bucket
-- ================================================
-- Storage bucket for user profile photo uploads
-- Note: This bucket may already exist in production (was created manually)
-- All statements are idempotent to prevent deployment failures
-- ================================================

-- Create the profile-photos bucket (public for avatar display)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'profile-photos',
  'profile-photos',
  true,  -- Public bucket for profile avatars
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotency)
-- Include both production names and new names to ensure clean slate
DROP POLICY IF EXISTS "Users can upload profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload profile photos to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Anyone can view profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own profile photos" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own profile photos" ON storage.objects;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload profile photos to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone can view profile photos (public avatars)
CREATE POLICY "Anyone can view profile photos"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'profile-photos');

-- Policy: Users can update their own photos
CREATE POLICY "Users can update own profile photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete own profile photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'profile-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
