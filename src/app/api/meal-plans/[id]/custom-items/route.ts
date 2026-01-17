/**
 * Meal Plan Custom Items API
 *
 * GET    /api/meal-plans/[id]/custom-items    - Get custom items for a meal plan
 * POST   /api/meal-plans/[id]/custom-items    - Add a custom item to a meal plan
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string }>;
}

// GET - Get all custom items for a meal plan
export async function GET(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId } = await params;
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

    const { data: items, error } = await supabase
      .from('meal_plan_custom_items')
      .select('*')
      .eq('meal_plan_id', mealPlanId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Error fetching custom items:', error);
      return NextResponse.json({ error: 'Failed to fetch custom items' }, { status: 500 });
    }

    return NextResponse.json({ items: items || [] });
  } catch (error) {
    console.error('Error in GET /api/meal-plans/[id]/custom-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add a custom item to a meal plan
export async function POST(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { name } = body;

    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json({ error: 'name is required' }, { status: 400 });
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

    const { data: item, error: insertError } = await supabase
      .from('meal_plan_custom_items')
      .insert({
        meal_plan_id: mealPlanId,
        name: name.trim(),
      })
      .select()
      .single();

    if (insertError) {
      console.error('Error adding custom item:', insertError);
      return NextResponse.json({ error: 'Failed to add custom item' }, { status: 500 });
    }

    return NextResponse.json({ item }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/meal-plans/[id]/custom-items:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
