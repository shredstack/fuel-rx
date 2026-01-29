import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  generateCoreIngredients,
  generateMealsFromCoreIngredients,
  generatePrepSessions,
  organizeMealsIntoDays,
} from '@/lib/claude';
import type { UserProfile, IngredientCategory, MealPlanTheme, ThemeSelectionContext, SelectedTheme, MealType, DayOfWeek, ProteinFocusConstraint } from '@/lib/types';
import { DEFAULT_INGREDIENT_VARIETY_PREFS } from '@/lib/types';
import { getTestConfig, FIXTURE_MEAL_PLAN, FIXTURE_GROCERY_LIST, FIXTURE_CORE_INGREDIENTS, FIXTURE_PREP_SESSIONS } from '@/lib/claude_test';
import { normalizeForMatching } from '@/lib/meal-service';
import { sendMealPlanReadyEmail } from '@/lib/email/resend';

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
    const { jobId, userId, themeSelection, proteinFocus } = event.data as {
      jobId: string;
      userId: string;
      themeSelection?: 'surprise' | 'none' | string; // 'surprise' = auto, 'none' = no theme, or specific theme ID
      proteinFocus?: ProteinFocusConstraint | null;
    };

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
          // Fetch recent meal plans with their linked meals (normalized structure)
          supabase.from('meal_plans').select('id').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
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

        // Extract recent meal names from normalized structure
        let recentMealNames: string[] = [];
        if (recentPlansResult.data && recentPlansResult.data.length > 0) {
          const recentPlanIds = recentPlansResult.data.map(p => p.id);
          // Fetch meals linked to recent meal plans
          const { data: recentMealsData } = await supabase
            .from('meal_plan_meals')
            .select('meals!meal_plan_meals_meal_id_fkey(name)')
            .in('meal_plan_id', recentPlanIds);

          if (recentMealsData) {
            recentMealNames = recentMealsData
              .map(mpm => {
                // Supabase returns the joined meal as an object (single relation via FK)
                const meal = mpm.meals as unknown as { name: string } | null;
                return meal?.name;
              })
              .filter((name): name is string => !!name);
            recentMealNames = [...new Set(recentMealNames)];
          }
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

        // Select theme based on themeSelection parameter
        let selectedTheme: SelectedTheme | null = null;

        // themeSelection: 'none' = no theme, 'surprise'/undefined = auto-select, otherwise = specific theme ID
        if (themeSelection === 'none') {
          // User explicitly chose no theme
          console.log('[Theme Selection] User selected no theme (classic mode)');
          selectedTheme = null;
        } else if (themeSelection && themeSelection !== 'surprise') {
          // User selected a specific theme by ID
          const specificTheme = allThemes.find(t => t.id === themeSelection);
          if (specificTheme) {
            selectedTheme = {
              theme: specificTheme,
              selectionReason: 'you selected this theme',
            };
            console.log('[Theme Selection] User selected specific theme:', specificTheme.display_name, specificTheme.id);
          } else {
            console.warn('[Theme Selection] Specified theme not found, falling back to auto-selection');
          }
        }

        // Auto-select if no specific theme was set (surprise mode or fallback)
        if (selectedTheme === null && themeSelection !== 'none' && allThemes.length > 0) {
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

            console.log('[Theme Selection] Auto-selected theme:', selectedTheme.theme.display_name, selectedTheme.theme.id);
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

      // ===== TEST MODE: Check for fixture mode =====
      const testConfig = getTestConfig();
      if (testConfig.mode === 'fixture' && process.env.MEAL_PLAN_TEST_MODE) {
        console.log('[TEST MODE] FIXTURE MODE: Using mock data (no LLM calls)');

        // Use fixture data directly, skip all LLM generation steps
        const fixtureDays = FIXTURE_MEAL_PLAN;
        const coreIngredients = FIXTURE_CORE_INGREDIENTS;
        // Note: FIXTURE_PREP_SESSIONS and FIXTURE_GROCERY_LIST are available but grocery is now computed
        void FIXTURE_PREP_SESSIONS; // Acknowledge import is used
        void FIXTURE_GROCERY_LIST; // Grocery list now computed from normalized meals

        // Skip to saving step with fixture data (using normalized structure)
        const savedPlanId = await step.run('save-meal-plan-fixture', async () => {
          await updateJobStatus(jobId, 'saving', '[TEST MODE] Saving fixture meal plan...');

          const supabase = createServiceRoleClient();

          // Calculate week start date
          const today = new Date();
          const dayOfWeek = today.getDay();
          const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
          const weekStart = new Date(today);
          weekStart.setDate(today.getDate() + daysUntilMonday);
          const weekStartDate = weekStart.toISOString().split('T')[0];

          // Create meal plan (normalized - no plan_data or grocery_list)
          const { data: savedPlan, error: saveError } = await supabase
            .from('meal_plans')
            .insert({
              user_id: userId,
              week_start_date: weekStartDate,
              core_ingredients: coreIngredients,
              theme_id: null,
              is_favorite: false,
              prep_style: userData.profile.prep_style || 'day_of',
            })
            .select()
            .single();

          if (saveError || !savedPlan) {
            throw new Error('Failed to save meal plan');
          }

          // Save meals and create links for fixture data
          const mealInserts: Array<{
            meal_plan_id: string;
            meal_id: string;
            day: DayOfWeek;
            meal_type: MealType;
            snack_number: number | null;
            position: number;
            is_original: boolean;
          }> = [];

          const savedMealsByKey = new Map<string, string>();

          for (const dayPlan of fixtureDays) {
            let position = 0;
            let snackCount = 0;

            for (const meal of dayPlan.meals) {
              const mealKey = `${meal.type}_${normalizeForMatching(meal.name)}`;
              let mealId = savedMealsByKey.get(mealKey);

              if (!mealId) {
                // Check if meal already exists for this user (same deduplication as production code)
                const { data: existingMeal } = await supabase
                  .from('meals')
                  .select('id, times_used')
                  .eq('source_user_id', userId)
                  .eq('name_normalized', normalizeForMatching(meal.name))
                  .single();

                if (existingMeal) {
                  mealId = existingMeal.id;
                  // Increment usage count
                  await supabase
                    .from('meals')
                    .update({ times_used: (existingMeal.times_used || 1) + 1 })
                    .eq('id', mealId);
                } else {
                  // Create new meal
                  const { data: newMeal, error: mealError } = await supabase
                    .from('meals')
                    .insert({
                      name: meal.name,
                      name_normalized: normalizeForMatching(meal.name),
                      meal_type: meal.type,
                      ingredients: meal.ingredients,
                      instructions: meal.instructions,
                      calories: meal.macros.calories,
                      protein: meal.macros.protein,
                      carbs: meal.macros.carbs,
                      fat: meal.macros.fat,
                      prep_time_minutes: meal.prep_time_minutes,
                      source_type: 'ai_generated',
                      source_user_id: userId,
                      source_meal_plan_id: savedPlan.id,
                      is_user_created: false,
                      is_nutrition_edited_by_user: false,
                    })
                    .select('id')
                    .single();

                  if (mealError || !newMeal) {
                    throw new Error(`Failed to save fixture meal: ${mealError?.message}`);
                  }
                  mealId = newMeal.id;
                }
                savedMealsByKey.set(mealKey, mealId!);
              }

              const finalMealId = mealId as string;
              const snackNumber = meal.type === 'snack' ? ++snackCount : null;
              mealInserts.push({
                meal_plan_id: savedPlan.id,
                meal_id: finalMealId,
                day: dayPlan.day as DayOfWeek,
                meal_type: meal.type as MealType,
                snack_number: snackNumber,
                position: position++,
                is_original: true,
              });
            }
          }

          // Insert meal links
          if (mealInserts.length > 0) {
            await supabase.from('meal_plan_meals').insert(mealInserts);
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

          // Auto-add weekly staples to this meal plan
          try {
            await supabase.rpc('auto_add_weekly_staples', {
              p_meal_plan_id: savedPlan.id,
              p_user_id: userId,
            });
          } catch (stapleError) {
            console.error('Failed to auto-add weekly staples:', stapleError);
            // Don't throw - staples are non-critical
          }

          return savedPlan.id;
        });

        await step.run('mark-completed-fixture', async () => {
          await updateJobStatus(jobId, 'completed', '[TEST MODE] Fixture meal plan ready!', savedPlanId);
        });

        return { success: true, mealPlanId: savedPlanId };
      }
      // ===== END TEST MODE =====

      // Step 2: Generate core ingredients (status update is INSIDE the step)
      const coreIngredients = await step.run('generate-core-ingredients', async () => {
        // Update status at the START of this step (only runs once per step execution)
        const themeMessage = userData.selectedTheme
          ? `Selecting ${userData.selectedTheme.theme.display_name} ingredients...`
          : proteinFocus
          ? `Selecting ingredients with ${proteinFocus.protein} focus...`
          : 'Selecting ingredients for your week...';
        await updateJobStatus(jobId, 'generating_ingredients', themeMessage);

        return await generateCoreIngredients(
          userData.profile,
          userId,
          userData.recentMealNames,
          userData.mealPreferences,
          userData.ingredientPreferences,
          userData.selectedTheme?.theme,
          proteinFocus,
          jobId
        );
      });

      // Step 3: Generate meals from core ingredients
      const mealsResult = await step.run('generate-meals', async () => {
        const themeMessage = userData.selectedTheme
          ? `Creating your ${userData.selectedTheme.theme.display_name} meal plan...`
          : proteinFocus
          ? `Creating ${proteinFocus.protein} ${proteinFocus.mealType}s...`
          : 'Creating your 7-day meal plan...';
        await updateJobStatus(jobId, 'generating_meals', themeMessage);

        return await generateMealsFromCoreIngredients(
          userData.profile,
          coreIngredients,
          userId,
          userData.mealPreferences,
          userData.validatedMeals,
          userData.selectedTheme?.theme,
          proteinFocus,
          jobId
        );
      });

      // Extract title and organize meals into day plans (quick operation, no step needed)
      const { title: generatedTitle } = mealsResult;
      const days = organizeMealsIntoDays(mealsResult);

      // Step 4: Update status for prep generation
      // NOTE: Grocery list is now computed on-demand from normalized meal data
      await step.run('update-status-prep', async () => {
        await updateJobStatus(jobId, 'generating_prep', 'Building prep schedule...');
      });

      // Step 5: Generate prep sessions (with error capture for debugging)
      const prepSessionsResult = await step.run('generate-prep-sessions', async () => {
        // Note: Status already set to 'generating_prep' in previous step
        try {
          const result = await generatePrepSessions(
            days,
            coreIngredients,
            userData.profile,
            userId,
            undefined, // weekStartDate
            jobId
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

      // Step 6: Save everything to the database using normalized structure
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

        // Create meal plan record (without plan_data and grocery_list - now normalized)
        const { data: savedPlan, error: saveError } = await supabase
          .from('meal_plans')
          .insert({
            user_id: userId,
            week_start_date: weekStartDate,
            core_ingredients: coreIngredients,
            theme_id: userData.selectedTheme?.theme.id || null,
            is_favorite: false,
            prep_style: userData.profile.prep_style || 'day_of',
            title: generatedTitle || null,
            protein_focus: proteinFocus || null,
          })
          .select()
          .single();

        if (saveError || !savedPlan) {
          throw new Error(`Failed to save meal plan: ${saveError?.message}`);
        }

        // Save each meal to the meals table with deduplication
        // and create meal_plan_meals links
        const mealInserts: Array<{
          meal_plan_id: string;
          meal_id: string;
          day: DayOfWeek;
          meal_type: MealType;
          snack_number: number | null;
          position: number;
          is_original: boolean;
        }> = [];

        // Track meals we've already saved to avoid duplicates
        const savedMealsByKey = new Map<string, string>(); // key -> meal_id

        for (const dayPlan of days) {
          let position = 0;
          let snackCount = 0;

          for (const meal of dayPlan.meals) {
            const mealKey = `${meal.type}_${normalizeForMatching(meal.name)}`;

            let mealId = savedMealsByKey.get(mealKey);

            if (!mealId) {
              // Check if meal already exists for this user
              const { data: existingMeal } = await supabase
                .from('meals')
                .select('id, times_used')
                .eq('source_user_id', userId)
                .eq('name_normalized', normalizeForMatching(meal.name))
                .single();

              if (existingMeal) {
                mealId = existingMeal.id;
                // Increment usage count
                await supabase
                  .from('meals')
                  .update({ times_used: (existingMeal.times_used || 1) + 1 })
                  .eq('id', mealId);
              } else {
                // Create new meal
                // Round macro values to integers since the database expects integer types
                const { data: newMeal, error: mealError } = await supabase
                  .from('meals')
                  .insert({
                    name: meal.name,
                    name_normalized: normalizeForMatching(meal.name),
                    meal_type: meal.type,
                    ingredients: meal.ingredients,
                    instructions: meal.instructions,
                    calories: Math.round(meal.macros.calories),
                    protein: Math.round(meal.macros.protein),
                    carbs: Math.round(meal.macros.carbs),
                    fat: Math.round(meal.macros.fat),
                    prep_time_minutes: Math.round(meal.prep_time_minutes || 0),
                    source_type: 'ai_generated',
                    source_user_id: userId,
                    source_meal_plan_id: savedPlan.id,
                    is_user_created: false,
                    is_nutrition_edited_by_user: false,
                    theme_id: userData.selectedTheme?.theme.id || null,
                    theme_name: userData.selectedTheme?.theme.display_name || null,
                  })
                  .select('id')
                  .single();

                if (mealError || !newMeal) {
                  console.error('Failed to save meal:', mealError);
                  throw new Error(`Failed to save meal: ${mealError?.message}`);
                }

                mealId = newMeal.id;
              }

              savedMealsByKey.set(mealKey, mealId!);
            }

            // At this point mealId is guaranteed to be defined
            const finalMealId = mealId as string;

            // Create meal_plan_meals link
            const snackNumber = meal.type === 'snack' ? ++snackCount : null;
            mealInserts.push({
              meal_plan_id: savedPlan.id,
              meal_id: finalMealId,
              day: dayPlan.day as DayOfWeek,
              meal_type: meal.type as MealType,
              snack_number: snackNumber,
              position: position++,
              is_original: true,
            });
          }
        }

        // Insert all meal_plan_meals links
        if (mealInserts.length > 0) {
          const { error: linksError } = await supabase
            .from('meal_plan_meals')
            .insert(mealInserts);

          if (linksError) {
            throw new Error(`Failed to create meal plan links: ${linksError.message}`);
          }
        }

        // Save core ingredients to meal_plan_ingredients table
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
          prepTasks?: Array<{
            id: string;
            description: string;
            estimated_minutes: number;
            meal_ids: string[];
            completed: boolean;
            detailed_steps?: string[];
            cooking_temps?: { oven?: string; stovetop?: string; internal_temp?: string; grill?: string };
            cooking_times?: { prep_time?: string; cook_time?: string; rest_time?: string; total_time?: string };
            tips?: string[];
            storage?: string;
            equipment_needed?: string[];
            ingredients_to_prep?: string[];
            prep_category?: 'sunday_batch' | 'day_of_quick' | 'day_of_cooking';
          }>;
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
          const { error: prepError } = await supabase.from('prep_sessions').insert(prepSessionInserts);
          if (prepError) {
            console.error('Failed to save prep sessions:', prepError);
            // Don't throw - prep sessions are non-critical, meal plan is still usable
          }

          // Save the raw PrepModeResponse to meal_plans.prep_sessions_day_of for batch prep transformation
          const { error: updateError } = await supabase
            .from('meal_plans')
            .update({
              prep_sessions_day_of: prepSessions,
              batch_prep_status: 'pending',
            })
            .eq('id', savedPlan.id);

          if (updateError) {
            console.error('Failed to update meal_plan with prep_sessions_day_of:', updateError);
            // Non-critical - batch prep can still be generated on-demand
          }
        } else {
          console.warn('No prep sessions to save - prepSessionsArray may have been empty');
        }

        // Auto-add weekly staples to this meal plan
        try {
          await supabase.rpc('auto_add_weekly_staples', {
            p_meal_plan_id: savedPlan.id,
            p_user_id: userId,
          });
        } catch (stapleError) {
          console.error('Failed to auto-add weekly staples:', stapleError);
          // Don't throw - staples are non-critical
        }

        return savedPlan.id;
      });

      // Step 7: Mark job as completed (separate step to ensure it runs even if previous step is memoized)
      await step.run('mark-completed', async () => {
        await updateJobStatus(jobId, 'completed', 'Meal plan ready!', savedPlanId);
      });

      // Step 8: Mark first_plan_completed onboarding milestone (only if not already marked)
      await step.run('mark-onboarding-milestone', async () => {
        const supabase = createServiceRoleClient();
        await supabase
          .from('user_onboarding_state')
          .update({
            first_plan_completed: true,
            first_plan_completed_at: new Date().toISOString(),
          })
          .eq('user_id', userId)
          .is('first_plan_completed', false);
      });

      // Step 9: Increment free_plans_used counter for free tier users only
      await step.run('increment-free-plan-counter', async () => {
        const supabase = createServiceRoleClient();
        const { data: subscription } = await supabase
          .from('user_subscriptions')
          .select('is_override, has_meal_plan_generation, free_plans_used')
          .eq('user_id', userId)
          .single();

        // Only increment for free tier users (not override, not Pro subscribers)
        const isOverride = subscription?.is_override ?? false;
        const hasMealPlanGeneration = subscription?.has_meal_plan_generation ?? false;

        if (!isOverride && !hasMealPlanGeneration) {
          await supabase
            .from('user_subscriptions')
            .update({ free_plans_used: (subscription?.free_plans_used ?? 0) + 1 })
            .eq('user_id', userId);
        }
      });

      // Step 10: Send email notification (non-blocking - failure doesn't affect success)
      await step.run('send-email-notification', async () => {
        try {
          await sendMealPlanReadyEmail({
            to: userData.profile.email,
            userName: userData.profile.name || '',
            mealPlanId: savedPlanId,
            themeName: userData.selectedTheme?.theme.display_name,
          });
        } catch (err) {
          // Log but don't fail the job - email is nice-to-have
          console.error('[Email] Failed to send notification:', err);
        }
      });

      // Step 11: Track protein focus history (if protein focus was used)
      if (proteinFocus) {
        await step.run('track-protein-focus-history', async () => {
          const supabase = createServiceRoleClient();
          try {
            await supabase
              .from('protein_focus_history')
              .upsert({
                user_id: userId,
                protein: proteinFocus.protein,
                meal_type: proteinFocus.mealType,
                used_at: new Date().toISOString(),
              }, {
                onConflict: 'user_id,protein,meal_type',
              });
          } catch (err) {
            // Non-critical - don't fail the job
            console.error('[Protein Focus] Failed to track history:', err);
          }
        });
      }

      // Step 12: Trigger async batch prep generation
      // This runs in the background - users can view batch prep once it's ready
      await step.run('trigger-batch-prep', async () => {
        try {
          const supabase = createServiceRoleClient();

          // Create a job record for tracking/history
          const { data: batchPrepJob, error: jobError } = await supabase
            .from('meal_plan_jobs')
            .insert({
              user_id: userId,
              meal_plan_id: savedPlanId,
              job_type: 'batch_prep_generation',
              status: 'pending',
              progress_message: 'Starting batch prep generation...',
            })
            .select('id')
            .single();

          if (jobError) {
            console.error('[Batch Prep] Failed to create job record:', jobError);
          }

          await inngest.send({
            name: 'meal-plan/generate-batch-prep',
            data: {
              mealPlanId: savedPlanId,
              userId,
              jobId: batchPrepJob?.id,
            },
          });
        } catch (err) {
          // Non-critical - batch prep can be regenerated on-demand
          console.error('[Batch Prep] Failed to trigger generation:', err);
        }
      });

      return { success: true, mealPlanId: savedPlanId };

    } catch (error) {
      console.error('Error generating meal plan:', error);
      await updateJobStatus(jobId, 'failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error');
      return { success: false, error: 'Failed to generate meal plan' };
    }
  }
);
