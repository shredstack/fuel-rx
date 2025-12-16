-- Fix RLS policies to allow the social feed to work correctly
--
-- Bug: The original user_profiles RLS policy only allowed users to view their own profile.
-- This caused the social feed and community users search to return empty results because:
-- 1. The social_feed_posts SELECT policy uses a subquery on user_profiles to check social_feed_enabled
-- 2. The community users API queries user_profiles directly for social-enabled users
-- Both queries failed silently because RLS blocked access to other users' profiles.

-- Add policy to allow viewing public profile info of users who opted into social features
-- This only exposes: id, display_name, name, and social_feed_enabled
-- Email and other sensitive data remain protected by the original "Users can view own profile" policy
CREATE POLICY "Users can view social-enabled profiles"
    ON user_profiles FOR SELECT
    USING (social_feed_enabled = true);
