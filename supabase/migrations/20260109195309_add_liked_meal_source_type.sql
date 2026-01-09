-- Add support for liked_meal source type in social_feed_posts
-- This enables auto-sharing of individually liked meals from meal plans

-- Update the source_type check constraint to include liked_meal
ALTER TABLE social_feed_posts DROP CONSTRAINT IF EXISTS social_feed_posts_source_type_check;

ALTER TABLE social_feed_posts ADD CONSTRAINT social_feed_posts_source_type_check
    CHECK (source_type IN ('custom_meal', 'favorited_meal', 'quick_cook', 'party_meal', 'liked_meal'));

-- Create unique index for liked_meal posts (one post per user per meal)
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_feed_posts_liked_meal
    ON social_feed_posts(user_id, source_type, source_meals_table_id)
    WHERE source_type = 'liked_meal' AND source_meals_table_id IS NOT NULL;
