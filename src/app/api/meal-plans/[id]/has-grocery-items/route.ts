/**
 * Check if a meal plan has any user-added grocery items (staples or custom items)
 *
 * GET /api/meal-plans/[id]/has-grocery-items
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id: mealPlanId } = await params;

    // Verify ownership
    const { data: mealPlan } = await supabase
      .from('meal_plans')
      .select('user_id')
      .eq('id', mealPlanId)
      .single();

    if (!mealPlan || mealPlan.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Check for staples
    const { count: staplesCount } = await supabase
      .from('meal_plan_staples')
      .select('id', { count: 'exact', head: true })
      .eq('meal_plan_id', mealPlanId);

    // Check for custom items
    const { count: customItemsCount } = await supabase
      .from('meal_plan_custom_items')
      .select('id', { count: 'exact', head: true })
      .eq('meal_plan_id', mealPlanId);

    const hasItems = (staplesCount || 0) > 0 || (customItemsCount || 0) > 0;

    return NextResponse.json({
      hasItems,
      staplesCount: staplesCount || 0,
      customItemsCount: customItemsCount || 0,
    });
  } catch (error) {
    console.error('Error checking grocery items:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
