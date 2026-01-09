-- Add support for quick_cook and party_meal source types in social_feed_posts
-- This enables auto-sharing of quick cook meals and party plans for community-enabled users

-- Update the source_type check constraint to allow new types
ALTER TABLE social_feed_posts DROP CONSTRAINT IF EXISTS social_feed_posts_source_type_check;

ALTER TABLE social_feed_posts ADD CONSTRAINT social_feed_posts_source_type_check
    CHECK (source_type IN ('custom_meal', 'favorited_meal', 'quick_cook', 'party_meal'));

-- Add party_data column to store party plan details for party_meal posts
ALTER TABLE social_feed_posts ADD COLUMN IF NOT EXISTS party_data JSONB;

-- Add source_meal_id_new to reference the new meals table (for quick_cook and party_meal)
-- The existing source_meal_id references validated_meals_by_user (legacy)
ALTER TABLE social_feed_posts ADD COLUMN IF NOT EXISTS source_meals_table_id UUID REFERENCES meals(id) ON DELETE CASCADE;

-- Create unique indexes for the new source types
CREATE UNIQUE INDEX IF NOT EXISTS idx_social_feed_posts_quick_cook
    ON social_feed_posts(user_id, source_type, source_meals_table_id)
    WHERE source_type = 'quick_cook' AND source_meals_table_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_feed_posts_party_meal
    ON social_feed_posts(user_id, source_type, source_meals_table_id)
    WHERE source_type = 'party_meal' AND source_meals_table_id IS NOT NULL;

-- Add index on source_meals_table_id for efficient lookups
CREATE INDEX IF NOT EXISTS idx_social_feed_posts_source_meals_table_id
    ON social_feed_posts(source_meals_table_id)
    WHERE source_meals_table_id IS NOT NULL;

-- Add comment explaining the columns
COMMENT ON COLUMN social_feed_posts.source_meals_table_id IS 'References meals table for quick_cook and party_meal types';
COMMENT ON COLUMN social_feed_posts.party_data IS 'Stores party prep guide data for party_meal posts (dishes, timeline, shopping list, etc)';
