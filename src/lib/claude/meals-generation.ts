import type {
  UserProfile,
  CoreIngredients,
  MealPlanTheme,
  MealType,
  DayOfWeek,
  MealWithIngredientNutrition,
  MealComplexity,
} from '../types';
import { DEFAULT_MEAL_CONSISTENCY_PREFS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS, MEAL_COMPLEXITY_LABELS } from '../types';
import { callLLMWithToolUse } from './client';
import { fetchCachedNutrition, buildNutritionReferenceSection, cacheIngredientNutrition } from './ingredient-cache';
import { DIETARY_LABELS, getMealTypesForPlan, buildHouseholdContextSection } from './helpers';
import { mealsSchema } from '../llm-schemas';
import { getTestConfig } from '../claude_test';

interface ValidatedMealMacros {
  meal_name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

/**
 * Stage 2: Generate meals using ONLY the core ingredients
 * Creates meals constrained to the selected ingredients
 * Properly handles multiple snacks per day
 */
export async function generateMealsFromCoreIngredients(
  profile: UserProfile,
  coreIngredients: CoreIngredients,
  userId: string,
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[],
  theme?: MealPlanTheme
): Promise<{ title: string; meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }> {
  const dietaryPrefs = profile.dietary_prefs ?? ['no_restrictions'];
  const dietaryPrefsText = dietaryPrefs
    .map(pref => DIETARY_LABELS[pref] || pref)
    .join(', ') || 'No restrictions';

  const mealConsistencyPrefs = profile.meal_consistency_prefs ?? DEFAULT_MEAL_CONSISTENCY_PREFS;

  // Build the ingredients list as JSON
  const ingredientsJSON = JSON.stringify(coreIngredients, null, 2);

  // Calculate per-meal targets
  const targetCaloriesPerMeal = Math.round(profile.target_calories / profile.meals_per_day);
  const targetProteinPerMeal = Math.round(profile.target_protein / profile.meals_per_day);
  const targetCarbsPerMeal = Math.round(profile.target_carbs / profile.meals_per_day);
  const targetFatPerMeal = Math.round(profile.target_fat / profile.meals_per_day);

  // Determine meal types needed and count snacks
  const mealTypesNeeded = getMealTypesForPlan(profile.meals_per_day);
  const snacksPerDay = mealTypesNeeded.filter(t => t === 'snack').length;
  const uniqueMealTypes = Array.from(new Set(mealTypesNeeded)) as MealType[];

  // Build consistency instructions with proper snack count
  const consistencyInstructions = uniqueMealTypes.map(type => {
    const isConsistent = mealConsistencyPrefs[type] === 'consistent';
    if (type === 'snack' && snacksPerDay > 1) {
      // Special handling for multiple snacks per day
      if (isConsistent) {
        return `- Snack: Generate ${snacksPerDay} different snacks (the user has ${snacksPerDay} snack slots per day, eaten consistently all 7 days)`;
      }
      return `- Snack: Generate ${snacksPerDay * 7} different snacks (${snacksPerDay} per day × 7 days = ${snacksPerDay * 7} total snacks)`;
    }
    if (isConsistent) {
      return `- ${type.charAt(0).toUpperCase() + type.slice(1)}: Generate 1 meal (will be eaten all 7 days)`;
    }
    return `- ${type.charAt(0).toUpperCase() + type.slice(1)}: Generate 7 different meals (one per day)`;
  }).join('\n');

  // Build meal complexity instructions based on user preferences
  const breakfastComplexity = profile.breakfast_complexity || 'minimal_prep';
  const lunchComplexity = profile.lunch_complexity || 'minimal_prep';
  const dinnerComplexity = profile.dinner_complexity || 'full_recipe';

  const complexityInstructions = `
## MEAL COMPLEXITY PREFERENCES
The user has specified how complex they want each meal type:

- **Breakfast**: ${MEAL_COMPLEXITY_LABELS[breakfastComplexity as MealComplexity].title} (${MEAL_COMPLEXITY_LABELS[breakfastComplexity as MealComplexity].time})
  ${breakfastComplexity === 'quick_assembly' ? 'Simple ingredient lists, minimal to no cooking. Just combine pre-cooked or raw ingredients.' : ''}
  ${breakfastComplexity === 'minimal_prep' ? 'Brief cooking steps, single cooking method. Simple recipes.' : ''}
  ${breakfastComplexity === 'full_recipe' ? 'Multi-step recipes with detailed instructions are OK.' : ''}

- **Lunch**: ${MEAL_COMPLEXITY_LABELS[lunchComplexity as MealComplexity].title} (${MEAL_COMPLEXITY_LABELS[lunchComplexity as MealComplexity].time})
  ${lunchComplexity === 'quick_assembly' ? 'Simple ingredient lists, minimal to no cooking. Just combine pre-cooked or raw ingredients.' : ''}
  ${lunchComplexity === 'minimal_prep' ? 'Brief cooking steps, single cooking method. Simple recipes.' : ''}
  ${lunchComplexity === 'full_recipe' ? 'Multi-step recipes with detailed instructions are OK.' : ''}

- **Dinner**: ${MEAL_COMPLEXITY_LABELS[dinnerComplexity as MealComplexity].title} (${MEAL_COMPLEXITY_LABELS[dinnerComplexity as MealComplexity].time})
  ${dinnerComplexity === 'quick_assembly' ? 'Simple ingredient lists, minimal to no cooking. Just combine pre-cooked or raw ingredients.' : ''}
  ${dinnerComplexity === 'minimal_prep' ? 'Brief cooking steps, single cooking method. Simple recipes.' : ''}
  ${dinnerComplexity === 'full_recipe' ? 'Multi-step recipes with detailed instructions are OK.' : ''}

IMPORTANT: Match the prep_time_minutes to the complexity level. Quick assembly should be 2-10 min, minimal prep 10-20 min, full recipe 20-45 min.
`;

  let preferencesSection = '';
  if (mealPreferences) {
    const parts: string[] = [];
    if (mealPreferences.liked.length > 0) {
      parts.push(`**Meals the user LIKES** (create similar meals): ${mealPreferences.liked.join(', ')}`);
    }
    if (mealPreferences.disliked.length > 0) {
      parts.push(`**Meals the user DISLIKES** (avoid similar meals): ${mealPreferences.disliked.join(', ')}`);
    }
    if (parts.length > 0) {
      preferencesSection = `\n## User Preferences\n${parts.join('\n')}\n`;
    }
  }

  let validatedMealsSection = '';
  if (validatedMeals && validatedMeals.length > 0) {
    const mealsList = validatedMeals.map(m =>
      `- "${m.meal_name}": ${m.calories} kcal, ${m.protein}g protein, ${m.carbs}g carbs, ${m.fat}g fat`
    ).join('\n');
    validatedMealsSection = `
## User-Validated Meal Nutrition Data
When generating these meals or similar ones, use these macro values as reference:
${mealsList}
`;
  }

  // Fetch cached nutrition data for the core ingredients
  const allIngredientItems = [
    ...coreIngredients.proteins,
    ...coreIngredients.vegetables,
    ...coreIngredients.fruits,
    ...coreIngredients.grains,
    ...coreIngredients.fats,
    ...coreIngredients.dairy,
  ];
  // Extract names from CoreIngredientItem (can be string or { name, swapped })
  const allIngredientNames = allIngredientItems.map(item =>
    typeof item === 'string' ? item : item.name
  );
  const nutritionCache = await fetchCachedNutrition(allIngredientNames);
  const nutritionReference = buildNutritionReferenceSection(nutritionCache);

  // Calculate total meals needed
  const totalMealsPerDay = profile.meals_per_day;
  const totalMealsPerWeek = totalMealsPerDay * 7;

  // Build snack-specific instructions if multiple snacks per day
  let snackInstructions = '';
  if (snacksPerDay > 1) {
    snackInstructions = `
## IMPORTANT: MULTIPLE SNACKS PER DAY
The user has ${snacksPerDay} snack slots per day. You MUST generate ${snacksPerDay} snacks for each day.
- Label them with "snack_number": 1 or 2 (or 3 if applicable) to distinguish them
- Each day needs: breakfast, lunch, dinner, AND ${snacksPerDay} snacks
- Total snacks needed: ${snacksPerDay * 7} (${snacksPerDay} per day × 7 days)
`;
  }

  // Build household context if user has household members
  const householdServings = profile.household_servings ?? DEFAULT_HOUSEHOLD_SERVINGS_PREFS;
  const householdSection = buildHouseholdContextSection(householdServings);

  // Build theme styling section if a theme is provided
  let themeStyleSection = '';
  if (theme) {
    themeStyleSection = `
## 🎨 THEME STYLING: ${theme.display_name} ${theme.emoji || ''}

### Cooking Style
${theme.cooking_style_guidance}

${theme.meal_name_style ? `### Meal Naming
${theme.meal_name_style}` : ''}

### Requirements
- All meal names should clearly reflect the "${theme.display_name}" theme
- Cooking methods should align with the theme's style
- Flavor combinations should be cohesive with the theme
- The week should feel like a curated "${theme.display_name}" meal plan

`;
  }

  const prompt = `You are generating a 7-day meal plan for a CrossFit athlete.

**CRITICAL CONSTRAINT**: You MUST use ONLY the ingredients provided below. Do NOT add any new ingredients.
${themeStyleSection}${preferencesSection}${validatedMealsSection}${householdSection}
## CORE INGREDIENTS (USE ONLY THESE)
${ingredientsJSON}
${nutritionReference}
## USER MACROS (daily targets) - MUST BE MET
- **Daily Calories: ${profile.target_calories} kcal** (this is the PRIMARY goal)
- Daily Protein: ${profile.target_protein}g
- Daily Carbs: ${profile.target_carbs}g
- Daily Fat: ${profile.target_fat}g
- Dietary Preferences: ${dietaryPrefsText}
- Max Prep Time Per Meal: ${profile.prep_time} minutes
- Meals Per Day: ${profile.meals_per_day}

## TARGET MACROS PER MEAL (approximately)
- Calories: ~${targetCaloriesPerMeal} kcal per meal
- Protein: ~${targetProteinPerMeal}g per meal
- Carbs: ~${targetCarbsPerMeal}g per meal
- Fat: ~${targetFatPerMeal}g per meal

**CRITICAL**: Each day's meals MUST total approximately ${profile.target_calories} calories.
Do NOT generate meals that total significantly less than this target (within 5-10% is acceptable).

## MEAL CONSISTENCY SETTINGS
${consistencyInstructions}
${complexityInstructions}
${snackInstructions}
## INSTRUCTIONS
1. **PRIORITIZE HITTING CALORIE TARGETS** - use adequate portion sizes
2. Create variety through different:
   - Cooking methods (grilled, baked, stir-fried, steamed, raw)
   - Flavor profiles (Mediterranean, Asian, Mexican, Italian, American)
   - Meal structures (bowls, salads, plates, wraps using lettuce)
3. Design meals that work well for batch cooking
4. Use realistic portion sizes that add up to daily calorie targets
5. Consider meal prep efficiency
6. **INCLUDE 5-6 SERVINGS OF FRUITS & VEGETABLES DAILY** (~800g or 6 cups total per day for athlete health)
   - Aim for vegetables at lunch AND dinner (at least 1-2 cups each)
   - Include fruit at breakfast and/or snacks (1-2 cups total)
   - This is essential for athlete recovery and overall health - do not sacrifice produce for hitting macros

## CRITICAL RULES
- Use ONLY the provided ingredients (you may use basic seasonings like salt, pepper, garlic, onion, herbs, and spices)
- Do NOT introduce new proteins, vegetables, fruits, grains, fats, or dairy items beyond what's listed
- Create variety through preparation methods, not new ingredients
- Verify that calories approximately = (protein × 4) + (carbs × 4) + (fat × 9)
- **MUST generate exactly ${totalMealsPerDay} meals per day (${totalMealsPerWeek} total)**

## RESPONSE FORMAT
**CRITICAL NUTRITION REQUIREMENTS**:
1. **Each ingredient MUST include its individual nutrition values** (calories, protein, carbs, fat) for the specified amount
2. The meal's total macros MUST equal the SUM of all ingredient macros (verify this before outputting)
3. Use the nutrition reference data provided above when available
4. For ingredients not in the reference, estimate based on USDA standards

**TITLE**: Create a creative, descriptive title for this meal plan that captures its character${theme ? ` and reflects the "${theme.display_name}" theme` : ''}. Examples: "Mediterranean Power Week", "High-Protein Summer Eats", "Lean & Green Athlete Fuel".

Generate all ${totalMealsPerWeek} meals for all 7 days in a single "meals" array.
Order by day (monday first), then by meal type (breakfast, snack, lunch, snack, dinner for 5 meals/day).
${snacksPerDay > 1 ? `Include "snack_number" field for snacks to distinguish snack 1 from snack 2.` : ''}

Use the generate_meals tool to provide your meal plan with a title.`;

  // ===== TEST MODE: Single-day generation =====
  const testConfig = getTestConfig();
  let finalPrompt = prompt;
  if (!testConfig.generateFullWeek && process.env.MEAL_PLAN_TEST_MODE && testConfig.mode !== 'production') {
    // Modify prompt to only generate Monday's meals
    finalPrompt = prompt
      .replace(/all 7 days/gi, 'Monday only')
      .replace(/Generate all \d+ meals for all 7 days/gi, `Generate ${totalMealsPerDay} meals for Monday only`)
      .replace(/Order by day \(monday first\), then by meal type/gi, 'All meals should be for Monday')
      .replace(/\*\*MUST generate exactly \d+ meals per day \(\d+ total\)\*\*/gi, `**MUST generate exactly ${totalMealsPerDay} meals for Monday only**`);

    console.log('[TEST MODE] Generating Monday only (will be repeated for 7 days)');
  }
  // ===== END TEST MODE =====

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<{ title: string; meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }>({
    prompt: finalPrompt,
    tool: mealsSchema,
    maxTokens: 32000,
    userId,
    promptType: 'two_stage_meals_from_ingredients',
  });

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

  for (const meal of parsed.meals || []) {
    for (const ingredient of meal.ingredients || []) {
      // Create a unique key based on normalized name + serving size + unit
      const normalizedName = ingredient.name.toLowerCase().trim();
      const servingSize = parseFloat(ingredient.amount) || 1;
      const servingUnit = ingredient.unit || 'serving';
      const key = `${normalizedName}|${servingSize}|${servingUnit}`;

      // Only add if we haven't seen this exact ingredient+serving combo
      // and it has valid nutrition data
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
  }

  // Cache all unique ingredients (async, don't block return)
  if (ingredientMap.size > 0) {
    const ingredientsToCache = Array.from(ingredientMap.values());
    // Fire and forget - don't wait for caching to complete
    cacheIngredientNutrition(ingredientsToCache).catch(err => {
      console.error('Failed to cache ingredient nutrition:', err);
    });
  }

  return parsed;
}
