import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { generateSingleMeal } from '@/lib/claude/single-meal';
import { generatePartyPrepGuide } from '@/lib/claude/party-meal';
import { fetchRecipeContent } from '@/lib/recipe-fetch';
import { checkAiAccess, createAiAccessDeniedResponse } from '@/lib/subscription/check-ai-access';
import type { MealType, PartyType, MealPlanTheme, IngredientUsageMode } from '@/lib/types';

export async function POST(request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check AI feature access
    const aiAccess = await checkAiAccess(user.id);
    if (!aiAccess.allowed) {
      return createAiAccessDeniedResponse();
    }

    const body = await request.json();
    const {
      mode,
      mealType,
      guestCount,
      partyType,
      themeId,
      customInstructions,
      selectedIngredients,
      ingredientUsageMode,
      recipeUrl,
      dishCount,
      sameDayPrepOnly,
    } = body as {
      mode: 'normal' | 'party';
      mealType?: MealType;
      guestCount?: number;
      partyType?: PartyType;
      themeId?: string;
      customInstructions?: string;
      selectedIngredients?: string[];
      ingredientUsageMode?: IngredientUsageMode;
      recipeUrl?: string;
      dishCount?: number;
      sameDayPrepOnly?: boolean;
    };

    // Validate mode
    if (mode !== 'normal' && mode !== 'party') {
      return NextResponse.json({ error: 'Invalid mode. Must be "normal" or "party"' }, { status: 400 });
    }

    // Validate normal mode params
    if (mode === 'normal' && !mealType) {
      return NextResponse.json({ error: 'mealType is required for normal mode' }, { status: 400 });
    }

    // Validate party mode params
    if (mode === 'party') {
      if (!guestCount || guestCount < 1) {
        return NextResponse.json({ error: 'guestCount must be at least 1' }, { status: 400 });
      }
      if (!partyType) {
        return NextResponse.json({ error: 'partyType is required for party mode' }, { status: 400 });
      }
    }

    // Fetch user profile
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: 'User profile not found' }, { status: 404 });
    }

    // Fetch theme if specified
    let theme: MealPlanTheme | null = null;
    if (themeId && themeId !== 'none' && themeId !== 'surprise') {
      const { data: themeData } = await supabase
        .from('meal_plan_themes')
        .select('*')
        .eq('id', themeId)
        .single();
      theme = themeData;
    }

    // Fetch ingredient preferences
    const { data: ingredientPrefs } = await supabase
      .from('ingredient_preferences_with_details')
      .select('ingredient_name, preference')
      .eq('user_id', user.id);

    const ingredientPreferences = {
      liked: ingredientPrefs?.filter(p => p.preference === 'liked').map(p => p.ingredient_name) || [],
      disliked: ingredientPrefs?.filter(p => p.preference === 'disliked').map(p => p.ingredient_name) || [],
    };

    if (mode === 'normal') {
      const result = await generateSingleMeal({
        profile,
        mealType: mealType!,
        theme,
        customInstructions,
        ingredientPreferences,
        selectedIngredients,
        ingredientUsageMode,
      });

      return NextResponse.json({ meal: result });
    } else {
      // Party mode - fetch recipe URL if provided
      let fetchedRecipeContent: string | undefined;

      if (recipeUrl) {
        const fetchedRecipe = await fetchRecipeContent(recipeUrl);
        if (fetchedRecipe.error) {
          console.warn('Failed to fetch recipe URL:', fetchedRecipe.error);
          // Don't fail the request, just log the warning
        } else if (fetchedRecipe.content) {
          fetchedRecipeContent = fetchedRecipe.content;
        }
      }

      const result = await generatePartyPrepGuide({
        profile,
        guestCount: guestCount!,
        partyType: partyType!,
        theme,
        customInstructions,
        dietaryConsiderations: profile.dietary_prefs || [],
        fetchedRecipeContent,
        dishCount,
        sameDayPrepOnly,
      });

      return NextResponse.json({ guide: result });
    }
  } catch (error) {
    console.error('Quick cook generation failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate meal' },
      { status: 500 }
    );
  }
}
