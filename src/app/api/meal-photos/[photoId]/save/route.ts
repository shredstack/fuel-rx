import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import type { MealType, SaveMealPhotoOptions } from '@/lib/types';

interface RouteParams {
  params: Promise<{
    photoId: string;
  }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  const supabase = await createClient();
  const { photoId } = await params;

  // Get current user
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body: SaveMealPhotoOptions = await request.json();
    const { saveTo, mealType, editedName, editedIngredients, notes, consumedAt } = body;

    // Get photo record and verify ownership
    const { data: photo, error: photoError } = await supabase
      .from('meal_photos')
      .select('*')
      .eq('id', photoId)
      .eq('user_id', user.id)
      .single();

    if (photoError || !photo) {
      return NextResponse.json({ error: 'Photo not found' }, { status: 404 });
    }

    if (photo.analysis_status !== 'completed') {
      return NextResponse.json({ error: 'Photo has not been analyzed yet' }, { status: 400 });
    }

    // Use edited values if provided, otherwise use original analysis
    const mealName = editedName || photo.meal_name || 'Meal from Photo';

    // Calculate totals from edited ingredients if provided
    let totalCalories = photo.total_calories;
    let totalProtein = photo.total_protein;
    let totalCarbs = photo.total_carbs;
    let totalFat = photo.total_fat;

    if (editedIngredients && editedIngredients.length > 0) {
      totalCalories = editedIngredients.reduce((sum, ing) => sum + (ing.calories || 0), 0);
      totalProtein = editedIngredients.reduce((sum, ing) => sum + (ing.protein || 0), 0);
      totalCarbs = editedIngredients.reduce((sum, ing) => sum + (ing.carbs || 0), 0);
      totalFat = editedIngredients.reduce((sum, ing) => sum + (ing.fat || 0), 0);
    }

    let consumptionEntryId: string | null = null;
    let savedMealId: string | null = null;

    // Save to consumption log
    if (saveTo === 'consumption' || saveTo === 'both') {
      // Use provided consumedAt or fall back to current time
      const consumedAtValue = consumedAt || new Date().toISOString();
      const consumedDate = consumedAtValue.split('T')[0];

      const { data: consumptionEntry, error: consumptionError } = await supabase
        .from('meal_consumption_log')
        .insert({
          user_id: user.id,
          entry_type: 'photo_meal',
          consumed_at: consumedAtValue,
          consumed_date: consumedDate,
          display_name: mealName,
          meal_type: mealType || null,
          calories: Math.round(totalCalories),
          protein: Math.round(totalProtein * 10) / 10,
          carbs: Math.round(totalCarbs * 10) / 10,
          fat: Math.round(totalFat * 10) / 10,
          notes: notes || `Logged from meal photo`,
          source_photo_id: photoId,
        })
        .select('id')
        .single();

      if (consumptionError) {
        console.error('Error creating consumption entry:', consumptionError);
        return NextResponse.json({ error: 'Failed to log meal to consumption' }, { status: 500 });
      }

      consumptionEntryId = consumptionEntry.id;
    }

    // Save to meal library
    if (saveTo === 'library' || saveTo === 'both') {
      // Build ingredients array for meals table
      const ingredientsForMeal = editedIngredients || photo.raw_analysis?.ingredients || [];
      const formattedIngredients = ingredientsForMeal.map((ing: { name: string; estimated_amount: string; estimated_unit: string; calories: number; protein: number; carbs: number; fat: number }) => ({
        name: ing.name,
        amount: ing.estimated_amount,
        unit: ing.estimated_unit,
        category: 'other' as const,
        calories: ing.calories,
        protein: ing.protein,
        carbs: ing.carbs,
        fat: ing.fat,
      }));

      const { data: savedMeal, error: mealError } = await supabase
        .from('meals')
        .insert({
          name: mealName,
          name_normalized: mealName.toLowerCase().trim(),
          meal_type: mealType || 'lunch',
          ingredients: formattedIngredients,
          instructions: [],
          calories: Math.round(totalCalories),
          protein: Math.round(totalProtein * 10) / 10,
          carbs: Math.round(totalCarbs * 10) / 10,
          fat: Math.round(totalFat * 10) / 10,
          prep_time_minutes: 0,
          is_user_created: true,
          is_nutrition_edited_by_user: !!editedIngredients,
          source_type: 'photo_analyzed',
          source_user_id: user.id,
          source_photo_id: photoId,
          is_public: false,
          image_url: photo.image_url,
        })
        .select('id')
        .single();

      if (mealError) {
        console.error('Error saving meal to library:', mealError);
        return NextResponse.json({ error: 'Failed to save meal to library' }, { status: 500 });
      }

      savedMealId = savedMeal.id;
    }

    // Update meal_photos with links to consumption/saved meal
    await supabase
      .from('meal_photos')
      .update({
        consumption_entry_id: consumptionEntryId,
        saved_meal_id: savedMealId,
      })
      .eq('id', photoId);

    // Build response message
    let message = '';
    if (saveTo === 'both') {
      message = 'Meal logged and saved to library';
    } else if (saveTo === 'consumption') {
      message = 'Meal logged to consumption';
    } else {
      message = 'Meal saved to library';
    }

    return NextResponse.json({
      success: true,
      message,
      consumptionEntryId,
      savedMealId,
      mealName,
      macros: {
        calories: Math.round(totalCalories),
        protein: Math.round(totalProtein * 10) / 10,
        carbs: Math.round(totalCarbs * 10) / 10,
        fat: Math.round(totalFat * 10) / 10,
      },
    });
  } catch (error) {
    console.error('Error saving meal photo:', error);
    return NextResponse.json({ error: 'Failed to save meal' }, { status: 500 });
  }
}
