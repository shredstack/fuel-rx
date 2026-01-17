import type {
  UserProfile,
  CoreIngredients,
  MealPlanTheme,
  MealType,
  DayOfWeek,
  MealWithIngredientNutrition,
  MealComplexity,
  SelectableMealType,
  ProteinFocusConstraint,
} from '../types';
import { DEFAULT_MEAL_CONSISTENCY_PREFS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS, MEAL_COMPLEXITY_LABELS, getStandardMealTypes, DEFAULT_SELECTED_MEAL_TYPES } from '../types';
import { callLLMWithToolUse } from './client';
import { fetchCachedNutrition, buildNutritionReferenceSection, cacheIngredientNutrition } from './ingredient-cache';
import { DIETARY_LABELS, getMealTypesForPlan, buildHouseholdContextSection } from './helpers';
import { mealsSchema } from '../llm-schemas';
import { getTestConfig } from '../claude_test';
import { getWorkoutMealInstructions } from './workout-meals';

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
  theme?: MealPlanTheme,
  proteinFocus?: ProteinFocusConstraint | null
): Promise<{ title: string; meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }> {
  const dietaryPrefs = profile.dietary_prefs ?? ['no_restrictions'];
  const dietaryPrefsText = dietaryPrefs
    .map(pref => DIETARY_LABELS[pref] || pref)
    .join(', ') || 'No restrictions';

  const mealConsistencyPrefs = profile.meal_consistency_prefs ?? DEFAULT_MEAL_CONSISTENCY_PREFS;

  // Build the ingredients list as JSON
  const ingredientsJSON = JSON.stringify(coreIngredients, null, 2);

  // Determine meal types needed and count snacks
  // Use new selected_meal_types and snack_count if available, fallback to legacy
  const selectedMealTypes = (profile.selected_meal_types ?? DEFAULT_SELECTED_MEAL_TYPES) as SelectableMealType[];
  const snackCount = profile.snack_count ?? 0;
  const mealTypesNeeded = getMealTypesForPlan(selectedMealTypes, snackCount);
  const snacksPerDay = snackCount;
  const uniqueMealTypes = Array.from(new Set(mealTypesNeeded)) as MealType[];

  // Calculate total meals per day (selected meal types + snacks)
  const actualMealsPerDay = selectedMealTypes.length + snackCount;

  // Calculate per-meal targets based on actual meal count
  const targetCaloriesPerMeal = Math.round(profile.target_calories / actualMealsPerDay);
  const targetProteinPerMeal = Math.round(profile.target_protein / actualMealsPerDay);
  const targetCarbsPerMeal = Math.round(profile.target_carbs / actualMealsPerDay);
  const targetFatPerMeal = Math.round(profile.target_fat / actualMealsPerDay);

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

  // Calculate total meals needed (selected meal types + snacks)
  // Workout meals are now included in selectedMealTypes if the user selected them
  const hasPreWorkout = selectedMealTypes.includes('pre_workout');
  const hasPostWorkout = selectedMealTypes.includes('post_workout');
  const totalMealsPerDay = actualMealsPerDay;
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

  // Build protein focus section if provided
  let proteinFocusSection = '';
  if (proteinFocus) {
    const minCount =
      proteinFocus.count === 'all' ? 7 :
      proteinFocus.count === '5-7' ? 5 : 3;
    const maxCount =
      proteinFocus.count === 'all' ? 7 :
      proteinFocus.count === '5-7' ? 7 : 4;

    const cuisineExamples = [
      { style: 'Asian', examples: 'teriyaki, stir-fry, Thai curry, sesame ginger' },
      { style: 'Mexican/Latin', examples: 'tacos, fajitas, cilantro lime, chipotle' },
      { style: 'Mediterranean', examples: 'Greek-style, lemon herb, garlic butter' },
      { style: 'Cajun/Southern', examples: 'blackened, Cajun, low-country boil style' },
      { style: 'Italian', examples: 'scampi, fra diavolo, primavera' },
      { style: 'Peruvian', examples: 'ceviche-style, ají amarillo' },
    ];

    proteinFocusSection = `
## 🎯 PROTEIN FOCUS CONSTRAINT (MUST FOLLOW)

**Primary Protein for ${proteinFocus.mealType.charAt(0).toUpperCase() + proteinFocus.mealType.slice(1)}s:** ${proteinFocus.protein}

**Requirements:**
- Generate ${minCount}-${maxCount} ${proteinFocus.mealType} meals that feature ${proteinFocus.protein} as the PRIMARY protein
- The remaining ${7 - maxCount}-${7 - minCount} ${proteinFocus.mealType}(s) can use other available proteins for variety

${proteinFocus.varyCuisines ? `
**CRITICAL - Cuisine Variety:**
Each ${proteinFocus.protein} ${proteinFocus.mealType} MUST be prepared in a DIFFERENT cuisine style. Use at least ${Math.min(minCount, 4)} different styles from:

${cuisineExamples.map(c => `- **${c.style}**: ${c.examples}`).join('\n')}

Example for shrimp dinners:
- Monday: Garlic Butter Shrimp Scampi (Italian)
- Tuesday: Spicy Cajun Shrimp & Grits (Southern)
- Wednesday: Shrimp Pad Thai (Asian)
- Thursday: Shrimp Tacos with Cilantro Lime Slaw (Mexican)
- Friday: Greek Shrimp with Feta & Orzo (Mediterranean)

**Each meal should feel completely different despite using the same protein.**
` : `
**Preparation Variety:**
Even without strict cuisine variety, ensure each ${proteinFocus.protein} meal uses different cooking methods (grilled, sautéed, baked, etc.) and flavor profiles.
`}
`;
  }

  const prompt = `You are generating a 7-day meal plan for a CrossFit athlete.

## CRITICAL: ACCURACY HIERARCHY

You must follow this priority order — earlier priorities ALWAYS override later ones:

### Priority 1: INGREDIENT ACCURACY (NON-NEGOTIABLE)
- Every ingredient's nutrition values MUST match the reference data provided
- If an ingredient isn't in the reference data, use your knowledge of USDA standard values
- NEVER fabricate or adjust ingredient nutrition values to hit targets
- If you're uncertain about an ingredient's nutrition, use conservative estimates

### Priority 2: MATHEMATICAL INTEGRITY (NON-NEGOTIABLE)
- Each meal's total macros MUST equal the exact sum of its ingredients
- Show your work: if a meal has 3 ingredients, calories = ing1_cal + ing2_cal + ing3_cal
- Round to whole numbers only at the meal level, not ingredient level

### Priority 3: TARGET ALIGNMENT (BEST EFFORT)
- Daily totals should approach the user's targets
- To adjust totals, ONLY modify PORTION SIZES — never fabricate nutrition values
- If targets cannot be met with the available ingredients, that's acceptable
- Under-target is better than inaccurate

### What This Means In Practice
✅ CORRECT: "User needs more calories → increase chicken breast from 5oz to 7oz"
✅ CORRECT: "User needs more protein → add an extra egg to breakfast"
✅ CORRECT: "Cannot hit 2000 cal with these ingredients → generate 1850 cal (honest)"
❌ WRONG: "User needs 2000 cal → adjust salmon from 180 cal to 250 cal" (fabrication!)
❌ WRONG: "Meal needs to hit 500 cal → report 500 cal even though ingredients sum to 420"

**CRITICAL CONSTRAINT**: You MUST use ONLY the ingredients provided below. Do NOT add any new ingredients.
${themeStyleSection}${proteinFocusSection}${preferencesSection}${validatedMealsSection}${householdSection}
## CORE INGREDIENTS (USE ONLY THESE)
${ingredientsJSON}
${nutritionReference}

## DAILY NUTRITION CONTEXT

The user's daily targets are:
- **Daily Calories:** ${profile.target_calories} kcal
- **Daily Protein:** ${profile.target_protein}g
- **Daily Carbs:** ${profile.target_carbs}g
- **Daily Fat:** ${profile.target_fat}g
- Dietary Preferences: ${dietaryPrefsText}
- Max Prep Time Per Meal: ${profile.prep_time} minutes
- Meals Per Day: ${totalMealsPerDay} (${selectedMealTypes.join(', ')}${snackCount > 0 ? ` + ${snackCount} snack${snackCount > 1 ? 's' : ''}` : ''})

### Guidance (Not Hard Requirements)
- Aim for each day to total within ±150 calories of the daily target
- Protein is the most important macro for CrossFit athletes — prioritize hitting protein targets
- If you must fall short somewhere, prefer under on carbs/fat rather than protein

### Macro Balance for Regular Meals (Soft Guideline)
Each regular meal (breakfast, lunch, dinner, snacks) should approximately reflect the user's overall macro ratio:
- **Target Ratio**: ~${Math.round((profile.target_protein * 4 / profile.target_calories) * 100)}% protein, ~${Math.round((profile.target_carbs * 4 / profile.target_calories) * 100)}% carbs, ~${Math.round((profile.target_fat * 9 / profile.target_calories) * 100)}% fat
- This is a soft guideline — nutritional accuracy is more important than hitting exact ratios
- Meals should include a balance of protein, carbs, and fat (don't create carb-only or fat-only meals)
- Exception: Workout meals have specific macro ratios defined separately (pre-workout = carb-heavy, post-workout = protein-heavy)

### How to Approach This
1. Generate meals using accurate ingredient portions
2. After drafting all meals for a day, mentally sum the totals
3. If significantly under target (>200 cal short):
   - Look for opportunities to increase portion sizes
   - Consider adding more calorie-dense ingredients where appropriate (extra olive oil, larger protein portions, more rice/quinoa)
4. If still under target after reasonable adjustments, that's okay — accuracy matters more

### Realistic Expectations
A day with 5 meals (breakfast, snack, lunch, snack, dinner) eating whole foods typically ranges:
- Lower bound: ~1400-1600 cal (lighter portions, lean proteins, lots of vegetables)
- Mid range: ~1800-2200 cal (moderate portions, mixed protein sources)
- Upper bound: ~2400-3000 cal (larger portions, calorie-dense additions)

If the user's target is ${profile.target_calories} cal, your portions should reflect this range.

## TARGET RANGES PER MEAL TYPE

These are guidelines to help you plan, not hard requirements. Accuracy always wins.

### For a ${profile.target_calories} cal/day target:

**Breakfast** (${Math.round(profile.target_calories * 0.20)}-${Math.round(profile.target_calories * 0.25)} cal)
- Typically 20-25% of daily calories
- Should include protein source (eggs, Greek yogurt, protein in oats)

**Lunch** (${Math.round(profile.target_calories * 0.25)}-${Math.round(profile.target_calories * 0.30)} cal)
- Typically 25-30% of daily calories
- Substantial protein + complex carbs

**Dinner** (${Math.round(profile.target_calories * 0.30)}-${Math.round(profile.target_calories * 0.35)} cal)
- Typically 30-35% of daily calories
- Largest meal, most flexibility for hitting targets

**Snacks** (${Math.round(profile.target_calories * 0.08)}-${Math.round(profile.target_calories * 0.12)} cal each)
- Two snacks, each ~8-12% of daily calories
- Quick, simple, protein-inclusive

### Adjustment Guidance
- If running under target: Increase dinner portions first (most flexibility)
- If running over target: Reduce carb portions slightly
- Protein portions should rarely be reduced

## MEAL CONSISTENCY SETTINGS
${consistencyInstructions}
${complexityInstructions}
${snackInstructions}${getWorkoutMealInstructions(profile)}
## INSTRUCTIONS
1. **PRIORITIZE HITTING CALORIE TARGETS THROUGH PORTION SIZES** - use adequate, realistic portions
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

## PRE-OUTPUT VERIFICATION

Before outputting your JSON, verify these items mentally:

### Accuracy Check
□ Every ingredient's calories match the reference data (or USDA standards)
□ Every meal's total = exact sum of its ingredients
□ No ingredient has been assigned fabricated nutrition values

### Target Check
□ Each day's total is reasonable given the ingredients used
□ If any day is significantly under target (>200 cal), I've maximized portions appropriately
□ Protein totals are prioritized over carb/fat totals

### Honesty Check
□ If I couldn't hit the targets, I've reported accurate numbers anyway
□ I have not "rounded up" meal totals to look closer to targets
□ All nutrition values are defensible based on real food data

## RESPONSE FORMAT
**CRITICAL NUTRITION REQUIREMENTS**:
1. **Each ingredient MUST include its individual nutrition values** (calories, protein, carbs, fat) for the specified amount
2. The meal's total macros MUST equal the SUM of all ingredient macros (verify this before outputting)
3. Use the nutrition reference data provided above when available
4. For ingredients not in the reference, estimate based on USDA standards

**TITLE**: Create a creative, descriptive title for this meal plan that captures its character${theme ? ` and reflects the "${theme.display_name}" theme` : ''}. Examples: "Mediterranean Power Week", "High-Protein Summer Eats", "Lean & Green Athlete Fuel".

Generate all ${totalMealsPerWeek} meals for all 7 days in a single "meals" array.
Order by day (monday first), then by meal type (breakfast, ${hasPreWorkout ? 'pre_workout, ' : ''}lunch, ${hasPostWorkout ? 'post_workout, ' : ''}snack, dinner).
${snacksPerDay > 1 ? `Include "snack_number" field for snacks to distinguish snack 1 from snack 2.` : ''}
${hasPreWorkout || hasPostWorkout ? `Include ${hasPreWorkout ? '"pre_workout"' : ''}${hasPreWorkout && hasPostWorkout ? ' and ' : ''}${hasPostWorkout ? '"post_workout"' : ''} meals for each day.` : ''}

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
