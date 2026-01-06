import { createClient } from '@/lib/supabase/server';
import { MealPlanTheme, ThemeSelectionContext, SelectedTheme } from '@/lib/types';

/**
 * Select an appropriate theme for the meal plan based on various factors
 */
export async function selectThemeForMealPlan(
  context: ThemeSelectionContext
): Promise<SelectedTheme> {
  const supabase = await createClient();

  // If user explicitly selected a theme, use it (validate it's compatible first)
  if (context.userOverrideThemeId) {
    const { data: theme } = await supabase
      .from('meal_plan_themes')
      .select('*')
      .eq('id', context.userOverrideThemeId)
      .eq('is_active', true)
      .single();

    if (theme && isThemeCompatible(theme, context.userDietaryPrefs)) {
      return {
        theme,
        selectionReason: 'User selected this theme',
      };
    }
    // If incompatible, fall through to auto-selection
  }

  // Fetch all active themes
  const { data: allThemes, error } = await supabase
    .from('meal_plan_themes')
    .select('*')
    .eq('is_active', true);

  console.log('[Theme Selection] Fetched themes:', { count: allThemes?.length, error: error?.message });

  if (error || !allThemes?.length) {
    throw new Error(`No active themes available: ${error?.message || 'No themes found'}`);
  }

  // Filter themes
  let eligibleThemes = allThemes.filter(theme => {
    // 1. Must be compatible with user's dietary restrictions
    if (!isThemeCompatible(theme, context.userDietaryPrefs)) {
      return false;
    }

    // 2. Exclude recently used themes (last 2-3)
    if (context.recentThemeIds.includes(theme.id)) {
      return false;
    }

    // 3. Exclude blocked themes
    if (context.blockedThemeIds.includes(theme.id)) {
      return false;
    }

    return true;
  });

  // If no themes left after filtering, relax the recent themes constraint
  if (eligibleThemes.length === 0) {
    eligibleThemes = allThemes.filter(theme =>
      isThemeCompatible(theme, context.userDietaryPrefs) &&
      !context.blockedThemeIds.includes(theme.id)
    );
  }

  // Still no themes? Use any compatible theme
  if (eligibleThemes.length === 0) {
    eligibleThemes = allThemes.filter(theme =>
      isThemeCompatible(theme, context.userDietaryPrefs)
    );
  }

  if (eligibleThemes.length === 0) {
    throw new Error('No compatible themes available for user dietary preferences');
  }

  // Score and sort themes
  const scoredThemes = eligibleThemes.map(theme => ({
    theme,
    score: calculateThemeScore(theme, context),
  }));

  scoredThemes.sort((a, b) => b.score - a.score);

  // Add some randomness among top themes (top 3)
  const topThemes = scoredThemes.slice(0, Math.min(3, scoredThemes.length));
  const selectedIndex = Math.floor(Math.random() * topThemes.length);
  const selected = topThemes[selectedIndex];

  return {
    theme: selected.theme,
    selectionReason: buildSelectionReason(selected.theme, context),
  };
}

/**
 * Check if theme is compatible with user's dietary preferences
 */
function isThemeCompatible(theme: MealPlanTheme, userDietaryPrefs: string[]): boolean {
  // If user has no restrictions, all themes are compatible
  if (userDietaryPrefs.includes('no_restrictions') || userDietaryPrefs.length === 0) {
    return true;
  }

  // Check if any user diet is in theme's incompatible list
  for (const diet of userDietaryPrefs) {
    if (theme.incompatible_diets?.includes(diet)) {
      return false;
    }
  }

  // Check if theme explicitly supports user's diets
  // (If theme has compatible_diets specified, user's diet must be in it)
  if (theme.compatible_diets && theme.compatible_diets.length > 0) {
    const hasCompatibleDiet = userDietaryPrefs.some(diet =>
      theme.compatible_diets.includes(diet)
    );
    if (!hasCompatibleDiet) {
      return false;
    }
  }

  return true;
}

/**
 * Calculate a score for theme selection
 */
function calculateThemeScore(theme: MealPlanTheme, context: ThemeSelectionContext): number {
  let score = 50; // Base score

  // Boost preferred themes significantly
  if (context.preferredThemeIds.includes(theme.id)) {
    score += 30;
  }

  // Boost seasonally appropriate themes
  if (theme.peak_seasons && theme.peak_seasons.length > 0) {
    if (theme.peak_seasons.includes(context.currentMonth)) {
      score += 20;
    }
  }

  // Penalize themes similar to disliked meal patterns
  // (This requires analyzing theme name/description for cuisine patterns)
  if (context.dislikedMealPatterns && context.dislikedMealPatterns.length > 0) {
    const themeCuisineHints = [
      theme.name.toLowerCase(),
      theme.display_name.toLowerCase(),
      theme.description.toLowerCase(),
    ].join(' ');

    for (const pattern of context.dislikedMealPatterns) {
      if (themeCuisineHints.includes(pattern.toLowerCase())) {
        score -= 15;
      }
    }
  }

  return score;
}

/**
 * Build a human-readable reason for theme selection
 */
function buildSelectionReason(theme: MealPlanTheme, context: ThemeSelectionContext): string {
  const reasons: string[] = [];

  if (context.preferredThemeIds.includes(theme.id)) {
    reasons.push('one of your preferred themes');
  }

  if (theme.peak_seasons?.includes(context.currentMonth)) {
    reasons.push('perfect for this time of year');
  }

  if (reasons.length === 0) {
    reasons.push('selected for variety');
  }

  return reasons.join(' and ');
}

/**
 * Get user's recent theme IDs (last N meal plans)
 */
export async function getRecentThemeIds(userId: string, count: number = 3): Promise<string[]> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('meal_plans')
    .select('theme_id')
    .eq('user_id', userId)
    .not('theme_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(count);

  return (data || [])
    .map(mp => mp.theme_id)
    .filter((id): id is string => id !== null);
}

/**
 * Get user's theme preferences (preferred and blocked)
 */
export async function getUserThemePreferences(userId: string): Promise<{
  preferred: string[];
  blocked: string[];
}> {
  const supabase = await createClient();

  const { data } = await supabase
    .from('user_theme_preferences')
    .select('theme_id, preference')
    .eq('user_id', userId);

  const preferred: string[] = [];
  const blocked: string[] = [];

  for (const pref of data || []) {
    if (pref.preference === 'preferred') {
      preferred.push(pref.theme_id);
    } else if (pref.preference === 'blocked') {
      blocked.push(pref.theme_id);
    }
  }

  return { preferred, blocked };
}

/**
 * Detect cuisine patterns from disliked meals to avoid similar themes
 */
export function detectDislikedCuisinePatterns(dislikedMeals: string[]): string[] {
  const cuisineKeywords: Record<string, string[]> = {
    'asian': ['teriyaki', 'stir-fry', 'stir fry', 'soy', 'ginger', 'sesame', 'rice bowl', 'noodle', 'thai', 'chinese', 'japanese', 'korean'],
    'mediterranean': ['greek', 'mediterranean', 'feta', 'olive', 'hummus', 'pita', 'tzatziki', 'italian', 'tuscan'],
    'mexican': ['taco', 'burrito', 'fajita', 'mexican', 'chipotle', 'cilantro lime', 'salsa', 'enchilada', 'quesadilla'],
    'middle eastern': ['shawarma', 'falafel', 'tahini', 'za\'atar', 'kebab', 'kofta', 'hummus'],
    'tropical': ['hawaiian', 'poke', 'coconut', 'mango', 'pineapple', 'jerk'],
  };

  const detectedCuisines = new Set<string>();
  const lowerDisliked = dislikedMeals.map(m => m.toLowerCase());

  for (const [cuisine, keywords] of Object.entries(cuisineKeywords)) {
    const matches = lowerDisliked.filter(meal =>
      keywords.some(keyword => meal.includes(keyword))
    );

    // If 2+ disliked meals match a cuisine, flag it
    if (matches.length >= 2) {
      detectedCuisines.add(cuisine);
    }
  }

  return Array.from(detectedCuisines);
}
