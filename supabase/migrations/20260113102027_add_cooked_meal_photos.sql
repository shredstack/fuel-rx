-- Migration: Add cooked meal photos and community sharing
-- ============================================
-- Adds ability for users to upload a photo when marking a meal as cooked,
-- with an option to share to the community feed.
-- ============================================

-- ============================================
-- Part 1: Add photo and sharing columns to cooking status tables
-- ============================================

ALTER TABLE meal_plan_meal_cooking_status
  ADD COLUMN cooked_photo_url TEXT,
  ADD COLUMN share_with_community BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN meal_plan_meal_cooking_status.cooked_photo_url IS 'URL to the photo of the cooked meal';
COMMENT ON COLUMN meal_plan_meal_cooking_status.share_with_community IS 'Whether to share this cooked meal to the community feed';

ALTER TABLE saved_meal_cooking_status
  ADD COLUMN cooked_photo_url TEXT,
  ADD COLUMN share_with_community BOOLEAN DEFAULT TRUE;

COMMENT ON COLUMN saved_meal_cooking_status.cooked_photo_url IS 'URL to the photo of the cooked meal';
COMMENT ON COLUMN saved_meal_cooking_status.share_with_community IS 'Whether to share this cooked meal to the community feed';

-- ============================================
-- Part 2: Add user_notes and cooked_photo_url to social_feed_posts
-- ============================================

ALTER TABLE social_feed_posts
  ADD COLUMN user_notes TEXT,
  ADD COLUMN cooked_photo_url TEXT;

COMMENT ON COLUMN social_feed_posts.user_notes IS 'Notes from the user about cooking this meal';
COMMENT ON COLUMN social_feed_posts.cooked_photo_url IS 'Photo taken when the meal was cooked';

-- ============================================
-- Part 3: Update source_type constraint to include 'cooked_meal'
-- ============================================

-- Drop the existing constraint
ALTER TABLE social_feed_posts
  DROP CONSTRAINT IF EXISTS social_feed_posts_source_type_check;

-- Add updated constraint with 'cooked_meal' option
ALTER TABLE social_feed_posts
  ADD CONSTRAINT social_feed_posts_source_type_check
  CHECK (source_type IN ('custom_meal', 'favorited_meal', 'liked_meal', 'quick_cook', 'party_meal', 'cooked_meal'));

-- ============================================
-- Part 4: Add index for efficient querying of cooked meals in feed
-- ============================================

CREATE INDEX idx_social_feed_posts_cooked_meal
  ON social_feed_posts(source_type, created_at DESC)
  WHERE source_type = 'cooked_meal';
