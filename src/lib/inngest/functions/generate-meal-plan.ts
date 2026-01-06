import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  generateCoreIngredients,
  generateMealsFromCoreIngredients,
  generatePrepSessions,
  generateGroceryListFromCoreIngredients,
  organizeMealsIntoDays,
} from '@/lib/claude';
import type { UserProfile, IngredientCategory, MealPlanTheme, ThemeSelectionContext, SelectedTheme } from '@/lib/types';
import { DEFAULT_INGREDIENT_VARIETY_PREFS } from '@/lib/types';

// Detect cuisine patterns from disliked meals to avoid similar themes
function detectDislikedCuisinePatterns(dislikedMeals: string[]): string[] {
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
    if (matches.length >= 2) {
      detectedCuisines.add(cuisine);
    }
  }

  return Array.from(detectedCuisines);
}

// Check if theme is compatible with user's dietary preferences
function isThemeCompatible(theme: MealPlanTheme, userDietaryPrefs: string[]): boolean {
  if (userDietaryPrefs.includes('no_restrictions') || userDietaryPrefs.length === 0) {
    return true;
  }

  for (const diet of userDietaryPrefs) {
    if (theme.incompatible_diets?.includes(diet)) {
      return false;
    }
  }

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

// Calculate theme score for selection
function calculateThemeScore(theme: MealPlanTheme, context: ThemeSelectionContext): number {
  let score = 50;

  if (context.preferredThemeIds.includes(theme.id)) {
    score += 30;
  }

  if (theme.peak_seasons && theme.peak_seasons.length > 0) {
    if (theme.peak_seasons.includes(context.currentMonth)) {
      score += 20;
    }
  }

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

// Build selection reason for display
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

// Create a service-role client for Inngest (no cookie context available)
function createServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error('Missing Supabase URL or service role key');
  }

  return createSupabaseClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// Helper to update job status (must be called within step context)
async function updateJobStatus(
  jobId: string,
  status: string,
  progressMessage?: string,
  mealPlanId?: string,
  errorMessage?: string,
  debugData?: Record<string, unknown>
) {
  const supabase = createServiceRoleClient();
  const updateData: Record<string, unknown> = {
    status,
    progress_message: progressMessage,
    meal_plan_id: mealPlanId,
    error_message: errorMessage,
  };

  // Only include debug_data if provided (to avoid overwriting on subsequent updates)
  if (debugData !== undefined) {
    updateData.debug_data = debugData;
  }

  await supabase
    .from('meal_plan_jobs')
    .update(updateData)
    .eq('id', jobId);
}

export const generateMealPlanFunction = inngest.createFunction(
  {
    id: 'generate-meal-plan',
    // Disable automatic retries - if generation fails, we want it to fail immediately
    // and not restart from scratch (which would re-generate ingredients and meals)
    retries: 0,
  },
  { event: 'meal-plan/generate' },
  async ({ event, step }) => {
    const { jobId, userId } = event.data as { jobId: string; userId: string };

    try {
      // Step 1: Fetch all required data including theme-related data
      const userData = await step.run('fetch-user-data', async () => {
        const supabase = createServiceRoleClient();
        const [
          profileResult,
          recentPlansResult,
          mealPrefsResult,
          ingredientPrefsResult,
          validatedMealsResult,
          themesResult,
          themePrefsResult,
          recentThemesResult,
        ] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('id', userId).single(),
          supabase.from('meal_plans').select('plan_data').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
          supabase.from('meal_preferences').select('meal_name, preference').eq('user_id', userId),
          supabase.from('ingredient_preferences_with_details').select('ingredient_name, preference').eq('user_id', userId),
          supabase.from('validated_meals_by_user').select('meal_name, calories, protein, carbs, fat').eq('user_id', userId),
          // Theme-related queries
          supabase.from('meal_plan_themes').select('*').eq('is_active', true),
          supabase.from('user_theme_preferences').select('theme_id, preference').eq('user_id', userId),
          supabase.from('meal_plans').select('theme_id').eq('user_id', userId).not('theme_id', 'is', null).order('created_at', { ascending: false }).limit(3),
        ]);

        if (profileResult.error || !profileResult.data) {
          throw new Error('Profile not found');
        }

        const profile = {
          ...profileResult.data,
          ingredient_variety_prefs: profileResult.data.ingredient_variety_prefs || DEFAULT_INGREDIENT_VARIETY_PREFS,
        } as UserProfile;

        // Extract recent meal names
        let recentMealNames: string[] = [];
        if (recentPlansResult.data && recentPlansResult.data.length > 0) {
          recentMealNames = recentPlansResult.data.flatMap(plan => {
            if (!plan.plan_data) return [];
            const planData = plan.plan_data as { day: string; meals: { name: string }[] }[];
            return planData.flatMap(day => day.meals.map(meal => meal.name));
          });
          recentMealNames = [...new Set(recentMealNames)];
        }

        const mealPreferences = {
          liked: mealPrefsResult.data?.filter(p => p.preference === 'liked').map(p => p.meal_name) || [],
          disliked: mealPrefsResult.data?.filter(p => p.preference === 'disliked').map(p => p.meal_name) || [],
        };

        const ingredientPreferences = {
          liked: ingredientPrefsResult.data?.filter(p => p.preference === 'liked').map(p => p.ingredient_name) || [],
          disliked: ingredientPrefsResult.data?.filter(p => p.preference === 'disliked').map(p => p.ingredient_name) || [],
        };

        const validatedMeals = validatedMealsResult.data?.map(m => ({
          meal_name: m.meal_name,
          calories: m.calories,
          protein: m.protein,
          carbs: m.carbs,
          fat: m.fat,
        })) || [];

        // Process theme data
        const allThemes = (themesResult.data || []) as MealPlanTheme[];
        const themePrefs = {
          preferred: themePrefsResult.data?.filter(p => p.preference === 'preferred').map(p => p.theme_id) || [],
          blocked: themePrefsResult.data?.filter(p => p.preference === 'blocked').map(p => p.theme_id) || [],
        };
        const recentThemeIds = (recentThemesResult.data || [])
          .map(mp => mp.theme_id)
          .filter((id): id is string => id !== null);

        // Select theme
        let selectedTheme: SelectedTheme | null = null;
        if (allThemes.length > 0) {
          const userDietaryPrefs = profile.dietary_prefs || ['no_restrictions'];
          const dislikedCuisinePatterns = detectDislikedCuisinePatterns(mealPreferences.disliked);
          const currentMonth = new Date().getMonth() + 1;

          const context: ThemeSelectionContext = {
            userDietaryPrefs,
            recentThemeIds,
            preferredThemeIds: themePrefs.preferred,
            blockedThemeIds: themePrefs.blocked,
            dislikedMealPatterns: dislikedCuisinePatterns,
            currentMonth,
          };

          // Filter eligible themes
          let eligibleThemes = allThemes.filter(theme => {
            if (!isThemeCompatible(theme, userDietaryPrefs)) return false;
            if (recentThemeIds.includes(theme.id)) return false;
            if (themePrefs.blocked.includes(theme.id)) return false;
            return true;
          });

          // Relax constraints if no themes left
          if (eligibleThemes.length === 0) {
            eligibleThemes = allThemes.filter(theme =>
              isThemeCompatible(theme, userDietaryPrefs) &&
              !themePrefs.blocked.includes(theme.id)
            );
          }

          if (eligibleThemes.length === 0) {
            eligibleThemes = allThemes.filter(theme =>
              isThemeCompatible(theme, userDietaryPrefs)
            );
          }

          if (eligibleThemes.length > 0) {
            // Score and sort themes
            const scoredThemes = eligibleThemes.map(theme => ({
              theme,
              score: calculateThemeScore(theme, context),
            }));
            scoredThemes.sort((a, b) => b.score - a.score);

            // Add randomness among top themes
            const topThemes = scoredThemes.slice(0, Math.min(3, scoredThemes.length));
            const selectedIndex = Math.floor(Math.random() * topThemes.length);
            const selected = topThemes[selectedIndex];

            selectedTheme = {
              theme: selected.theme,
              selectionReason: buildSelectionReason(selected.theme, context),
            };

            console.log('[Theme Selection] Selected theme:', selectedTheme.theme.display_name, selectedTheme.theme.id);
          }
        }

        return {
          profile,
          recentMealNames,
          mealPreferences,
          ingredientPreferences,
          validatedMeals,
          selectedTheme,
        };
      });

      // Step 2: Generate core ingredients (status update is INSIDE the step)
      const coreIngredients = await step.run('generate-core-ingredients', async () => {
        // Update status at the START of this step (only runs once per step execution)
        const themeMessage = userData.selectedTheme
          ? `Selecting ${userData.selectedTheme.theme.display_name} ingredients...`
          : 'Selecting ingredients for your week...';
        await updateJobStatus(jobId, 'generating_ingredients', themeMessage);

        return await generateCoreIngredients(
          userData.profile,
          userId,
          userData.recentMealNames,
          userData.mealPreferences,
          userData.ingredientPreferences,
          userData.selectedTheme?.theme
        );
      });

      // Step 3: Generate meals from core ingredients
      const mealsResult = await step.run('generate-meals', async () => {
        const themeMessage = userData.selectedTheme
          ? `Creating your ${userData.selectedTheme.theme.display_name} meal plan...`
          : 'Creating your 7-day meal plan...';
        await updateJobStatus(jobId, 'generating_meals', themeMessage);

        return await generateMealsFromCoreIngredients(
          userData.profile,
          coreIngredients,
          userId,
          userData.mealPreferences,
          userData.validatedMeals,
          userData.selectedTheme?.theme
        );
      });

      // Organize meals into day plans (quick operation, no step needed)
      const days = organizeMealsIntoDays(mealsResult);

      // Step 4: Generate grocery list
      const groceryList = await step.run('generate-grocery-list', async () => {
        await updateJobStatus(jobId, 'generating_prep', 'Building grocery list and prep schedule...');

        return await generateGroceryListFromCoreIngredients(
          coreIngredients,
          days,
          userId,
          userData.profile
        );
      });

      // Step 5: Generate prep sessions (with error capture for debugging)
      const prepSessionsResult = await step.run('generate-prep-sessions', async () => {
        // Note: Status already set to 'generating_prep' in previous step
        try {
          const result = await generatePrepSessions(
            days,
            coreIngredients,
            userData.profile,
            userId
          );
          return { success: true as const, data: result };
        } catch (err) {
          // Capture the error, raw response, and context for debugging
          const error = err as Error & { rawResponse?: string };
          return {
            success: false as const,
            error: error.message || 'Unknown error',
            rawResponse: error.rawResponse, // Captured from claude.ts validation
            context: {
              daysCount: days.length,
              mealsCount: days.reduce((acc, d) => acc + d.meals.length, 0),
              profile: {
                prep_style: userData.profile.prep_style,
                meals_per_day: userData.profile.meals_per_day,
              },
            },
          };
        }
      });

      // Handle prep session generation failure
      if (!prepSessionsResult.success) {
        await updateJobStatus(
          jobId,
          'failed',
          undefined,
          undefined,
          prepSessionsResult.error,
          {
            step: 'generate-prep-sessions',
            error: prepSessionsResult.error,
            rawResponse: prepSessionsResult.rawResponse, // Store the raw LLM response
            context: prepSessionsResult.context,
            timestamp: new Date().toISOString(),
          }
        );
        return { success: false, error: prepSessionsResult.error };
      }

      const prepSessions = prepSessionsResult.data;

      // Step 6: Save everything to the database
      const savedPlanId = await step.run('save-meal-plan', async () => {
        await updateJobStatus(jobId, 'saving', 'Saving your meal plan...');

        const supabase = createServiceRoleClient();

        // Calculate week start date
        const today = new Date();
        const dayOfWeek = today.getDay();
        const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
        const weekStart = new Date(today);
        weekStart.setDate(today.getDate() + daysUntilMonday);
        const weekStartDate = weekStart.toISOString().split('T')[0];

        // Save meal plan with theme_id
        const { data: savedPlan, error: saveError } = await supabase
          .from('meal_plans')
          .insert({
            user_id: userId,
            week_start_date: weekStartDate,
            plan_data: days,
            grocery_list: groceryList,
            core_ingredients: coreIngredients,
            theme_id: userData.selectedTheme?.theme.id || null,
            is_favorite: false,
          })
          .select()
          .single();

        if (saveError || !savedPlan) {
          throw new Error('Failed to save meal plan');
        }

        // Save ingredients
        const ingredientInserts = Object.entries(coreIngredients).flatMap(
          ([category, ingredients]) =>
            (ingredients as string[]).map(ingredientName => ({
              meal_plan_id: savedPlan.id,
              category: category as IngredientCategory,
              ingredient_name: ingredientName,
            }))
        );

        if (ingredientInserts.length > 0) {
          await supabase.from('meal_plan_ingredients').insert(ingredientInserts);
        }

        // Validate and save prep sessions
        const prepSessionsArray = prepSessions?.prepSessions;
        if (!prepSessionsArray || !Array.isArray(prepSessionsArray)) {
          console.error('Invalid prep_sessions structure:', prepSessions);
          throw new Error('Failed to generate prep sessions - invalid response structure');
        }

        const prepSessionInserts = prepSessionsArray.map((session: {
          sessionName: string;
          sessionOrder: number;
          estimatedMinutes: number;
          prepItems: Array<{ feeds: Array<{ day: string; meal: string }> }>;
          instructions: string;
          sessionType?: string;
          sessionDay?: string | null;
          sessionTimeOfDay?: string | null;
          prepForDate?: string | null;
          prepTasks?: Array<{ id: string; description: string; estimated_minutes: number; meal_ids: string[]; completed: boolean }>;
          displayOrder?: number;
        }) => ({
          meal_plan_id: savedPlan.id,
          session_name: session.sessionName,
          session_order: session.sessionOrder,
          estimated_minutes: session.estimatedMinutes,
          prep_items: session.prepItems || [],
          feeds_meals: (session.prepItems || []).flatMap(item => item.feeds || []),
          instructions: session.instructions || '',
          daily_assembly: prepSessions?.dailyAssembly || {},
          session_type: session.sessionType || 'weekly_batch',
          session_day: session.sessionDay || null,
          session_time_of_day: session.sessionTimeOfDay || null,
          prep_for_date: session.prepForDate || null,
          prep_tasks: session.prepTasks ? { tasks: session.prepTasks } : { tasks: [] },
          display_order: session.displayOrder || session.sessionOrder,
        }));

        if (prepSessionInserts.length > 0) {
          await supabase.from('prep_sessions').insert(prepSessionInserts);
        }

        return savedPlan.id;
      });

      // Step 7: Mark job as completed (separate step to ensure it runs even if previous step is memoized)
      await step.run('mark-completed', async () => {
        await updateJobStatus(jobId, 'completed', 'Meal plan ready!', savedPlanId);
      });

      return { success: true, mealPlanId: savedPlanId };

    } catch (error) {
      console.error('Error generating meal plan:', error);
      await updateJobStatus(jobId, 'failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error');
      return { success: false, error: 'Failed to generate meal plan' };
    }
  }
);
