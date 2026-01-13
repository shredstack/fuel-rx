/**
 * Save Meal as Custom Meal API
 *
 * POST /api/meals/save-as-custom
 *
 * Creates a copy of an existing meal as a user's custom meal,
 * optionally including their modifications (notes, photo, instruction edits).
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createCustomMeal, getMealById } from '@/lib/meal-service';

interface SaveAsCustomRequest {
  sourceMealId: string;
  mealPlanId: string;
  mealSlotId: string;
  includeNotes?: boolean;
  includePhoto?: boolean;
  customName?: string;
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body: SaveAsCustomRequest = await request.json();

    if (!body.sourceMealId) {
      return NextResponse.json({ error: 'Missing sourceMealId' }, { status: 400 });
    }

    // Get the source meal
    const sourceMeal = await getMealById(body.sourceMealId);
    if (!sourceMeal) {
      return NextResponse.json({ error: 'Source meal not found' }, { status: 404 });
    }

    // Get cooking status data if we need notes or photo
    let cookingStatusData = null;
    if ((body.includeNotes || body.includePhoto) && body.mealSlotId) {
      const { data: statusData } = await supabase
        .from('meal_plan_meal_cooking_status')
        .select('*')
        .eq('meal_plan_meal_id', body.mealSlotId)
        .single();

      cookingStatusData = statusData;
    }

    // Create the custom meal name
    const customName = body.customName || `${sourceMeal.name} (My Version)`;

    // Build prep instructions from notes if requested
    let prepInstructions = sourceMeal.prep_instructions || '';
    if (body.includeNotes && cookingStatusData?.modification_notes) {
      prepInstructions = prepInstructions
        ? `${prepInstructions}\n\nMy notes: ${cookingStatusData.modification_notes}`
        : `My notes: ${cookingStatusData.modification_notes}`;
    }

    // Get photo storage path if requested
    // We store the storage path, not a signed URL - signed URLs are generated on fetch
    const imageUrl =
      body.includePhoto && cookingStatusData?.cooked_photo_url
        ? cookingStatusData.cooked_photo_url
        : sourceMeal.image_url;

    // Create the custom meal
    const newMeal = await createCustomMeal(user.id, {
      name: customName,
      mealType: sourceMeal.meal_type,
      ingredients: sourceMeal.ingredients,
      instructions: sourceMeal.instructions,
      prepTimeMinutes: sourceMeal.prep_time_minutes,
      prepInstructions: prepInstructions || undefined,
      isPublic: false,
      imageUrl: imageUrl || undefined,
    });

    return NextResponse.json({
      success: true,
      meal: newMeal,
    });
  } catch (error) {
    console.error('Error saving meal as custom:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
