import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import {
  generateCoreIngredients,
  generateMealsFromCoreIngredients,
  generatePrepSessions,
  generateGroceryListFromCoreIngredients,
  organizeMealsIntoDays,
} from '@/lib/claude';
import type { UserProfile, IngredientCategory } from '@/lib/types';
import { DEFAULT_INGREDIENT_VARIETY_PREFS } from '@/lib/types';

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
      // Step 1: Fetch all required data
      const userData = await step.run('fetch-user-data', async () => {
        const supabase = createServiceRoleClient();
        const [profileResult, recentPlansResult, mealPrefsResult, ingredientPrefsResult, validatedMealsResult] = await Promise.all([
          supabase.from('user_profiles').select('*').eq('id', userId).single(),
          supabase.from('meal_plans').select('plan_data').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
          supabase.from('meal_preferences').select('meal_name, preference').eq('user_id', userId),
          supabase.from('ingredient_preferences_with_details').select('ingredient_name, preference').eq('user_id', userId),
          supabase.from('validated_meals_by_user').select('meal_name, calories, protein, carbs, fat').eq('user_id', userId),
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

        return {
          profile,
          recentMealNames,
          mealPreferences,
          ingredientPreferences,
          validatedMeals,
        };
      });

      // Step 2: Generate core ingredients (status update is INSIDE the step)
      const coreIngredients = await step.run('generate-core-ingredients', async () => {
        // Update status at the START of this step (only runs once per step execution)
        await updateJobStatus(jobId, 'generating_ingredients', 'Selecting ingredients for your week...');

        return await generateCoreIngredients(
          userData.profile,
          userId,
          userData.recentMealNames,
          userData.mealPreferences,
          userData.ingredientPreferences
        );
      });

      // Step 3: Generate meals from core ingredients
      const mealsResult = await step.run('generate-meals', async () => {
        await updateJobStatus(jobId, 'generating_meals', 'Creating your 7-day meal plan...');

        return await generateMealsFromCoreIngredients(
          userData.profile,
          coreIngredients,
          userId,
          userData.mealPreferences,
          userData.validatedMeals
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

        // Save meal plan
        const { data: savedPlan, error: saveError } = await supabase
          .from('meal_plans')
          .insert({
            user_id: userId,
            week_start_date: weekStartDate,
            plan_data: days,
            grocery_list: groceryList,
            core_ingredients: coreIngredients,
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
