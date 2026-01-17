/**
 * Individual Custom Item API
 *
 * PATCH  /api/meal-plans/[id]/custom-items/[itemId] - Toggle check state
 * DELETE /api/meal-plans/[id]/custom-items/[itemId] - Remove custom item
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string; itemId: string }>;
}

// PATCH - Toggle check state
export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId, itemId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { is_checked } = body;

    if (typeof is_checked !== 'boolean') {
      return NextResponse.json({ error: 'is_checked boolean is required' }, { status: 400 });
    }

    // Verify user owns this meal plan
    const { data: mealPlan, error: mpError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single();

    if (mpError || !mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    const { data, error } = await supabase
      .from('meal_plan_custom_items')
      .update({ is_checked })
      .eq('id', itemId)
      .eq('meal_plan_id', mealPlanId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Custom item not found' }, { status: 404 });
    }

    return NextResponse.json({ item: data });
  } catch (error) {
    console.error('Error in PATCH /api/meal-plans/[id]/custom-items/[itemId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove custom item
export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId, itemId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user owns this meal plan
    const { data: mealPlan, error: mpError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single();

    if (mpError || !mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    const { error } = await supabase
      .from('meal_plan_custom_items')
      .delete()
      .eq('id', itemId)
      .eq('meal_plan_id', mealPlanId);

    if (error) {
      console.error('Error deleting custom item:', error);
      return NextResponse.json({ error: 'Failed to delete custom item' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/meal-plans/[id]/custom-items/[itemId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
