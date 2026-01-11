-- Migration: Create meal-photos storage bucket
-- ============================================
-- Storage bucket for Snap a Meal photo uploads
-- ============================================

-- Create the meal-photos bucket (private by default)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'meal-photos',
  'meal-photos',
  false,  -- Private bucket
  10485760,  -- 10MB max file size
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can upload to their own folder
CREATE POLICY "Users can upload meal photos to own folder"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can view their own photos
CREATE POLICY "Users can view own meal photos"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can update their own photos
CREATE POLICY "Users can update own meal photos"
ON storage.objects FOR UPDATE
TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);

-- Policy: Users can delete their own photos
CREATE POLICY "Users can delete own meal photos"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'meal-photos'
  AND (storage.foldername(name))[1] = auth.uid()::text
);
