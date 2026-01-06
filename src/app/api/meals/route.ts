/**
 * Meals API Endpoint
 *
 * GET /api/meals - List user's meals with filters
 * POST /api/meals - Create a new custom meal
 */

import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { getUserMeals, createCustomMeal } from '@/lib/meal-service';
import type { MealType, IngredientWithNutrition } from '@/lib/types';

export async function GET(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const mealType = searchParams.get('mealType') as MealType | null;
    const isUserCreated = searchParams.get('isUserCreated');
    const search = searchParams.get('search');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    const meals = await getUserMeals(user.id, {
      mealType: mealType || undefined,
      isUserCreated: isUserCreated === 'true' ? true : isUserCreated === 'false' ? false : undefined,
      search: search || undefined,
      limit,
      offset,
    });

    return NextResponse.json({ meals, total: meals.length });
  } catch (error) {
    console.error('Error fetching meals:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const {
      name,
      mealType,
      ingredients,
      instructions,
      prepTimeMinutes,
      prepInstructions,
      isPublic,
      imageUrl,
    } = body;

    // Validate required fields
    if (!name || !mealType || !ingredients || !Array.isArray(ingredients)) {
      return NextResponse.json(
        { error: 'Missing required fields: name, mealType, ingredients' },
        { status: 400 }
      );
    }

    // Validate meal type
    if (!['breakfast', 'lunch', 'dinner', 'snack'].includes(mealType)) {
      return NextResponse.json(
        { error: 'Invalid mealType. Must be one of: breakfast, lunch, dinner, snack' },
        { status: 400 }
      );
    }

    // Validate ingredients have required nutrition data
    for (const ing of ingredients as IngredientWithNutrition[]) {
      if (!ing.name || ing.calories === undefined || ing.protein === undefined ||
          ing.carbs === undefined || ing.fat === undefined) {
        return NextResponse.json(
          { error: 'Each ingredient must have: name, calories, protein, carbs, fat' },
          { status: 400 }
        );
      }
    }

    const meal = await createCustomMeal(user.id, {
      name,
      mealType,
      ingredients,
      instructions: instructions || [],
      prepTimeMinutes: prepTimeMinutes || 15,
      prepInstructions,
      isPublic: isPublic || false,
      imageUrl,
    });

    return NextResponse.json({ meal }, { status: 201 });
  } catch (error) {
    console.error('Error creating meal:', error);

    // Handle unique constraint violation
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
