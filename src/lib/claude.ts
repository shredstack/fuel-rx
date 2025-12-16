import Anthropic from '@anthropic-ai/sdk';
import type { UserProfile, DayPlan, Ingredient, MealConsistencyPrefs, MealType, Meal, Macros } from './types';
import { DEFAULT_MEAL_CONSISTENCY_PREFS } from './types';
import { createClient } from './supabase/server';

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const DIETARY_LABELS: Record<string, string> = {
  no_restrictions: 'No Restrictions',
  paleo: 'Paleo',
  vegetarian: 'Vegetarian',
  gluten_free: 'Gluten-Free',
  dairy_free: 'Dairy-Free',
};

const DAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] as const;

interface ValidatedMealMacros {
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

interface LLMLogEntry {
  user_id: string;
  prompt: string;
  output: string;
  model: string;
  prompt_type: string;
  tokens_used?: number;
  duration_ms?: number;
}

async function logLLMCall(entry: LLMLogEntry): Promise<void> {
  try {
    const supabase = await createClient();
    await supabase.from('llm_logs').insert(entry);
  } catch (error) {
    // Don't fail the main operation if logging fails
    console.error('Failed to log LLM call:', error);
  }
}

function buildBasePromptContext(
  profile: UserProfile,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[]
): string {
  const dietaryPrefs = profile.dietary_prefs ?? ['no_restrictions'];
  const dietaryPrefsText = dietaryPrefs
    .map(pref => DIETARY_LABELS[pref] || pref)
    .join(', ') || 'No restrictions';

  const recentMealsExclusion = recentMealNames && recentMealNames.length > 0
    ? `\n## IMPORTANT: Meal Variety Requirement\nAVOID these recently used meals from the user's last meal plan: ${recentMealNames.join(', ')}. Create entirely new and different meals to provide variety.\n`
    : '';

  let mealPreferencesSection = '';
  if (mealPreferences) {
    const parts: string[] = [];
    if (mealPreferences.liked.length > 0) {
      parts.push(`**Meals the user LIKES** (try to include similar meals or these exact meals): ${mealPreferences.liked.join(', ')}`);
    }
    if (mealPreferences.disliked.length > 0) {
      parts.push(`**Meals the user DISLIKES** (AVOID these meals and similar ones): ${mealPreferences.disliked.join(', ')}`);
    }
    if (parts.length > 0) {
      mealPreferencesSection = `\n## User Meal Preferences\n${parts.join('\n')}\n`;
    }
  }

  let validatedMealsSection = '';
  if (validatedMeals && validatedMeals.length > 0) {
    const mealsList = validatedMeals.map(m =>
      `- "${m.meal_name}": ${m.calories} kcal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
    ).join('\n');
    validatedMealsSection = `
## User-Validated Meal Nutrition Data
The user has corrected the nutrition data for the following meals. When generating these meals or similar meals, use these EXACT macro values as a reference:
${mealsList}
`;
  }

  return `You are a nutrition expert specializing in meal planning for CrossFit athletes.
${recentMealsExclusion}${mealPreferencesSection}${validatedMealsSection}
## User Profile
- Daily Calorie Target: ${profile.target_calories} kcal
- Daily Protein Target: ${profile.target_protein}g
- Daily Carbohydrate Target: ${profile.target_carbs}g
- Daily Fat Target: ${profile.target_fat}g
- Dietary Preferences: ${dietaryPrefsText}
- Meals Per Day: ${profile.meals_per_day}
- Maximum Prep Time Per Meal: ${profile.prep_time} minutes
${profile.weight ? `- Weight: ${profile.weight} lbs` : ''}

## CRITICAL Requirements
1. **ONLY recommend healthy, whole foods that are non-processed or minimally processed**
2. NO ultra-processed foods, artificial ingredients, or packaged convenience foods
3. Focus on: lean proteins, vegetables, fruits, whole grains, legumes, nuts, seeds, and healthy fats
4. Recipes must be practical and achievable within the specified prep time

## CRITICAL NUTRITION ACCURACY REQUIREMENTS
- Use USDA nutritional database values as your reference for all calculations
- Use standard serving sizes and be specific about measurements (e.g., "4 oz chicken breast" not "1 chicken breast")
- When calculating macros, double-check that each meal's macros add up correctly using these standards:
  - Protein: 4 calories per gram
  - Carbohydrates: 4 calories per gram
  - Fat: 9 calories per gram
- Verify that calories = (protein × 4) + (carbs × 4) + (fat × 9) for each meal
- IMPORTANT: Prioritize realistic, accurate nutrition data over hitting exact targets. Do NOT fabricate or round numbers to artificially match targets.`;
}

interface MealTypeResult {
  meals: Meal[];
}

async function generateMealsForType(
  profile: UserProfile,
  mealType: MealType,
  isConsistent: boolean,
  baseContext: string,
  userId: string
): Promise<Meal[]> {
  const mealTypeLabel = mealType.charAt(0).toUpperCase() + mealType.slice(1);
  const numMeals = isConsistent ? 1 : 7;

  // Calculate target macros per meal based on meals per day
  const targetCaloriesPerMeal = Math.round(profile.target_calories / profile.meals_per_day);
  const targetProteinPerMeal = Math.round(profile.target_protein / profile.meals_per_day);
  const targetCarbsPerMeal = Math.round(profile.target_carbs / profile.meals_per_day);
  const targetFatPerMeal = Math.round(profile.target_fat / profile.meals_per_day);

  const prompt = `${baseContext}

## Task
Generate ${numMeals} ${mealTypeLabel.toLowerCase()} meal${numMeals > 1 ? 's' : ''} for a 7-day meal plan.
${isConsistent
  ? `This is a CONSISTENT meal - generate ONE meal that will be eaten every day for 7 days.`
  : `These are VARIED meals - generate 7 DIFFERENT ${mealTypeLabel.toLowerCase()} meals, one for each day (Monday through Sunday). Each meal should be unique.`}

Target macros per ${mealTypeLabel.toLowerCase()} (approximately):
- Calories: ~${targetCaloriesPerMeal} kcal
- Protein: ~${targetProteinPerMeal}g
- Carbs: ~${targetCarbsPerMeal}g
- Fat: ~${targetFatPerMeal}g

## Response Format
Return ONLY valid JSON with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "meals": [
    {
      "name": "Meal name",
      "type": "${mealType}",
      "prep_time_minutes": 15,
      "ingredients": [
        {
          "name": "ingredient name",
          "amount": "2",
          "unit": "cups",
          "category": "produce|protein|dairy|grains|pantry|frozen|other"
        }
      ],
      "instructions": ["Step 1", "Step 2"],
      "macros": {
        "calories": 500,
        "protein": 35,
        "carbs": 45,
        "fat": 20
      }
    }
  ]
}

${isConsistent
  ? 'Generate exactly 1 meal in the "meals" array.'
  : 'Generate exactly 7 different meals in the "meals" array, in order for Monday through Sunday.'}`;

  const startTime = Date.now();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [{ role: 'user', content: prompt }],
  });
  const duration = Date.now() - startTime;

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Log the LLM call
  await logLLMCall({
    user_id: userId,
    prompt,
    output: responseText,
    model: 'claude-sonnet-4-20250514',
    prompt_type: `meal_type_batch_${mealType}`,
    tokens_used: message.usage?.output_tokens,
    duration_ms: duration,
  });

  // Check for truncation
  if (message.stop_reason === 'max_tokens') {
    throw new Error(`Response was truncated for ${mealType} meals. This should not happen with batched approach.`);
  }

  // Parse the JSON response
  let jsonText = responseText.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed: MealTypeResult = JSON.parse(jsonText);
  return parsed.meals;
}

function getMealTypesForPlan(mealsPerDay: number): MealType[] {
  switch (mealsPerDay) {
    case 3:
      return ['breakfast', 'lunch', 'dinner'];
    case 4:
      return ['breakfast', 'lunch', 'dinner', 'snack'];
    case 5:
      return ['breakfast', 'snack', 'lunch', 'snack', 'dinner'];
    case 6:
      return ['breakfast', 'snack', 'lunch', 'snack', 'dinner', 'snack'];
    default:
      return ['breakfast', 'lunch', 'dinner'];
  }
}

function collectRawIngredients(days: DayPlan[]): Ingredient[] {
  // Collect all ingredients without consolidation for LLM processing
  const allIngredients: Ingredient[] = [];

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ingredient of meal.ingredients) {
        allIngredients.push({ ...ingredient });
      }
    }
  }

  return allIngredients;
}

async function consolidateGroceryListWithLLM(
  rawIngredients: Ingredient[],
  userId: string
): Promise<Ingredient[]> {
  // Group raw ingredients by name similarity for the prompt
  const ingredientSummary = rawIngredients.map(i =>
    `${i.amount} ${i.unit} ${i.name} (${i.category})`
  ).join('\n');

  const prompt = `You are a helpful assistant that creates practical grocery shopping lists.

## Task
Take this raw list of ingredients from a 7-day meal plan and consolidate them into a practical grocery shopping list.

## Raw Ingredients (one per line):
${ingredientSummary}

## Instructions
1. **Combine similar ingredients**: Merge items that are the same ingredient even if described differently (e.g., "avocado", "avocado, sliced", "1/2 avocado" should all become one "Avocados" entry)
2. **Use practical shopping quantities**: Convert to units you'd actually buy at a store:
   - Use "whole" or count for items bought individually (e.g., "3 Avocados" not "2.5 medium avocado")
   - Use "bag" for items typically sold in bags (e.g., "1 bag Carrots" or "2 bags Spinach")
   - Use "bunch" for herbs and leafy greens sold in bunches
   - Use "lb" or "oz" for meats and proteins
   - Use "can" or "jar" for canned/jarred items
   - Use "dozen" for eggs
   - Use "container" or "package" for items sold that way (e.g., yogurt, tofu)
3. **Round up to whole numbers**: Always round up to ensure the shopper has enough (e.g., 1.3 avocados → 2 avocados)
4. **Keep practical minimums**: Don't list less than you can buy (e.g., at least 1 bag of carrots, at least 1 bunch of cilantro)
5. **Preserve categories**: Keep the same category for each ingredient

## Response Format
Return ONLY valid JSON with this exact structure (no markdown, no code blocks, just raw JSON):
{
  "grocery_list": [
    {
      "name": "Ingredient name (capitalized, simple)",
      "amount": "2",
      "unit": "whole",
      "category": "produce|protein|dairy|grains|pantry|frozen|other"
    }
  ]
}

Sort the list by category (produce, protein, dairy, grains, pantry, frozen, other) then alphabetically by name within each category.`;

  const startTime = Date.now();
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4000,
    messages: [{ role: 'user', content: prompt }],
  });
  const duration = Date.now() - startTime;

  const responseText = message.content[0].type === 'text' ? message.content[0].text : '';

  // Log the LLM call
  await logLLMCall({
    user_id: userId,
    prompt,
    output: responseText,
    model: 'claude-sonnet-4-20250514',
    prompt_type: 'grocery_list_consolidation',
    tokens_used: message.usage?.output_tokens,
    duration_ms: duration,
  });

  // Parse the JSON response
  let jsonText = responseText.trim();
  if (jsonText.startsWith('```')) {
    jsonText = jsonText.replace(/^```(?:json)?\s*\n?/, '').replace(/\n?```\s*$/, '');
  }

  const parsed: { grocery_list: Ingredient[] } = JSON.parse(jsonText);
  return parsed.grocery_list;
}

export async function generateMealPlan(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[]
): Promise<{
  days: DayPlan[];
  grocery_list: Ingredient[];
}> {
  const mealConsistencyPrefs = profile.meal_consistency_prefs ?? DEFAULT_MEAL_CONSISTENCY_PREFS;
  const baseContext = buildBasePromptContext(profile, recentMealNames, mealPreferences, validatedMeals);

  // Determine which meal types we need based on meals per day
  const mealTypesNeeded = getMealTypesForPlan(profile.meals_per_day);
  const uniqueMealTypes = Array.from(new Set(mealTypesNeeded)) as MealType[];

  // Generate meals for each type in parallel
  const mealTypePromises = uniqueMealTypes.map(mealType => {
    const isConsistent = mealConsistencyPrefs[mealType] === 'consistent';
    return generateMealsForType(profile, mealType, isConsistent, baseContext, userId)
      .then(meals => ({ mealType, meals, isConsistent }));
  });

  const mealTypeResults = await Promise.all(mealTypePromises);

  // Build a map of meal type to meals
  const mealsByType = new Map<MealType, { meals: Meal[]; isConsistent: boolean }>();
  for (const result of mealTypeResults) {
    mealsByType.set(result.mealType, { meals: result.meals, isConsistent: result.isConsistent });
  }

  // Assemble the 7-day plan
  const days: DayPlan[] = DAYS.map((day, dayIndex) => {
    const mealsForDay: Meal[] = [];

    // Track snack index for days with multiple snacks
    let snackIndex = 0;

    for (const mealType of mealTypesNeeded) {
      const typeData = mealsByType.get(mealType);
      if (!typeData) continue;

      let meal: Meal;
      if (typeData.isConsistent) {
        // Use the same meal for all days
        meal = { ...typeData.meals[0] };
      } else {
        // Use the day-specific meal
        if (mealType === 'snack') {
          // Handle multiple snacks per day - use different snacks if available
          const snackMealIndex = (dayIndex + snackIndex) % typeData.meals.length;
          meal = { ...typeData.meals[snackMealIndex] };
          snackIndex++;
        } else {
          meal = { ...typeData.meals[dayIndex] };
        }
      }

      mealsForDay.push(meal);
    }

    // Calculate daily totals
    const daily_totals: Macros = mealsForDay.reduce(
      (totals, meal) => ({
        calories: totals.calories + meal.macros.calories,
        protein: totals.protein + meal.macros.protein,
        carbs: totals.carbs + meal.macros.carbs,
        fat: totals.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return {
      day,
      meals: mealsForDay,
      daily_totals,
    };
  });

  // Collect raw ingredients and consolidate with LLM for practical shopping list
  const rawIngredients = collectRawIngredients(days);
  const grocery_list = await consolidateGroceryListWithLLM(rawIngredients, userId);

  return { days, grocery_list };
}
