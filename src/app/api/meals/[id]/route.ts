/**
 * Single Meal API Endpoint
 *
 * GET /api/meals/[id] - Get a single meal
 * PUT /api/meals/[id] - Update a meal
 * DELETE /api/meals/[id] - Delete a meal
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getMealById, updateMeal, deleteMeal } from '@/lib/meal-service';
import type { MealType, IngredientWithNutrition } from '@/lib/types';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const meal = await getMealById(id);

    if (!meal) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    // Check if user can access this meal (own or public)
    if (meal.source_user_id !== user.id && !meal.is_public) {
      return NextResponse.json({ error: 'Meal not found' }, { status: 404 });
    }

    return NextResponse.json({ meal });
  } catch (error) {
    console.error('Error fetching meal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    // Validate meal type if provided
    if (body.mealType && !['breakfast', 'lunch', 'dinner', 'snack'].includes(body.mealType)) {
      return NextResponse.json(
        { error: 'Invalid mealType. Must be one of: breakfast, lunch, dinner, snack' },
        { status: 400 }
      );
    }

    // Validate ingredients if provided
    if (body.ingredients) {
      for (const ing of body.ingredients as IngredientWithNutrition[]) {
        if (!ing.name || ing.calories === undefined || ing.protein === undefined ||
            ing.carbs === undefined || ing.fat === undefined) {
          return NextResponse.json(
            { error: 'Each ingredient must have: name, calories, protein, carbs, fat' },
            { status: 400 }
          );
        }
      }
    }

    const meal = await updateMeal(id, user.id, {
      name: body.name,
      mealType: body.mealType as MealType,
      ingredients: body.ingredients,
      instructions: body.instructions,
      calories: body.calories,
      protein: body.protein,
      carbs: body.carbs,
      fat: body.fat,
      prepTimeMinutes: body.prepTimeMinutes,
      prepInstructions: body.prepInstructions,
      isPublic: body.isPublic,
      imageUrl: body.imageUrl,
      isNutritionEditedByUser: body.isNutritionEditedByUser,
    });

    return NextResponse.json({ meal });
  } catch (error) {
    console.error('Error updating meal:', error);

    if (error instanceof Error && error.message.includes('duplicate')) {
      return NextResponse.json(
        { error: 'A meal with this name already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;

    await deleteMeal(id, user.id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting meal:', error);

    // Handle foreign key constraint (meal is used in a meal plan)
    if (error instanceof Error && error.message.includes('violates foreign key')) {
      return NextResponse.json(
        { error: 'Cannot delete meal that is used in a meal plan' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
