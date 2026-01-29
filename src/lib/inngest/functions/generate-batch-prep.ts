/**
 * Batch Prep Generation Inngest Function
 *
 * Transforms day-of prep sessions into batch prep format asynchronously.
 * Triggered after meal plan generation completes.
 */

import { inngest } from '../client';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { transformToBatchPrep } from '@/lib/claude/prep-sessions/batch-transform';
import type {
  DayPlan,
  CoreIngredients,
  UserProfile,
  PrepModeResponse,
  DayOfWeek,
  MealType,
  Meal,
  Macros,
} from '@/lib/types';

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

// Define the event type
type BatchPrepEvent = {
  name: 'meal-plan/generate-batch-prep';
  data: {
    mealPlanId: string;
    userId: string;
    jobId?: string; // Optional for backwards compatibility
  };
};

export const generateBatchPrepFunction = inngest.createFunction(
  {
    id: 'generate-batch-prep',
    retries: 2,
    concurrency: {
      limit: 5,
    },
    onFailure: async ({ event, error }) => {
      const { mealPlanId, jobId } = event.data.event.data as BatchPrepEvent['data'];
      const supabase = createServiceRoleClient();
      const errorMessage = error.message || 'Unknown error during batch prep generation';

      // Update job status to failed
      if (jobId) {
        await supabase
          .from('meal_plan_jobs')
          .update({
            status: 'failed',
            error_message: errorMessage,
            progress_message: 'Batch prep generation failed',
          })
          .eq('id', jobId);
      }

      // Update meal_plans status to failed for UI
      await supabase
        .from('meal_plans')
        .update({ batch_prep_status: 'failed' })
        .eq('id', mealPlanId);
    },
  },
  { event: 'meal-plan/generate-batch-prep' },
  async ({ event, step }) => {
    const { mealPlanId, userId, jobId } = event.data as BatchPrepEvent['data'];
    const supabase = createServiceRoleClient();

    // Helper to update job status
    const updateJobStatus = async (status: string, progressMessage: string, errorMessage?: string) => {
      if (!jobId) return;
      await supabase
        .from('meal_plan_jobs')
        .update({
          status,
          progress_message: progressMessage,
          ...(errorMessage && { error_message: errorMessage }),
        })
        .eq('id', jobId);
    };

    // Step 1: Load meal plan data
    const mealPlanData = await step.run('load-meal-plan', async () => {
      // Update job status
      await updateJobStatus('generating_prep', 'Loading meal plan data...');

      // Update status to generating on meal_plans (for UI)
      await supabase
        .from('meal_plans')
        .update({ batch_prep_status: 'generating' })
        .eq('id', mealPlanId);

      // Load the meal plan with all needed data
      const { data: mealPlan, error } = await supabase
        .from('meal_plans')
        .select(`
          id,
          prep_sessions_day_of,
          core_ingredients,
          week_start_date,
          user_id
        `)
        .eq('id', mealPlanId)
        .single();

      if (error || !mealPlan) {
        throw new Error(`Failed to load meal plan: ${error?.message}`);
      }

      if (!mealPlan.prep_sessions_day_of) {
        throw new Error('No day-of prep sessions to transform');
      }

      // Load user profile
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', mealPlan.user_id)
        .single();

      if (profileError || !profile) {
        throw new Error(`Failed to load user profile: ${profileError?.message}`);
      }

      // Load meals for this plan
      const { data: mealPlanMeals, error: mealsError } = await supabase
        .from('meal_plan_meals')
        .select(`
          day,
          meal_type,
          position,
          meals!meal_plan_meals_meal_id_fkey (
            id,
            name,
            instructions,
            prep_time_minutes,
            ingredients,
            calories,
            protein,
            carbs,
            fat
          )
        `)
        .eq('meal_plan_id', mealPlanId)
        .order('day')
        .order('meal_type')
        .order('position');

      if (mealsError) {
        throw new Error(`Failed to load meals: ${mealsError.message}`);
      }

      // Organize meals into DayPlan structure
      const days = organizeMealsIntoDays(mealPlanMeals || []);

      return {
        dayOfPrepSessions: mealPlan.prep_sessions_day_of as PrepModeResponse,
        coreIngredients: mealPlan.core_ingredients as CoreIngredients,
        profile: profile as UserProfile,
        days,
        weekStartDate: mealPlan.week_start_date,
      };
    });

    // Step 2: Transform to batch prep
    const batchPrepResult = await step.run('transform-to-batch-prep', async () => {
      await updateJobStatus('generating_prep', 'Transforming to batch prep format...');
      return await transformToBatchPrep(
        mealPlanData.dayOfPrepSessions,
        mealPlanData.days,
        mealPlanData.coreIngredients,
        mealPlanData.profile,
        userId,
        mealPlanData.weekStartDate,
        undefined // jobId - not used for batch prep
      );
    });

    // Step 3: Save batch prep result
    await step.run('save-batch-prep', async () => {
      await updateJobStatus('saving', 'Saving batch prep results...');

      const { error } = await supabase
        .from('meal_plans')
        .update({
          prep_sessions_batch: batchPrepResult,
          batch_prep_status: 'completed',
        })
        .eq('id', mealPlanId);

      if (error) {
        await updateJobStatus('failed', 'Failed to save batch prep', error.message);
        throw new Error(`Failed to save batch prep: ${error.message}`);
      }

      // Mark job as completed
      await updateJobStatus('completed', 'Batch prep generation complete!');
    });

    return { success: true, mealPlanId, jobId };
  }
);

/**
 * Helper to organize flat meals into DayPlan structure
 */
interface MealData {
  id: string;
  name: string;
  instructions: string[] | null;
  prep_time_minutes: number;
  ingredients: unknown[];
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface MealRow {
  day: string;
  meal_type: string;
  position: number;
  meals: MealData | MealData[] | null;
}

function organizeMealsIntoDays(mealRows: MealRow[]): DayPlan[] {
  const dayMap = new Map<string, DayPlan>();
  const dayOrder: DayOfWeek[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

  for (const row of mealRows) {
    // Skip rows without meal data
    if (!row.meals) continue;

    // Handle both single object and array (Supabase returns single object for FK joins)
    const mealData = Array.isArray(row.meals) ? row.meals[0] : row.meals;
    if (!mealData) continue;

    const day = row.day as DayOfWeek;
    if (!dayMap.has(day)) {
      dayMap.set(day, {
        day,
        meals: [],
        daily_totals: { calories: 0, protein: 0, carbs: 0, fat: 0 },
      });
    }

    const dayPlan = dayMap.get(day)!;
    const meal: Meal = {
      type: row.meal_type as MealType,
      name: mealData.name,
      instructions: mealData.instructions || [],
      prep_time_minutes: mealData.prep_time_minutes,
      ingredients: (mealData.ingredients || []) as Meal['ingredients'],
      macros: {
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
      },
    };

    dayPlan.meals.push(meal);

    // Update daily totals
    dayPlan.daily_totals.calories += meal.macros.calories;
    dayPlan.daily_totals.protein += meal.macros.protein;
    dayPlan.daily_totals.carbs += meal.macros.carbs;
    dayPlan.daily_totals.fat += meal.macros.fat;
  }

  // Return in day order
  return dayOrder
    .filter(d => dayMap.has(d))
    .map(d => dayMap.get(d)!);
}
