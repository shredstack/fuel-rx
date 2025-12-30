import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { generateMealPlanWithProgress } from '@/lib/claude';
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

export const generateMealPlanFunction = inngest.createFunction(
  {
    id: 'generate-meal-plan',
    // Inngest has no timeout by default, but you can set one if desired
    // cancelOn: [{ event: 'meal-plan/cancel', match: 'data.jobId' }],
  },
  { event: 'meal-plan/generate' },
  async ({ event }) => {
    const { jobId, userId } = event.data as { jobId: string; userId: string };

    const supabase = createServiceRoleClient();

    // Helper to update job status
    const updateJobStatus = async (
      status: string,
      progressMessage?: string,
      mealPlanId?: string,
      errorMessage?: string
    ) => {
      await supabase
        .from('meal_plan_jobs')
        .update({
          status,
          progress_message: progressMessage,
          meal_plan_id: mealPlanId,
          error_message: errorMessage,
        })
        .eq('id', jobId);
    };

    try {
      // Fetch all required data
      const [profileResult, recentPlansResult, mealPrefsResult, ingredientPrefsResult, validatedMealsResult] = await Promise.all([
        supabase.from('user_profiles').select('*').eq('id', userId).single(),
        supabase.from('meal_plans').select('plan_data').eq('user_id', userId).order('created_at', { ascending: false }).limit(3),
        supabase.from('meal_preferences').select('meal_name, preference').eq('user_id', userId),
        supabase.from('ingredient_preferences_with_details').select('ingredient_name, preference').eq('user_id', userId),
        supabase.from('validated_meals_by_user').select('meal_name, calories, protein, carbs, fat').eq('user_id', userId),
      ]);

      if (profileResult.error || !profileResult.data) {
        await updateJobStatus('failed', undefined, undefined, 'Profile not found');
        return { success: false, error: 'Profile not found' };
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

      // Generate meal plan with progress updates
      const mealPlanData = await generateMealPlanWithProgress(
        profile,
        userId,
        recentMealNames,
        mealPreferences,
        validatedMeals,
        ingredientPreferences,
        async (stage, message) => {
          // Map stages to job statuses
          const statusMap: Record<string, string> = {
            'ingredients': 'generating_ingredients',
            'ingredients_done': 'generating_ingredients',
            'meals': 'generating_meals',
            'meals_done': 'generating_meals',
            'finalizing': 'generating_prep',
            'finalizing_done': 'generating_prep',
            'saving': 'saving',
          };
          await updateJobStatus(statusMap[stage] || 'pending', message);
        }
      );

      // Calculate week start date
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilMonday = dayOfWeek === 0 ? 1 : 8 - dayOfWeek;
      const weekStart = new Date(today);
      weekStart.setDate(today.getDate() + daysUntilMonday);
      const weekStartDate = weekStart.toISOString().split('T')[0];

      await updateJobStatus('saving', 'Saving your meal plan...');

      // Save meal plan
      const { data: savedPlan, error: saveError } = await supabase
        .from('meal_plans')
        .insert({
          user_id: userId,
          week_start_date: weekStartDate,
          plan_data: mealPlanData.days,
          grocery_list: mealPlanData.grocery_list,
          core_ingredients: mealPlanData.core_ingredients,
          is_favorite: false,
        })
        .select()
        .single();

      if (saveError || !savedPlan) {
        await updateJobStatus('failed', undefined, undefined, 'Failed to save meal plan');
        return { success: false, error: 'Failed to save meal plan' };
      }

      // Save ingredients
      const ingredientInserts = Object.entries(mealPlanData.core_ingredients).flatMap(
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

      // Save prep sessions
      const prepSessionInserts = mealPlanData.prep_sessions.prepSessions.map((session: {
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
        prep_items: session.prepItems,
        feeds_meals: session.prepItems.flatMap(item => item.feeds),
        instructions: session.instructions,
        daily_assembly: mealPlanData.prep_sessions.dailyAssembly,
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

      // Mark job as completed
      await updateJobStatus('completed', 'Meal plan ready!', savedPlan.id);

      return { success: true, mealPlanId: savedPlan.id };

    } catch (error) {
      console.error('Error generating meal plan:', error);
      await updateJobStatus('failed', undefined, undefined, error instanceof Error ? error.message : 'Unknown error');
      return { success: false, error: 'Failed to generate meal plan' };
    }
  }
);
