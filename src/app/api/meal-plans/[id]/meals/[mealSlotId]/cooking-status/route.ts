/**
 * Meal Plan Meal Cooking Status API Endpoint
 *
 * POST /api/meal-plans/[id]/meals/[mealSlotId]/cooking-status
 * GET /api/meal-plans/[id]/meals/[mealSlotId]/cooking-status
 *
 * Manages cooking status for meals within a meal plan.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  markMealPlanMealCooked,
  getMealPlanMealCookingStatus,
  resetMealPlanMealCookingStatus,
} from '@/lib/cooking-tracker-service';
import type { MarkMealCookedRequest } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string; mealSlotId: string }> }
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

    const { mealSlotId } = await params;
    const body: MarkMealCookedRequest = await request.json();

    if (!body.cooking_status) {
      return NextResponse.json({ error: 'Missing cooking_status field' }, { status: 400 });
    }

    // If resetting to not_cooked, delete the record instead
    if (body.cooking_status === 'not_cooked') {
      await resetMealPlanMealCookingStatus(mealSlotId, user.id);
      return NextResponse.json({ cooking_status: 'not_cooked' });
    }

    const cookingStatus = await markMealPlanMealCooked(mealSlotId, user.id, body.cooking_status, {
      modificationNotes: body.modification_notes,
      updatedInstructions: body.updated_instructions,
      cookedPhotoUrl: body.cooked_photo_url,
      shareWithCommunity: body.share_with_community,
    });

    return NextResponse.json(cookingStatus);
  } catch (error) {
    console.error('Error updating cooking status:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message === 'Meal slot not found') {
        return NextResponse.json({ error: 'Meal slot not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string; mealSlotId: string }> }
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

    const { mealSlotId } = await params;

    const cookingStatus = await getMealPlanMealCookingStatus(mealSlotId);

    // Return a default status if no record exists
    if (!cookingStatus) {
      return NextResponse.json({
        meal_plan_meal_id: mealSlotId,
        cooking_status: 'not_cooked',
        cooked_at: null,
        modification_notes: null,
        cooked_photo_url: null,
        share_with_community: true,
      });
    }

    return NextResponse.json(cookingStatus);
  } catch (error) {
    console.error('Error fetching cooking status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
