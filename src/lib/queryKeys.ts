/**
 * Query Key Factory
 *
 * Hierarchical query keys for React Query cache management.
 * Enables granular invalidation (e.g., invalidate all consumption data,
 * or just consumption data for a specific date).
 */

export const queryKeys = {
  // Consumption / Log Meal domain
  consumption: {
    all: ['consumption'] as const,
    daily: (date: string) => ['consumption', 'daily', date] as const,
    available: (date: string) => ['consumption', 'available', date] as const,
    previousByMealType: (date: string) =>
      ['consumption', 'previous', date] as const,
    weekly: (startDate: string) =>
      ['consumption', 'weekly', startDate] as const,
    monthly: (year: number, month: number) =>
      ['consumption', 'monthly', year, month] as const,
    water: (date: string) => ['consumption', 'water', date] as const,
    summary: () => ['consumption', 'summary'] as const,
  },

  // Social feed domain
  socialFeed: {
    all: ['social-feed'] as const,
    list: (filter: string) => ['social-feed', 'list', filter] as const,
    post: (postId: string) => ['social-feed', 'post', postId] as const,
  },

  // Job status domain (for polling meal plan generation)
  jobs: {
    all: ['jobs'] as const,
    status: (jobId: string) => ['jobs', jobId] as const,
  },

  // User profile and settings
  user: {
    all: ['user'] as const,
    profile: () => ['user', 'profile'] as const,
    subscription: () => ['user', 'subscription'] as const,
    onboarding: () => ['user', 'onboarding'] as const,
  },

  // Meal plans
  mealPlans: {
    all: ['meal-plans'] as const,
    detail: (planId: string) => ['meal-plans', planId] as const,
    recent: () => ['meal-plans', 'recent'] as const,
    batchPrepStatus: (mealPlanId: string | null) =>
      ['meal-plans', 'batchPrepStatus', mealPlanId] as const,
  },

  // Ingredients (for search/autocomplete)
  ingredients: {
    all: ['ingredients'] as const,
    search: (query: string) => ['ingredients', 'search', query] as const,
    frequent: () => ['ingredients', 'frequent'] as const,
  },

  // Grocery staples
  groceryStaples: {
    all: ['grocery-staples'] as const,
    list: (frequency?: string) => ['grocery-staples', 'list', frequency] as const,
  },

  // Individual meals (for fetching ingredients)
  meals: {
    all: ['meals'] as const,
    detail: (mealId: string) => ['meals', mealId] as const,
  },
} as const;
