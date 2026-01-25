/**
 * Grocery Item Checks API
 *
 * GET  /api/meal-plans/[id]/grocery-checks - Get all checked items for a meal plan
 * POST /api/meal-plans/[id]/grocery-checks - Toggle check state for an item
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

    // Get all checked items
    const { data: checks, error } = await supabase
      .from('meal_plan_grocery_checks')
      .select('item_name_normalized, is_checked')
      .eq('meal_plan_id', mealPlanId);

    if (error) {
      console.error('Error fetching grocery checks:', error);
      return NextResponse.json(
        { error: 'Failed to fetch checks' },
        { status: 500 }
      );
    }

    // Return as a Set-friendly object { "item_name": true, ... }
    const checkedMap: Record<string, boolean> = {};
    for (const check of checks || []) {
      if (check.is_checked) {
        checkedMap[check.item_name_normalized] = true;
      }
    }

    return NextResponse.json({ checks: checkedMap });
  } catch (error) {
    console.error('Error in GET grocery-checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
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
    const { itemName, isChecked } = await request.json();

    if (!itemName || typeof isChecked !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    // Verify ownership
    const { data: mealPlan } = await supabase
      .from('meal_plans')
      .select('user_id')
      .eq('id', mealPlanId)
      .single();

    if (!mealPlan || mealPlan.user_id !== user.id) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    const itemNameNormalized = itemName.toLowerCase().trim();

    if (isChecked) {
      // Upsert the check
      const { error } = await supabase
        .from('meal_plan_grocery_checks')
        .upsert(
          {
            meal_plan_id: mealPlanId,
            item_name_normalized: itemNameNormalized,
            is_checked: true,
            checked_at: new Date().toISOString(),
          },
          {
            onConflict: 'meal_plan_id,item_name_normalized',
          }
        );

      if (error) {
        console.error('Error saving grocery check:', error);
        return NextResponse.json(
          { error: 'Failed to save check' },
          { status: 500 }
        );
      }
    } else {
      // Delete the check (unchecked = no row)
      const { error } = await supabase
        .from('meal_plan_grocery_checks')
        .delete()
        .eq('meal_plan_id', mealPlanId)
        .eq('item_name_normalized', itemNameNormalized);

      if (error) {
        console.error('Error deleting grocery check:', error);
        return NextResponse.json(
          { error: 'Failed to delete check' },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in POST grocery-checks:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
