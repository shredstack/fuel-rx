import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MealPlanMealToLog, MealType, ConsumptionEntryType } from '@/lib/types';

/**
 * GET /api/consumption/meal-plan-meals/search?q=chicken
 *
 * Search all meal plan meals across all of user's historical plans.
 * Returns deduplicated results (one per unique meal), preferring the latest plan.
 */
export async function GET(request: Request) {
  const supabase = await createClient();
  const { data: { user }, error: authError } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q') || '';

  if (query.length < 2) {
    return NextResponse.json({ meals: [] });
  }

  // Search meals that appear in user's meal plans
  // Order by week_start_date DESC so we get latest plans first
  // Use meals!meal_id to specify the foreign key (there's also swapped_from_meal_id)
  const { data: results, error } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      day,
      meal_id,
      meal_plan_id,
      meal_plans!inner(week_start_date, title, user_id),
      meals!meal_id(name, meal_type, calories, protein, carbs, fat, source_type)
    `)
    .eq('meal_plans.user_id', user.id)
    .ilike('meals.name', `%${query}%`)
    .order('meal_plans(week_start_date)', { ascending: false })
    .limit(50); // Fetch more than needed since we'll deduplicate

  if (error) {
    console.error('Error searching meal plan meals:', error);
    return NextResponse.json({ error: 'Search failed' }, { status: 500 });
  }

  const dayLabels: Record<string, string> = {
    monday: 'Mon', tuesday: 'Tue', wednesday: 'Wed',
    thursday: 'Thu', friday: 'Fri', saturday: 'Sat', sunday: 'Sun'
  };

  // Deduplicate by meal_id, keeping only the first (latest) occurrence
  const seenMealIds = new Set<string>();
  const meals: MealPlanMealToLog[] = [];

  for (const pm of results || []) {
    // Skip if we've already seen this meal
    if (seenMealIds.has(pm.meal_id)) {
      continue;
    }

    const meal = pm.meals as unknown as {
      name: string;
      meal_type: MealType;
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
      source_type?: string;
    };

    // Skip party meals
    if (meal.source_type === 'party_meal') {
      continue;
    }

    seenMealIds.add(pm.meal_id);
    const plan = pm.meal_plans as unknown as {
      week_start_date: string;
      title: string;
    };

    meals.push({
      id: pm.id,
      source: 'meal_plan' as ConsumptionEntryType,
      source_id: pm.id,
      name: meal.name,
      meal_type: meal.meal_type,
      calories: Math.round(meal.calories),
      protein: Math.round(meal.protein),
      carbs: Math.round(meal.carbs),
      fat: Math.round(meal.fat),
      plan_week_start: plan.week_start_date,
      plan_title: plan.title,
      day_of_week: pm.day,
      day_label: dayLabels[pm.day] || pm.day,
      meal_id: pm.meal_id,
      is_logged: false, // Could check against today's logs if needed
    });

    // Limit to 20 deduplicated results
    if (meals.length >= 20) {
      break;
    }
  }

  return NextResponse.json({ meals });
}
