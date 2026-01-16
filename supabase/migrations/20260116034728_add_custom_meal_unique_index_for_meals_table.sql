-- Add unique index for custom_meal source type using source_meals_table_id
-- This is needed because custom meals now use the meals table instead of validated_meals_by_user
-- The existing idx_social_feed_posts_custom_meal uses source_meal_id which references the old table

CREATE UNIQUE INDEX IF NOT EXISTS idx_social_feed_posts_custom_meal_v2
    ON social_feed_posts(user_id, source_type, source_meals_table_id)
    WHERE source_type = 'custom_meal' AND source_meals_table_id IS NOT NULL;
