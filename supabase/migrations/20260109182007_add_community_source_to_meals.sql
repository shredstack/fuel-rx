-- Add source_community_post_id to meals table
-- This tracks when a meal was saved from the community feed

ALTER TABLE meals ADD COLUMN IF NOT EXISTS source_community_post_id UUID REFERENCES social_feed_posts(id) ON DELETE SET NULL;

-- Add index for efficient lookup
CREATE INDEX IF NOT EXISTS idx_meals_source_community_post_id ON meals(source_community_post_id) WHERE source_community_post_id IS NOT NULL;

COMMENT ON COLUMN meals.source_community_post_id IS 'If this meal was saved from the community feed, references the original post';
