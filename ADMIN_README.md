# FuelRx Admin Guide

This document covers administrative tasks and configurations for managing FuelRx.

---

## Meal Plan Rate Limiting

Pro and VIP users are limited to **3 meal plans per rolling 7-day window**. This protects against API cost overruns while ensuring normal usage patterns are never impacted.

### Rate Limit Rules

| User Type | Meal Plan Limit | AI Features |
|-----------|-----------------|-------------|
| Free user (plans remaining) | Lifetime `free_plan_limit` (default: 2) | Unlimited while free plans remain |
| Free user (0 plans left) | Paywall | Paywall |
| Basic subscriber | Lifetime `free_plan_limit` | Unlimited |
| **Pro subscriber** | **3 per rolling 7 days** | Unlimited |
| **VIP (override)** | **3 per rolling 7 days** | Unlimited |

### What's NOT Rate Limited

The following AI features remain **unlimited** for all Pro/VIP users:
- Cooking Assistant
- Snap-a-Meal (photo analysis)
- Quick Cook (single meal generation)
- Prep Mode instructions

---

## Admin Override for Rate Limits

Admins can customize the weekly plan limit for specific users via the `weekly_plan_limit_override` column in the `user_subscriptions` table.

### Override Values

| Scenario | Value to Set |
|----------|--------------|
| Normal user (use default) | `NULL` |
| Testing account (effectively unlimited) | `9999` |
| User had a bug, needs 1 extra this week | `4` (then reset to `NULL` later) |
| Beta tester with extended access | `10` |
| Temporarily restrict a user | `1` |

### How to Set via Supabase Studio

1. Go to **Supabase Dashboard** → **Table Editor** → `user_subscriptions`
2. Find the user by `user_id` (or filter by joining with `auth.users` on email)
3. Edit the `weekly_plan_limit_override` column
4. Set to desired integer value, or `NULL` to restore the default (3)

### Example SQL Queries

**Give a user unlimited plans:**
```sql
UPDATE user_subscriptions
SET weekly_plan_limit_override = 9999
WHERE user_id = 'user-uuid-here';
```

**Temporarily increase limit to 5:**
```sql
UPDATE user_subscriptions
SET weekly_plan_limit_override = 5
WHERE user_id = 'user-uuid-here';
```

**Reset to default (3 per week):**
```sql
UPDATE user_subscriptions
SET weekly_plan_limit_override = NULL
WHERE user_id = 'user-uuid-here';
```

**Find user by email and set override:**
```sql
UPDATE user_subscriptions
SET weekly_plan_limit_override = 10
WHERE user_id = (
  SELECT id FROM auth.users WHERE email = 'user@example.com'
);
```

---

## VIP Access (Full Override)

For friends, testers, or special users who need full access to all features, use the `is_override` flag instead of (or in addition to) `weekly_plan_limit_override`.

### Setting VIP Access

```sql
UPDATE user_subscriptions
SET is_override = true,
    override_reason = 'Beta tester - granted by Sarah'
WHERE user_id = 'user-uuid-here';
```

**Note:** VIP users (`is_override = true`) are still subject to the weekly plan limit unless you also set `weekly_plan_limit_override`.

To give a VIP user unlimited plans:
```sql
UPDATE user_subscriptions
SET is_override = true,
    override_reason = 'Friend/family - unlimited access',
    weekly_plan_limit_override = 9999
WHERE user_id = 'user-uuid-here';
```

---

## Free Plan Limits

Free users have a lifetime limit on meal plan generations, controlled by:
- `free_plans_used` - How many they've generated
- `free_plan_limit` - Their maximum (default: 2)

### Resetting Free Plans for a User

If a user needs their free plans reset (support case, bug, etc.):

```sql
UPDATE user_subscriptions
SET free_plans_used = 0
WHERE user_id = 'user-uuid-here';
```

### Granting Extra Free Plans

```sql
UPDATE user_subscriptions
SET free_plan_limit = 5  -- Give them 5 total free plans
WHERE user_id = 'user-uuid-here';
```

---

## Viewing User Subscription Status

### Get full subscription info for a user:

```sql
SELECT
  us.*,
  u.email,
  u.created_at as user_created_at
FROM user_subscriptions us
JOIN auth.users u ON u.id = us.user_id
WHERE u.email = 'user@example.com';
```

### Count meal plans generated in the last 7 days:

```sql
SELECT
  u.email,
  COUNT(mp.id) as plans_last_7_days,
  us.weekly_plan_limit_override
FROM auth.users u
JOIN user_subscriptions us ON us.user_id = u.id
LEFT JOIN meal_plans mp ON mp.user_id = u.id
  AND mp.created_at > NOW() - INTERVAL '7 days'
WHERE u.email = 'user@example.com'
GROUP BY u.email, us.weekly_plan_limit_override;
```

### Find users who hit their rate limit:

```sql
SELECT
  u.email,
  COUNT(mp.id) as plans_last_7_days,
  COALESCE(us.weekly_plan_limit_override, 3) as effective_limit
FROM auth.users u
JOIN user_subscriptions us ON us.user_id = u.id
JOIN meal_plans mp ON mp.user_id = u.id
  AND mp.created_at > NOW() - INTERVAL '7 days'
WHERE us.has_meal_plan_generation = true OR us.is_override = true
GROUP BY u.email, us.weekly_plan_limit_override
HAVING COUNT(mp.id) >= COALESCE(us.weekly_plan_limit_override, 3);
```

---

## Support Scenarios

### "I can't generate a meal plan"

1. Check if they're a Pro/VIP user
2. Count their plans in the last 7 days
3. If at limit, either:
   - Explain the rolling window (oldest plan "expires" after 7 days)
   - Temporarily increase their `weekly_plan_limit_override`

### "My subscription isn't showing"

1. Have them tap "Sync Subscription Status" in Settings
2. If still not working, check `user_subscriptions` for their `user_id`
3. Verify `is_subscribed`, `subscription_tier`, and `subscription_status`

### "I want to test with unlimited plans"

Set `weekly_plan_limit_override = 9999` for testing accounts.

---

## Database Migrations

Rate limiting migrations are in:
- `supabase/migrations/20260127131356_add_weekly_plan_limit_override.sql`

To apply locally:
```bash
supabase migration up
```

**Never push migrations directly to production.** Use the Supabase dashboard or proper deployment workflows.
