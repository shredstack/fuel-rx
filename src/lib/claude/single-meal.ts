import type { Tool } from '@anthropic-ai/sdk/resources/messages';
import { callLLMWithToolUse } from './client';
import type {
  UserProfile,
  MealType,
  MealPlanTheme,
  ThemeIngredientGuidance,
  GeneratedMeal,
  IngredientWithNutrition,
  Macros,
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

function buildSingleMealPrompt(params: SingleMealGenerationParams): string {
  const { profile, mealType, theme, customInstructions, ingredientPreferences } = params;
  const servings = calculateHouseholdServings(profile);

  let prompt = `You are a meal planning assistant for FuelRx, an app for CrossFit athletes.

Generate a single ${mealType} meal for a CrossFit athlete.

## User Profile
- Daily calorie target: ${profile.target_calories} kcal
- Macro targets: ${profile.target_protein}g protein, ${profile.target_carbs}g carbs, ${profile.target_fat}g fat
- Household size: ${servings} serving(s)
- Dietary restrictions: ${profile.dietary_prefs?.length > 0 ? profile.dietary_prefs.join(', ') : 'None'}

## Preferences
- Liked ingredients: ${ingredientPreferences?.liked?.length ? ingredientPreferences.liked.join(', ') : 'None specified'}
- Disliked ingredients (AVOID THESE): ${ingredientPreferences?.disliked?.length ? ingredientPreferences.disliked.join(', ') : 'None specified'}
`;

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

  prompt += `
## Requirements
1. Create ONE delicious ${mealType} that's practical for a home cook
2. Scale ingredients for ${servings} serving(s)
3. Each ingredient MUST include its individual nutrition values (per the scaled amount for all servings)
4. Total meal macros = sum of all ingredient macros
5. Keep instructions clear and actionable (numbered steps)
6. Include prep time (hands-on) and cook time (waiting/cooking)
7. Give the meal a fun, appetizing name with an appropriate emoji
8. Include 2-3 helpful pro tips
9. Focus on whole, nutrient-dense foods appropriate for athletes
10. NEVER use ingredients from the disliked list

Use the generate_single_meal tool to provide your meal.`;

  return prompt;
}

export async function generateSingleMeal(
  params: SingleMealGenerationParams
): Promise<GeneratedMeal> {
  const prompt = buildSingleMealPrompt(params);

  const { result } = await callLLMWithToolUse<LLMMealResponse>({
    prompt,
    tool: singleMealTool,
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
