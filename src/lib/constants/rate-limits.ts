/**
 * Rate limiting constants for meal plan generation
 *
 * Pro/VIP users are limited to 3 meal plans per rolling 7-day window.
 * This protects against API cost overruns while ensuring normal usage is never impacted.
 *
 * Note: This rate limit applies ONLY to meal plan generation.
 * All other AI features (Cooking Assistant, Snap-a-Meal, Quick Cook, Prep Mode)
 * remain unlimited for Pro/VIP users.
 */

// Maximum meal plans Pro/VIP users can generate in a rolling 7-day window
export const PRO_WEEKLY_PLAN_LIMIT = 3;

// Rolling window duration in milliseconds (7 days)
export const ROLLING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;

// Rolling window duration in hours (for display)
export const ROLLING_WINDOW_HOURS = 168;
