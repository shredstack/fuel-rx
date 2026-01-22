-- Add store column to track where the subscription was purchased
-- This enables routing users to the correct subscription management portal
ALTER TABLE user_subscriptions
ADD COLUMN store TEXT CHECK (store IS NULL OR store IN ('APP_STORE', 'PLAY_STORE', 'STRIPE', 'PROMOTIONAL'));

-- Add comment for clarity
COMMENT ON COLUMN user_subscriptions.store IS 'Payment provider: APP_STORE, PLAY_STORE, STRIPE, or PROMOTIONAL';
