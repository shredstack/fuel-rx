-- Enable Realtime subscriptions for cross-device synchronization
-- This allows clients to subscribe to changes and keep UI in sync across devices

-- Consumption log - for tracking meals logged across devices
ALTER PUBLICATION supabase_realtime ADD TABLE meal_consumption_log;

-- Meal plans - for when meal plan generation completes or plans are modified
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plans;

-- Meal plan meals - for individual meal updates within a plan
ALTER PUBLICATION supabase_realtime ADD TABLE meal_plan_meals;

-- Social feed posts - for community post updates (new posts, likes, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE social_feed_posts;

-- User grocery staples - for syncing staples across devices
ALTER PUBLICATION supabase_realtime ADD TABLE user_grocery_staples;

-- Ingredients - for admin updates to ingredient data (nutrition info, etc.)
ALTER PUBLICATION supabase_realtime ADD TABLE ingredients;
