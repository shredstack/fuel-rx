-- Migration: Create meal-images storage bucket
-- =============================================
-- Storage bucket for custom meal image uploads
-- Note: This bucket may already exist in production (was created manually)
-- All statements are idempotent to prevent deployment failures
-- =============================================

-- Create the meal-images bucket (public for displaying in UI)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-images',
  'meal-images',
  true,  -- Public bucket for meal display
  5242880,  -- 5MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Drop existing policies if they exist (for idempotency)
DROP POLICY IF EXISTS "Users can upload meal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can update own meal images" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own meal images" ON storage.objects;
DROP POLICY IF EXISTS "Public read access for meal images" ON storage.objects;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload meal images"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Anyone can view meal images (public display)
CREATE POLICY "Public read access for meal images"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'meal-images');

-- Policy: Users can update their own images
CREATE POLICY "Users can update own meal images"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own images
CREATE POLICY "Users can delete own meal images"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-images'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
