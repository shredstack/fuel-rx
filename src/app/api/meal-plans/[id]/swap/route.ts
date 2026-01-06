/**
 * Meal Swap API Endpoint
 *
 * POST /api/meal-plans/[id]/swap
 * Swaps a meal in a meal plan slot with a different meal.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { swapMeal, computeGroceryListFromPlan, computeDailyTotals } from '@/lib/meal-plan-service';
import type { SwapRequest, SwapResponse } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealPlanId } = await params;
    const body: SwapRequest = await request.json();
    const { mealPlanMealId, newMealId } = body;

    if (!mealPlanMealId || !newMealId) {
      return NextResponse.json(
        { error: 'Missing required fields: mealPlanMealId and newMealId' },
        { status: 400 }
      );
    }

    // Perform the swap
    const swapResult = await swapMeal(mealPlanMealId, newMealId, user.id);

    if (!swapResult.success || !swapResult.newMeal) {
      return NextResponse.json(
        { error: swapResult.message || 'Failed to swap meal' },
        { status: 400 }
      );
    }

    // Compute updated grocery list and daily totals
    const [groceryList, dailyTotals] = await Promise.all([
      computeGroceryListFromPlan(mealPlanId),
      computeDailyTotals(mealPlanId),
    ]);

    const response: SwapResponse = {
      success: true,
      swappedCount: swapResult.swappedCount,
      mealPlanMeals: swapResult.updatedMealPlanMeals,
      newMeal: swapResult.newMeal,
      updatedDailyTotals: dailyTotals,
      groceryList,
      updatedCoreIngredients: swapResult.updatedCoreIngredients,
      message: swapResult.message,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('Error in meal swap:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
