-- Backfill existing shared meals into social_feed_posts
--
-- Bug: Existing meals with share_with_community=true were never added to social_feed_posts.
-- The social_feed_posts table only gets populated on meal create/update via the API,
-- so meals shared before migration 008 never appeared in the feed.

-- Backfill: Insert existing shared meals into social_feed_posts
-- Only for users who have social_feed_enabled = true
INSERT INTO social_feed_posts (
    user_id,
    source_type,
    source_meal_id,
    meal_name,
    calories,
    protein,
    carbs,
    fat,
    image_url,
    prep_time,
    ingredients,
    created_at
)
SELECT
    m.user_id,
    'custom_meal' AS source_type,
    m.id AS source_meal_id,
    m.meal_name,
    m.calories,
    m.protein,
    m.carbs,
    m.fat,
    m.image_url,
    m.prep_time,
    m.ingredients,
    m.created_at
FROM validated_meals_by_user m
JOIN user_profiles p ON m.user_id = p.id
WHERE m.share_with_community = true
  AND p.social_feed_enabled = true
ON CONFLICT DO NOTHING;
