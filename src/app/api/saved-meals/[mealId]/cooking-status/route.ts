/**
 * Saved Meal Cooking Status API Endpoint
 *
 * POST /api/saved-meals/[mealId]/cooking-status
 * GET /api/saved-meals/[mealId]/cooking-status
 *
 * Manages cooking status for saved meals (quick cook, party plans).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import {
  markSavedMealCooked,
  getSavedMealCookingStatus,
  resetSavedMealCookingStatus,
} from '@/lib/cooking-tracker-service';
import type { MarkMealCookedRequest } from '@/lib/types';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ mealId: string }> }
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

    const { mealId } = await params;
    const body: MarkMealCookedRequest = await request.json();

    if (!body.cooking_status) {
      return NextResponse.json({ error: 'Missing cooking_status field' }, { status: 400 });
    }

    // If resetting to not_cooked, delete the record instead
    if (body.cooking_status === 'not_cooked') {
      await resetSavedMealCookingStatus(mealId, user.id);
      return NextResponse.json({ cooking_status: 'not_cooked' });
    }

    const cookingStatus = await markSavedMealCooked(mealId, user.id, body.cooking_status, {
      modificationNotes: body.modification_notes,
      updatedInstructions: body.updated_instructions,
      cookedPhotoUrl: body.cooked_photo_url,
      shareWithCommunity: body.share_with_community,
    });

    return NextResponse.json(cookingStatus);
  } catch (error) {
    console.error('Error updating saved meal cooking status:', error);

    if (error instanceof Error) {
      if (error.message === 'Unauthorized') {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
      }
      if (error.message === 'Meal not found') {
        return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
      }
    }

    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ mealId: string }> }
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

    const { mealId } = await params;

    const cookingStatus = await getSavedMealCookingStatus(mealId, user.id);

    // Return a default status if no record exists
    if (!cookingStatus) {
      return NextResponse.json({
        meal_id: mealId,
        user_id: user.id,
        cooking_status: 'not_cooked',
        cooked_at: null,
        modification_notes: null,
        cooked_photo_url: null,
        share_with_community: true,
      });
    }

    return NextResponse.json(cookingStatus);
  } catch (error) {
    console.error('Error fetching saved meal cooking status:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
