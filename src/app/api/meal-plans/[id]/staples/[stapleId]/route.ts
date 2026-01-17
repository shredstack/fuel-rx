/**
 * Individual Meal Plan Staple API
 *
 * PATCH  /api/meal-plans/[id]/staples/[stapleId] - Toggle check state
 * DELETE /api/meal-plans/[id]/staples/[stapleId] - Remove from meal plan
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string; stapleId: string }>;
}

// PATCH - Toggle check state
export async function PATCH(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId, stapleId } = await params;
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

    // First verify user owns this meal plan
    const { data: mealPlan, error: mpError } = await supabase
      .from('meal_plans')
      .select('id')
      .eq('id', mealPlanId)
      .eq('user_id', user.id)
      .single();

    if (mpError || !mealPlan) {
      return NextResponse.json({ error: 'Meal plan not found' }, { status: 404 });
    }

    // Update the staple check state
    const { data, error } = await supabase
      .from('meal_plan_staples')
      .update({ is_checked })
      .eq('meal_plan_id', mealPlanId)
      .eq('staple_id', stapleId)
      .select()
      .single();

    if (error || !data) {
      return NextResponse.json({ error: 'Staple not found in meal plan' }, { status: 404 });
    }

    return NextResponse.json({ staple: data });
  } catch (error) {
    console.error('Error in PATCH /api/meal-plans/[id]/staples/[stapleId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// DELETE - Remove staple from meal plan
export async function DELETE(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId, stapleId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // First verify user owns this meal plan
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
      .from('meal_plan_staples')
      .delete()
      .eq('meal_plan_id', mealPlanId)
      .eq('staple_id', stapleId);

    if (error) {
      console.error('Error removing staple from meal plan:', error);
      return NextResponse.json({ error: 'Failed to remove staple' }, { status: 500 });
    }

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error('Error in DELETE /api/meal-plans/[id]/staples/[stapleId]:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
