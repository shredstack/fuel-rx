-- Update free plan limit from 3 to 2 for all users

-- Update the default value for the column
ALTER TABLE user_subscriptions
ALTER COLUMN free_plan_limit SET DEFAULT 2;

-- Update existing users who still have the old default of 3
-- Only update users who haven't used any plans yet (to be fair to those who started with 3)
UPDATE user_subscriptions
SET free_plan_limit = 2
WHERE free_plan_limit = 3 AND free_plans_used = 0;

-- Update handle_new_user function to use new default
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
    VALUES (NEW.id, 0, 2);

    RETURN NEW;
EXCEPTION WHEN OTHERS THEN
    RAISE LOG 'Error in handle_new_user: %', SQLERRM;
    RETURN NEW;
END;
$$;
