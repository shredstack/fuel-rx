-- Enable Realtime on user_subscriptions table
-- This allows the UI to automatically update when subscription status changes
-- (e.g., when a cancellation webhook is processed)
ALTER PUBLICATION supabase_realtime ADD TABLE user_subscriptions;
