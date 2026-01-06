/**
 * Meal Plan API Endpoint
 *
 * GET /api/meal-plans/[id] - Get a meal plan with normalized structure
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMealPlanNormalized } from '@/lib/meal-plan-service';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    // First verify the meal plan belongs to this user
    const { data: mealPlanCheck } = await supabase
      .from('meal_plans')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!mealPlanCheck) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    if (mealPlanCheck.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Get the normalized meal plan
    const mealPlan = await getMealPlanNormalized(id);

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    return NextResponse.json({ mealPlan });
  } catch (error) {
    console.error('Error fetching meal plan:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
