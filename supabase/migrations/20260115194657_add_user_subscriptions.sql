-- User subscriptions table for tracking subscription status and free tier usage
CREATE TABLE user_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,

    -- RevenueCat data
    revenuecat_customer_id TEXT,

    -- Subscription status
    is_subscribed BOOLEAN DEFAULT FALSE,
    subscription_tier TEXT CHECK (subscription_tier IS NULL OR subscription_tier IN ('basic_yearly', 'pro_monthly', 'pro_yearly')),
    subscription_status TEXT CHECK (subscription_status IS NULL OR subscription_status IN ('active', 'cancelled', 'expired', 'grace_period', 'billing_retry')),

    -- Feature access (computed from tier, but stored for quick checks)
    has_ai_features BOOLEAN DEFAULT FALSE,      -- Basic tier and above
    has_meal_plan_generation BOOLEAN DEFAULT FALSE,  -- Pro tier only

    -- Subscription dates
    current_period_start TIMESTAMPTZ,
    current_period_end TIMESTAMPTZ,
    original_purchase_date TIMESTAMPTZ,

    -- Free tier tracking
    free_plans_used INT NOT NULL DEFAULT 0,
    free_plan_limit INT NOT NULL DEFAULT 3,

    -- Manual override (for friends/testers)
    is_override BOOLEAN DEFAULT FALSE,
    override_reason TEXT,

    -- Metadata
    last_synced_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX idx_user_subscriptions_user_id ON user_subscriptions(user_id);
CREATE INDEX idx_user_subscriptions_revenuecat_id ON user_subscriptions(revenuecat_customer_id) WHERE revenuecat_customer_id IS NOT NULL;

-- Enable RLS
ALTER TABLE user_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only view their own subscription
CREATE POLICY "Users can view own subscription"
    ON user_subscriptions FOR SELECT
    USING (auth.uid() = user_id);

-- Service role has full access (for webhook updates)
CREATE POLICY "Service role full access"
    ON user_subscriptions FOR ALL
    USING (auth.role() = 'service_role');

-- Trigger to update updated_at
CREATE TRIGGER update_user_subscriptions_updated_at
    BEFORE UPDATE ON user_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();

-- Grant permissions
GRANT ALL ON user_subscriptions TO postgres, service_role;
GRANT SELECT ON user_subscriptions TO authenticated;

-- Create subscription records for existing users
INSERT INTO user_subscriptions (user_id, free_plans_used, free_plan_limit)
SELECT id, 0, 3 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM user_subscriptions);

-- Update handle_new_user function to also create subscription record
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Create user profile
    INSERT INTO public.user_profiles (id, email)
    VALUES (NEW.id, NEW.email);

    -- Create subscription record with free tier defaults
    INSERT INTO public.user_subscriptions (user_id, free_plans_used, free_plan_limit)
    VALUES (NEW.id, 0, 3);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;
