/**
 * Grocery List API Endpoint
 *
 * GET /api/meal-plans/[id]/grocery-list - Compute and return grocery list
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { computeGroceryListFromPlan } from '@/lib/meal-plan-service';

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

    // Verify the meal plan belongs to this user
    const { data: mealPlan } = await supabase
      .from('meal_plans')
      .select('user_id')
      .eq('id', id)
      .single();

    if (!mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    if (mealPlan.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }

    // Compute the grocery list
    const groceryList = await computeGroceryListFromPlan(id);

    return NextResponse.json({ groceryList });
  } catch (error) {
    console.error('Error computing grocery list:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
