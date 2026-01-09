import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { callLLMWithToolUse } from './client';
import { fetchCachedNutrition, buildNutritionReferenceSection, cacheIngredientNutrition } from './ingredient-cache';
import type {
  UserProfile,
  MealType,
  MealPlanTheme,
  ThemeIngredientGuidance,
  GeneratedMeal,
  IngredientWithNutrition,
  Macros,
  IngredientUsageMode,
} from '../types';

// ============================================
// Single Meal Generation
// ============================================

export interface SingleMealGenerationParams {
  profile: UserProfile;
  mealType: MealType;
  theme?: MealPlanTheme | null;
  customInstructions?: string;
  ingredientPreferences?: {
    liked: string[];
    disliked: string[];
  };
  selectedIngredients?: string[];
  ingredientUsageMode?: IngredientUsageMode;
}

interface LLMIngredient {
  name: string;
  amount: string;
  unit: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface LLMMealResponse {
  meal: {
    name: string;
    emoji: string;
    type: string;
    description: string;
    ingredients: LLMIngredient[];
    instructions: string[];
    macros: {
      calories: number;
      protein: number;
      carbs: number;
      fat: number;
    };
    prep_time_minutes: number;
    cook_time_minutes: number;
    servings: number;
    tips: string[];
  };
}

const singleMealTool: Tool = {
  name: 'generate_single_meal',
  description: 'Generate a single meal with ingredients and instructions',
  input_schema: {
    type: 'object' as const,
    properties: {
      meal: {
        type: 'object' as const,
        properties: {
          name: { type: 'string' as const },
          emoji: { type: 'string' as const },
          type: { type: 'string' as const, enum: ['breakfast', 'lunch', 'dinner', 'snack'] },
          description: { type: 'string' as const },
          ingredients: {
            type: 'array' as const,
            items: {
              type: 'object' as const,
              properties: {
                name: { type: 'string' as const },
                amount: { type: 'string' as const },
                unit: { type: 'string' as const },
                calories: { type: 'number' as const },
                protein: { type: 'number' as const },
                carbs: { type: 'number' as const },
                fat: { type: 'number' as const },
              },
              required: ['name', 'amount', 'unit', 'calories', 'protein', 'carbs', 'fat'],
            },
          },
          instructions: { type: 'array' as const, items: { type: 'string' as const } },
          macros: {
            type: 'object' as const,
            properties: {
              calories: { type: 'number' as const },
              protein: { type: 'number' as const },
              carbs: { type: 'number' as const },
              fat: { type: 'number' as const },
            },
            required: ['calories', 'protein', 'carbs', 'fat'],
          },
          prep_time_minutes: { type: 'number' as const },
          cook_time_minutes: { type: 'number' as const },
          servings: { type: 'number' as const },
          tips: { type: 'array' as const, items: { type: 'string' as const } },
        },
        required: ['name', 'emoji', 'type', 'description', 'ingredients', 'instructions', 'macros', 'prep_time_minutes', 'cook_time_minutes', 'servings', 'tips'],
      },
    },
    required: ['meal'],
  },
};

function calculateHouseholdServings(profile: UserProfile): number {
  // For Quick Cook, we use a simplified serving count
  // Default to 1 if no household data
  if (!profile.household_servings) {
    return 1;
  }

  // Get average servings across all meals (simplified)
  let totalAdults = 0;
  let totalChildren = 0;
  let mealCount = 0;

  const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;
  const mealTypes = ['breakfast', 'lunch', 'dinner'] as const;

  for (const day of days) {
    for (const meal of mealTypes) {
      const servings = profile.household_servings[day]?.[meal];
      if (servings) {
        totalAdults += servings.adults;
        totalChildren += servings.children;
        mealCount++;
      }
    }
  }

  if (mealCount === 0) return 1;

  const avgAdults = totalAdults / mealCount;
  const avgChildren = totalChildren / mealCount;

  // 1 (main user) + additional adults + children at 0.6 portion
  return Math.round(1 + avgAdults + avgChildren * 0.6);
}

function buildSingleMealPrompt(params: SingleMealGenerationParams, nutritionReference: string): string {
  const { profile, mealType, theme, customInstructions, ingredientPreferences, selectedIngredients, ingredientUsageMode } = params;
  const servings = calculateHouseholdServings(profile);

  let prompt = `You are a meal planning assistant for FuelRx, an app for CrossFit athletes.

Generate a single ${mealType} meal for a CrossFit athlete.

## User Profile
- Household size: ${servings} serving(s)
- Dietary restrictions: ${profile.dietary_prefs?.length > 0 ? profile.dietary_prefs.join(', ') : 'None'}

## Preferences
- Liked ingredients: ${ingredientPreferences?.liked?.length ? ingredientPreferences.liked.join(', ') : 'None specified'}
- Disliked ingredients (AVOID THESE): ${ingredientPreferences?.disliked?.length ? ingredientPreferences.disliked.join(', ') : 'None specified'}
`;

  // Add selected ingredients section if provided
  if (selectedIngredients && selectedIngredients.length > 0) {
    const isOnlySelected = ingredientUsageMode === 'only_selected';
    prompt += `
## Selected Ingredients
The user has specifically selected these ingredients to use: ${selectedIngredients.join(', ')}

${isOnlySelected
  ? '**IMPORTANT**: You must ONLY use the ingredients listed above. Do not add any other ingredients except for basic seasonings (salt, pepper, herbs, spices, oil for cooking). This is a "use what I have" request.'
  : '**IMPORTANT**: You must include ALL of the selected ingredients listed above. You may also add other complementary ingredients as needed to create a complete, balanced meal.'}
`;
  }

  if (theme) {
    const guidance = theme.ingredient_guidance as ThemeIngredientGuidance;
    prompt += `
## Theme: ${theme.display_name}
${theme.description}

Flavor profile: ${guidance?.flavor_profile || 'Not specified'}
Suggested proteins: ${guidance?.proteins?.join(', ') || 'Any'}
Suggested vegetables: ${guidance?.vegetables?.join(', ') || 'Any'}
Cooking style: ${theme.cooking_style_guidance || 'Any style'}
`;
  }

  if (customInstructions) {
    prompt += `
## Special Request from User
${customInstructions}
`;
  }

  // Add nutrition reference if available
  if (nutritionReference) {
    prompt += nutritionReference;
  }

  prompt += `
## Requirements
1. Create ONE delicious ${mealType} that's practical for a home cook
2. Scale ingredients for ${servings} serving(s)
3. **CRITICAL - PER-SERVING NUTRITION**: Each ingredient's nutrition values (calories, protein, carbs, fat) MUST be for ONE SERVING only, not for all servings combined
4. **CRITICAL - MEAL MACROS**: The meal's total macros MUST also be for ONE SERVING only (sum of all per-serving ingredient macros)
5. The "servings" field should indicate the total number of servings the recipe makes (${servings})
6. Keep instructions clear and actionable (numbered steps)
7. Include prep time (hands-on) and cook time (waiting/cooking)
8. Give the meal a fun, appetizing name with an appropriate emoji
9. Include 2-3 helpful pro tips
10. Focus on whole, nutrient-dense foods appropriate for athletes
11. NEVER use ingredients from the disliked list

## CRITICAL NUTRITION ACCURACY
- **FIRST**: Check the NUTRITION REFERENCE section above for cached ingredient data - use those exact values when available
- **SECOND**: For ingredients NOT in the reference, use USDA FoodData Central guidelines to estimate realistic nutrition values
- **VALIDATION**: Verify that calories approximately = (protein × 4) + (carbs × 4) + (fat × 9) for each ingredient
- **REALISTIC PORTIONS**: A chicken thigh is ~110g raw and has ~200 calories, not 900. A cup of rice is ~200 calories. Keep portions realistic.

Use the generate_single_meal tool to provide your meal.`;

  return prompt;
}

export async function generateSingleMeal(
  params: SingleMealGenerationParams
): Promise<GeneratedMeal> {
  // Fetch cached nutrition data for common ingredients
  // We'll use ingredient preferences and selected ingredients to seed the cache lookup
  const ingredientNames = [
    ...(params.ingredientPreferences?.liked || []),
    ...(params.selectedIngredients || []),
  ];
  const nutritionCache = ingredientNames.length > 0
    ? await fetchCachedNutrition(ingredientNames)
    : new Map();
  const nutritionReference = buildNutritionReferenceSection(nutritionCache);

  const prompt = buildSingleMealPrompt(params, nutritionReference);

  // Use the same model as weekly meal plan generation (production config)
  const { result } = await callLLMWithToolUse<LLMMealResponse>({
    prompt,
    tool: singleMealTool,
    model: 'claude-sonnet-4-20250514',
    maxTokens: 4000,
    userId: params.profile.id,
    promptType: 'quick_cook_single_meal',
  });

  // Transform LLM response to our type
  const ingredients: IngredientWithNutrition[] = result.meal.ingredients.map((ing) => ({
    name: ing.name,
    amount: ing.amount,
    unit: ing.unit,
    category: 'other' as const, // Will be categorized later if needed
    calories: ing.calories,
    protein: ing.protein,
    carbs: ing.carbs,
    fat: ing.fat,
  }));

  // Cache all unique ingredients to ingredient_nutrition table
  // This builds our ingredient database over time for consistency
  const ingredientMap = new Map<string, {
    name: string;
    serving_size: number;
    serving_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  }>();

  for (const ingredient of result.meal.ingredients) {
    const normalizedName = ingredient.name.toLowerCase().trim();
    const servingSize = parseFloat(ingredient.amount) || 1;
    const servingUnit = ingredient.unit || 'serving';
    const key = `${normalizedName}|${servingSize}|${servingUnit}`;

    if (!ingredientMap.has(key) &&
        ingredient.calories !== undefined &&
        ingredient.protein !== undefined &&
        ingredient.carbs !== undefined &&
        ingredient.fat !== undefined) {
      ingredientMap.set(key, {
        name: ingredient.name,
        serving_size: servingSize,
        serving_unit: servingUnit,
        calories: ingredient.calories,
        protein: ingredient.protein,
        carbs: ingredient.carbs,
        fat: ingredient.fat,
      });
    }
  }

  // Cache all unique ingredients (async, don't block return)
  if (ingredientMap.size > 0) {
    const ingredientsToCache = Array.from(ingredientMap.values());
    cacheIngredientNutrition(ingredientsToCache).catch(err => {
      console.error('Failed to cache ingredient nutrition:', err);
    });
  }

  const macros: Macros = {
    calories: result.meal.macros.calories,
    protein: result.meal.macros.protein,
    carbs: result.meal.macros.carbs,
    fat: result.meal.macros.fat,
  };

  return {
    name: result.meal.name,
    emoji: result.meal.emoji,
    type: result.meal.type as MealType,
    description: result.meal.description,
    ingredients,
    instructions: result.meal.instructions,
    macros,
    prep_time_minutes: result.meal.prep_time_minutes,
    cook_time_minutes: result.meal.cook_time_minutes,
    servings: result.meal.servings,
    tips: result.meal.tips,
  };
}
