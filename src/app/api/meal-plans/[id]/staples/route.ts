/**
 * Meal Plan Staples API
 *
 * GET    /api/meal-plans/[id]/staples           - Get staples for a meal plan
 * POST   /api/meal-plans/[id]/staples           - Add staples to a meal plan
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface Props {
  params: Promise<{ id: string }>;
}

// GET - Get all staples for a meal plan, plus available staples to add
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

    // Get staples currently in this meal plan
    const { data: planStaples, error: psError } = await supabase
      .from('meal_plan_staples')
      .select(`
        id,
        meal_plan_id,
        staple_id,
        is_checked,
        created_at,
        staple:user_grocery_staples(*)
      `)
      .eq('meal_plan_id', mealPlanId)
      .order('created_at', { ascending: true });

    if (psError) {
      console.error('Error fetching plan staples:', psError);
      return NextResponse.json({ error: 'Failed to fetch staples' }, { status: 500 });
    }

    // Get all user's staples that are NOT in this plan (for quick-add UI)
    const stapleIdsInPlan = planStaples?.map(ps => ps.staple_id) || [];

    let availableQuery = supabase
      .from('user_grocery_staples')
      .select('*')
      .eq('user_id', user.id)
      .order('times_added', { ascending: false });

    if (stapleIdsInPlan.length > 0) {
      availableQuery = availableQuery.not('id', 'in', `(${stapleIdsInPlan.join(',')})`);
    }

    const { data: availableStaples, error: asError } = await availableQuery;

    if (asError) {
      console.error('Error fetching available staples:', asError);
      return NextResponse.json({ error: 'Failed to fetch available staples' }, { status: 500 });
    }

    // Transform nested staple array to single object
    const transformedStaples = (planStaples || []).map(ps => ({
      ...ps,
      staple: Array.isArray(ps.staple) ? ps.staple[0] : ps.staple,
    })).filter(ps => ps.staple);

    return NextResponse.json({
      staples: transformedStaples,
      availableStaples: availableStaples || [],
    });
  } catch (error) {
    console.error('Error in GET /api/meal-plans/[id]/staples:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST - Add staples to a meal plan
export async function POST(request: Request, { params }: Props) {
  try {
    const { id: mealPlanId } = await params;
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const stapleIds: string[] = body.staple_ids;

    if (!Array.isArray(stapleIds) || stapleIds.length === 0) {
      return NextResponse.json({ error: 'staple_ids array is required' }, { status: 400 });
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

    // Verify all staple_ids belong to this user
    const { data: validStaples, error: vsError } = await supabase
      .from('user_grocery_staples')
      .select('id')
      .eq('user_id', user.id)
      .in('id', stapleIds);

    if (vsError) {
      console.error('Error validating staples:', vsError);
      return NextResponse.json({ error: 'Failed to validate staples' }, { status: 500 });
    }

    const validIds = new Set(validStaples?.map(s => s.id) || []);
    const invalidIds = stapleIds.filter(id => !validIds.has(id));

    if (invalidIds.length > 0) {
      return NextResponse.json({
        error: 'Some staple IDs are invalid or do not belong to you',
        invalid_ids: invalidIds
      }, { status: 400 });
    }

    // Insert the staples (ignore duplicates)
    const insertData = stapleIds.map(stapleId => ({
      meal_plan_id: mealPlanId,
      staple_id: stapleId,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from('meal_plan_staples')
      .upsert(insertData, { onConflict: 'meal_plan_id,staple_id' })
      .select(`
        id,
        meal_plan_id,
        staple_id,
        is_checked,
        created_at,
        staple:user_grocery_staples(*)
      `);

    if (insertError) {
      console.error('Error adding staples to meal plan:', insertError);
      return NextResponse.json({ error: 'Failed to add staples' }, { status: 500 });
    }

    // Update times_added counter for each staple
    await supabase.rpc('increment_staple_times_added', { staple_ids: stapleIds });

    // Transform nested staple array to single object
    const transformedStaples = (inserted || []).map(ps => ({
      ...ps,
      staple: Array.isArray(ps.staple) ? ps.staple[0] : ps.staple,
    })).filter(ps => ps.staple);

    return NextResponse.json({ staples: transformedStaples }, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/meal-plans/[id]/staples:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
