-- Add per-user weekly plan limit override
-- When NULL, uses the default limit (3 per week)
-- When set, overrides the default for this specific user

ALTER TABLE user_subscriptions
ADD COLUMN weekly_plan_limit_override INT DEFAULT NULL;

COMMENT ON COLUMN user_subscriptions.weekly_plan_limit_override IS
  'If set, overrides the default weekly plan limit (3) for this user. NULL = use default. Set to 9999 for effectively unlimited.';
