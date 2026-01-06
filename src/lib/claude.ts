import Anthropic from '@anthropic-ai/sdk';
import type { Tool, ToolUseBlock } from '@anthropic-ai/sdk/resources/messages';
import type {
  UserProfile,
  DayPlan,
  Ingredient,
  IngredientWithNutrition,
  MealConsistencyPrefs,
  MealType,
  Meal,
  MealWithIngredientNutrition,
  Macros,
  CoreIngredients,
  IngredientVarietyPrefs,
  PrepItem,
  DailyAssembly,
  PrepModeResponse,
  DayOfWeek,
  IngredientNutritionWithDetails,
  PrepStyle,
  MealComplexity,
  PrepSessionType,
  HouseholdServingsPrefs,
  MealPlanTheme,
  ThemeIngredientGuidance,
} from './types';
import { DEFAULT_MEAL_CONSISTENCY_PREFS, DEFAULT_INGREDIENT_VARIETY_PREFS, MEAL_COMPLEXITY_LABELS, DEFAULT_HOUSEHOLD_SERVINGS_PREFS, DAYS_OF_WEEK, CHILD_PORTION_MULTIPLIER, DAY_OF_WEEK_LABELS, normalizeCoreIngredients } from './types';
import { createClient } from './supabase/server';
import { getTestConfig } from './claude_test';
import {
  coreIngredientsSchema,
  mealsSchema,
  prepSessionsSchema,
  groceryListSchema,
  simpleMealsSchema,
  consolidatedGrocerySchema,
} from './llm-schemas';

// ============================================
// Tool Use Helpers for Guaranteed JSON Output
// ============================================

/**
 * Extract the tool use result from an Anthropic message response.
 * When using tool_choice: { type: 'tool', name: '...' }, the response
 * is guaranteed to contain a tool_use block with valid JSON input.
 */
function extractToolUseResult<T>(message: Anthropic.Message, toolName: string): T {
  const toolUseBlock = message.content.find(
    (block): block is ToolUseBlock => block.type === 'tool_use' && block.name === toolName
  );

  if (!toolUseBlock) {
    throw new Error(`No tool use block found for tool: ${toolName}`);
  }

  // The input is already parsed JSON - guaranteed to match the schema
  return toolUseBlock.input as T;
}

/**
 * Call the LLM with tool use and automatic retry on transient failures.
 * This provides guaranteed valid JSON output matching the tool's schema.
 */
async function callLLMWithToolUse<T>(options: {
  prompt: string;
  tool: Tool;
  model?: string;
  maxTokens?: number;
  maxRetries?: number;
  userId: string;
  promptType: string;
}): Promise<{ result: T; usage: { outputTokens: number }; durationMs: number }> {
  const {
    prompt,
    tool,
    model: requestedModel,
    maxTokens: requestedMaxTokens,
    maxRetries = 2,
    userId,
    promptType,
  } = options;

  // ===== TEST MODE INTEGRATION =====
  const testConfig = getTestConfig();
  let model = requestedModel || 'claude-sonnet-4-5-20250929';
  let maxTokens = requestedMaxTokens || 16000;

  // Apply test mode configuration if enabled
  if (process.env.MEAL_PLAN_TEST_MODE && testConfig.mode !== 'production') {
    // Fixture mode should never reach here - all LLM calls should be bypassed
    if (testConfig.mode === 'fixture') {
      throw new Error(`[TEST MODE] Fixture mode should not make LLM calls. Called with promptType: ${promptType}`);
    }

    model = testConfig.model;

    // Map prompt type to appropriate token limit from test config
    switch (promptType) {
      case 'two_stage_core_ingredients':
        maxTokens = testConfig.maxTokensCore;
        break;
      case 'two_stage_meals_from_ingredients':
      case 'meal_type_batch_breakfast':
      case 'meal_type_batch_lunch':
      case 'meal_type_batch_dinner':
      case 'meal_type_batch_snack':
        maxTokens = testConfig.maxTokensMeals;
        break;
      case 'two_stage_grocery_list':
      case 'grocery_list_consolidation':
        maxTokens = testConfig.maxTokensGrocery;
        break;
      case 'prep_mode_analysis':
        maxTokens = testConfig.maxTokensPrep;
        break;
      default:
        // Use requested tokens for unknown prompt types
        maxTokens = requestedMaxTokens || 16000;
    }

    // Ensure we never send 0 tokens
    if (maxTokens === 0) {
      maxTokens = requestedMaxTokens || 16000;
    }

    // Log test mode info (only once per generation)
    if (promptType === 'two_stage_core_ingredients') {
      console.log(`[TEST MODE] ${testConfig.mode} | Model: ${model} | Tokens: ${maxTokens}`);
    }
  }
  // ===== END TEST MODE INTEGRATION =====

  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();

      const message = await anthropic.messages.create({
        model,
        max_tokens: maxTokens,
        tools: [tool],
        tool_choice: { type: 'tool', name: tool.name },
        messages: [{ role: 'user', content: prompt }],
      });

      const duration = Date.now() - startTime;

      // Log the LLM call
      await logLLMCall({
        user_id: userId,
        prompt,
        output: JSON.stringify(message.content),
        model,
        prompt_type: promptType,
        tokens_used: message.usage?.output_tokens,
        duration_ms: duration,
      });

      // Check for max_tokens stop reason (truncation)
      if (message.stop_reason === 'max_tokens') {
        throw new Error(`Response was truncated (used ${message.usage?.output_tokens} tokens). Consider increasing max_tokens.`);
      }

      // Debug: Log the raw message content for prep_sessions
      if (tool.name === 'generate_prep_sessions') {
        console.log('[DEBUG] Raw LLM response for generate_prep_sessions:');
        console.log('  stop_reason:', message.stop_reason);
        console.log('  content blocks:', message.content.length);
        message.content.forEach((block, i) => {
          console.log(`  block ${i}: type=${block.type}${block.type === 'tool_use' ? `, name=${block.name}` : ''}`);
          if (block.type === 'tool_use') {
            console.log(`    input keys:`, Object.keys(block.input as Record<string, unknown>));
          }
        });
      }

      const result = extractToolUseResult<T>(message, tool.name);

      return {
        result,
        usage: { outputTokens: message.usage?.output_tokens || 0 },
        durationMs: duration,
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry on truncation errors - that's a config issue
      if (lastError.message.includes('truncated')) {
        throw lastError;
      }

      // Log retry attempt
      if (attempt < maxRetries) {
        console.warn(`LLM call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying:`, lastError.message);
        // Exponential backoff: 1s, 2s, 4s
        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  throw lastError || new Error('LLM call failed after retries');
}

// ============================================
// Ingredient Nutrition Cache Functions
// ============================================

/**
 * Fetch cached nutrition data for ingredients
 * Returns a map of normalized ingredient names to nutrition data
 * Uses the ingredient_nutrition_with_details view for convenience
 */
async function fetchCachedNutrition(ingredientNames: string[]): Promise<Map<string, IngredientNutritionWithDetails>> {
  const supabase = await createClient();
  const normalizedNames = ingredientNames.map(name => name.toLowerCase().trim());

  const { data, error } = await supabase
    .from('ingredient_nutrition_with_details')
    .select('*')
    .in('name_normalized', normalizedNames);

  if (error) {
    console.error('Error fetching cached nutrition:', error);
    return new Map();
  }

  const nutritionMap = new Map<string, IngredientNutritionWithDetails>();
  for (const item of data || []) {
    nutritionMap.set(item.name_normalized, item as IngredientNutritionWithDetails);
  }

  return nutritionMap;
}

/**
 * Get or create an ingredient in the ingredients dimension table
 * Returns the ingredient ID
 */
async function getOrCreateIngredient(
  supabase: Awaited<ReturnType<typeof createClient>>,
  name: string,
  category: string = 'other'
): Promise<string | null> {
  const normalizedName = name.toLowerCase().trim();

  // Try to find existing ingredient
  const { data: existing } = await supabase
    .from('ingredients')
    .select('id')
    .eq('name_normalized', normalizedName)
    .single();

  if (existing) {
    return existing.id;
  }

  // Create new ingredient
  const { data: created, error } = await supabase
    .from('ingredients')
    .insert({
      name,
      name_normalized: normalizedName,
      category,
    })
    .select('id')
    .single();

  if (error) {
    // Handle race condition - another request might have created it
    if (error.code === '23505') { // unique_violation
      const { data: retry } = await supabase
        .from('ingredients')
        .select('id')
        .eq('name_normalized', normalizedName)
        .single();
      return retry?.id || null;
    }
    console.error('Error creating ingredient:', error);
    return null;
  }

  return created?.id || null;
}

/**
 * Cache new nutrition data for ingredients
 * First ensures the ingredient exists in the ingredients table,
 * then adds the nutrition data for the specific serving size
 */
async function cacheIngredientNutrition(
  ingredients: Array<{
    name: string;
    serving_size: number;
    serving_unit: string;
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
    category?: string;
  }>
): Promise<void> {
  const supabase = await createClient();

  for (const ing of ingredients) {
    // Get or create the ingredient
    const ingredientId = await getOrCreateIngredient(supabase, ing.name, ing.category || 'other');

    if (!ingredientId) {
      console.error(`Failed to get/create ingredient: ${ing.name}`);
      continue;
    }

    // Insert nutrition data for this serving size
    const { error } = await supabase
      .from('ingredient_nutrition')
      .upsert({
        ingredient_id: ingredientId,
        serving_size: Math.round(ing.serving_size),
        serving_unit: ing.serving_unit,
        calories: Math.round(ing.calories),
        protein: Math.round(ing.protein),
        carbs: Math.round(ing.carbs),
        fat: Math.round(ing.fat),
        source: 'llm_estimated' as const,
        confidence_score: 0.7,
      }, {
        onConflict: 'ingredient_id,serving_size,serving_unit',
        ignoreDuplicates: true,
      });

    if (error) {
      console.error(`Error caching nutrition for ${ing.name}:`, error);
    }
  }
}

/**
 * Build a nutrition reference string from cached data for LLM prompts
 */
function buildNutritionReferenceSection(nutritionCache: Map<string, IngredientNutritionWithDetails>): string {
  if (nutritionCache.size === 0) return '';

  const lines = Array.from(nutritionCache.values()).map(n =>
    `- ${n.ingredient_name}: ${n.calories} cal, ${n.protein}g protein, ${n.carbs}g carbs, ${n.fat}g fat per ${n.serving_size} ${n.serving_unit}`
  );

  return `
## NUTRITION REFERENCE (use these exact values)
The following ingredients have validated nutrition data. Use these exact values when calculating macros:
${lines.join('\n')}
`;
}

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// ============================================
// Household Servings Helper Functions
// ============================================

/**
 * Check if user has any household members configured
 */
function hasHouseholdMembers(servings: HouseholdServingsPrefs): boolean {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  return DAYS_OF_WEEK.some(day =>
    mealTypes.some(meal => servings[day]?.[meal]?.adults > 0 || servings[day]?.[meal]?.children > 0)
  );
}

/**
 * Calculate the serving multiplier for a specific day and meal
 * Returns the total multiplier (1 for the athlete + additional household members)
 */
function getServingMultiplier(
  servings: HouseholdServingsPrefs,
  day: DayOfWeek,
  mealType: 'breakfast' | 'lunch' | 'dinner' | 'snacks'
): number {
  const dayServings = servings[day]?.[mealType];
  if (!dayServings) return 1;

  // Athlete counts as 1, additional adults as 1 each, children as 0.6 each
  return 1 + dayServings.adults + (dayServings.children * CHILD_PORTION_MULTIPLIER);
}

/**
 * Build a summary of household servings for LLM prompts
 */
function buildHouseholdContextSection(servings: HouseholdServingsPrefs): string {
  if (!hasHouseholdMembers(servings)) {
    return '';
  }

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  const lines: string[] = [];

  // Build a day-by-day summary
  for (const day of DAYS_OF_WEEK) {
    const dayServings = servings[day];
    const mealSummaries: string[] = [];

    for (const meal of mealTypes) {
      const serving = dayServings?.[meal];
      if (serving && (serving.adults > 0 || serving.children > 0)) {
        const parts: string[] = [];
        if (serving.adults > 0) parts.push(`${serving.adults} additional adult${serving.adults > 1 ? 's' : ''}`);
        if (serving.children > 0) parts.push(`${serving.children} child${serving.children > 1 ? 'ren' : ''}`);
        const multiplier = getServingMultiplier(servings, day, meal);
        mealSummaries.push(`${meal}: ${parts.join(' + ')} (${multiplier.toFixed(1)}x portions)`);
      }
    }

    if (mealSummaries.length > 0) {
      lines.push(`- ${DAY_OF_WEEK_LABELS[day]}: ${mealSummaries.join(', ')}`);
    }
  }

  if (lines.length === 0) return '';

  return `
## HOUSEHOLD SERVINGS (IMPORTANT)
The athlete is also cooking for their household. Generate prep instructions and grocery quantities for the FULL household, not just the athlete.

**Household schedule:**
${lines.join('\n')}

**Key guidelines:**
- The athlete's personal macro targets are still the priority for meal COMPOSITION
- But prep instructions should be for the FULL batch size (all household members)
- Grocery quantities should be scaled to feed everyone
- Children count as approximately 0.6x an adult portion
- Choose meals that scale well and are broadly appealing when feeding children
`;
}

/**
 * Calculate the average serving multiplier across all meals for grocery scaling
 */
function getAverageServingMultiplier(servings: HouseholdServingsPrefs): number {
  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
  let totalMultiplier = 0;
  let count = 0;

  for (const day of DAYS_OF_WEEK) {
    for (const meal of mealTypes) {
      totalMultiplier += getServingMultiplier(servings, day, meal);
      count++;
    }
  }

  return count > 0 ? totalMultiplier / count : 1;
}

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

  // Build comprehensive variety section with recent meals from the last 3 weeks
  let varietySection = '';
  if (recentMealNames && recentMealNames.length > 0) {
    varietySection = `
## CRITICAL: Meal Variety Requirements (from user's last 3 meal plans)

### Meals to AVOID
The following meals have been used recently. You MUST NOT use these exact meal names OR meals with similar flavor profiles/ingredient combinations:
${recentMealNames.slice(0, 50).join(', ')}

### Variety Guidelines
To ensure fresh, exciting meals each week:
1. **Avoid similar flavor profiles** - If recent meals were teriyaki-based, don't use other Asian sweet-savory sauces. If they featured Italian herbs, explore different seasonings.
2. **Avoid similar ingredient combinations** - If recent meals paired chicken with broccoli, use different protein-vegetable pairings.
3. **Change up cooking methods** - If recent meals were mostly baked/roasted, incorporate more stovetop, one-pan, or bowl-style assembly meals.
4. **Explore cuisine diversity** - Rotate through different cuisines:
   - Mediterranean (olive oil, lemon, herbs, feta, olives)
   - Asian (soy, ginger, sesame, rice vinegar, miso)
   - Mexican/Latin (cumin, lime, cilantro, peppers, beans)
   - American/Classic (simple seasonings, familiar comfort foods)
   - Middle Eastern (tahini, za'atar, sumac, chickpeas)
   - Indian-inspired (turmeric, cumin, coriander, yogurt-based)
5. **Vary vegetable preparations** - Mix raw (salads, slaws), steamed, roasted, sautéed, and grilled preparations.
`;
  }

  // Build enhanced meal preferences section
  let mealPreferencesSection = '';
  if (mealPreferences) {
    const hasLikes = mealPreferences.liked.length > 0;
    const hasDislikes = mealPreferences.disliked.length > 0;

    if (hasLikes || hasDislikes) {
      mealPreferencesSection = `
## User Meal Preferences (IMPORTANT - Follow These Closely)
`;
      if (hasLikes) {
        mealPreferencesSection += `
### Meals the User LIKES
The user enjoys these meals. Use them as inspiration for flavor profiles, ingredient combinations, and meal styles they prefer:
${mealPreferences.liked.map(m => `- ${m}`).join('\n')}

**How to use this**: Create meals with SIMILAR flavor profiles, cuisines, or ingredient styles. You can include some of these exact meals if they haven't been used in the last 3 weeks.
`;
      }
      if (hasDislikes) {
        mealPreferencesSection += `
### Meals the User DISLIKES (MUST AVOID)
The user has explicitly disliked these meals. NEVER include them or meals with similar characteristics:
${mealPreferences.disliked.map(m => `- ${m}`).join('\n')}

**STRICT REQUIREMENT**: Do NOT generate these meals or meals with similar:
- Main ingredients or protein sources
- Flavor profiles or seasonings
- Cooking styles or preparations
- Cuisine types (if the pattern suggests they dislike a cuisine)
`;
      }
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
${varietySection}${mealPreferencesSection}${validatedMealsSection}
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
${isConsistent
  ? 'Generate exactly 1 meal in the "meals" array.'
  : 'Generate exactly 7 different meals in the "meals" array, in order for Monday through Sunday.'}

Use the generate_simple_meals tool to provide your meals.`;

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<MealTypeResult>({
    prompt,
    tool: simpleMealsSchema,
    maxTokens: 8000,
    userId,
    promptType: `meal_type_batch_${mealType}`,
  });

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
Sort the list by category (produce, protein, dairy, grains, pantry, frozen, other) then alphabetically by name within each category.

Use the consolidate_grocery_list tool to provide your consolidated list.`;

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<{ grocery_list: Ingredient[] }>({
    prompt,
    tool: consolidatedGrocerySchema,
    maxTokens: 8000,
    userId,
    promptType: 'grocery_list_consolidation',
  });

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

// ============================================
// Two-Stage Meal Generation
// ============================================

/**
 * Stage 1: Generate core ingredients for the week with quantity estimates
 * Selects a focused set of ingredients and estimates quantities to meet weekly calorie targets
 */
export async function generateCoreIngredients(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  theme?: MealPlanTheme
): Promise<CoreIngredients> {
  const dietaryPrefs = profile.dietary_prefs ?? ['no_restrictions'];
  const dietaryPrefsText = dietaryPrefs
    .map(pref => DIETARY_LABELS[pref] || pref)
    .join(', ') || 'No restrictions';

  const varietyPrefs = profile.ingredient_variety_prefs ?? DEFAULT_INGREDIENT_VARIETY_PREFS;

  // Calculate weekly macro targets
  const weeklyCalories = profile.target_calories * 7;
  const weeklyProtein = profile.target_protein * 7;
  const weeklyCarbs = profile.target_carbs * 7;
  const weeklyFat = profile.target_fat * 7;

  // Map prep_time to complexity level
  let prepComplexity = 'moderate';
  if (profile.prep_time <= 15) prepComplexity = 'minimal';
  else if (profile.prep_time >= 45) prepComplexity = 'extensive';

  // Build variety section for ingredient selection based on last 3 meal plans
  let exclusionsSection = '';
  if (recentMealNames && recentMealNames.length > 0) {
    exclusionsSection = `
## CRITICAL: Ingredient Variety for Fresh Meals (based on user's last 3 meal plans)

### Recent Meals to Avoid Recreating
${recentMealNames.slice(0, 30).join(', ')}

### Variety Strategy for Ingredient Selection
To create DIFFERENT meals from recent weeks, select ingredients that enable:

1. **Different cuisines** - If recent meals were mostly Mediterranean, choose ingredients for Asian, Mexican, or American-style dishes
2. **Different protein preparations** - If chicken was always baked, pick proteins that work well for stir-frying, grilling, or bowl assembly
3. **Different flavor bases** - Rotate between:
   - Citrus-forward (lemon, lime)
   - Asian aromatics (ginger, soy, sesame)
   - Mediterranean herbs (oregano, basil, garlic)
   - Latin spices (cumin, cilantro, chili)
4. **Different vegetable families** - Mix cruciferous (broccoli, cauliflower), leafy greens, nightshades (peppers, tomatoes), and root vegetables
`;
  }

  // Build enhanced preferences section for ingredient selection
  let preferencesSection = '';
  if (mealPreferences) {
    const hasLikes = mealPreferences.liked.length > 0;
    const hasDislikes = mealPreferences.disliked.length > 0;

    if (hasLikes || hasDislikes) {
      preferencesSection = '\n## User Meal Preferences (Use to Guide Ingredient Selection)\n';
      if (hasLikes) {
        preferencesSection += `
**Meals the user LIKES**: ${mealPreferences.liked.join(', ')}
- Choose ingredients that enable similar flavor profiles and meal styles
- These meals indicate the user's preferred cuisines and cooking methods
`;
      }
      if (hasDislikes) {
        preferencesSection += `
**Meals the user DISLIKES**: ${mealPreferences.disliked.join(', ')}
- AVOID ingredients strongly associated with these disliked meals
- Do NOT select proteins, seasonings, or combinations that would lead to similar meals
- If the user dislikes several meals from a cuisine, avoid ingredients specific to that cuisine
`;
      }
    }
  }

  // Build ingredient preferences section
  let ingredientPreferencesSection = '';
  if (ingredientPreferences) {
    const hasLikedIngredients = ingredientPreferences.liked.length > 0;
    const hasDislikedIngredients = ingredientPreferences.disliked.length > 0;

    if (hasLikedIngredients || hasDislikedIngredients) {
      ingredientPreferencesSection = '\n## User Ingredient Preferences (CRITICAL - MUST FOLLOW)\n';
      if (hasLikedIngredients) {
        ingredientPreferencesSection += `
**Ingredients the user LIKES** (prioritize including these):
${ingredientPreferences.liked.map(i => `- ${i}`).join('\n')}
`;
      }
      if (hasDislikedIngredients) {
        ingredientPreferencesSection += `
**Ingredients the user DISLIKES** (NEVER include these):
${ingredientPreferences.disliked.map(i => `- ${i}`).join('\n')}

⚠️ STRICT RULE: Do NOT include any disliked ingredients in your selection. The user has explicitly marked these as ingredients they do not want.
`;
      }
    }
  }

  // Build theme section if a theme is provided
  let themeSection = '';
  if (theme) {
    const guidance = theme.ingredient_guidance as ThemeIngredientGuidance;
    themeSection = `
## 🎨 THIS WEEK'S THEME: ${theme.display_name} ${theme.emoji || ''}

**CRITICAL: You MUST select ingredients that fit this theme.**

### Theme Description
${theme.description}

### Theme Flavor Profile
${guidance.flavor_profile}

### Suggested Ingredients by Category
Use these as your PRIMARY selection pool. You may add complementary ingredients, but the majority should come from this list:

**Proteins**: ${guidance.proteins.join(', ')}
**Vegetables**: ${guidance.vegetables.join(', ')}
**Fruits**: ${guidance.fruits.join(', ')}
**Grains**: ${guidance.grains.join(', ')}
**Healthy Fats**: ${guidance.fats.join(', ')}
**Key Seasonings**: ${guidance.seasonings.join(', ')}

### Selection Rules
1. At least 70% of proteins should come from the theme's suggested list
2. At least 60% of vegetables should come from the theme's suggested list
3. Seasonings should heavily favor the theme's flavor profile
4. The overall ingredient selection should unmistakably represent "${theme.display_name}"

`;
  }

  // Fetch cached nutrition data for common ingredients to provide as reference
  const commonIngredients = [
    'chicken breast', 'ground beef', 'salmon', 'eggs', 'greek yogurt',
    'broccoli', 'spinach', 'sweet potato', 'bell peppers', 'rice',
    'quinoa', 'oats', 'avocado', 'olive oil', 'almonds', 'banana'
  ];
  const nutritionCache = await fetchCachedNutrition(commonIngredients);
  const nutritionReference = buildNutritionReferenceSection(nutritionCache);

  const prompt = `You are a meal planning assistant for CrossFit athletes. Your job is to select a focused set of core ingredients for one week of meals that will MEET THE USER'S CALORIE AND MACRO TARGETS.
${themeSection}${exclusionsSection}${preferencesSection}${ingredientPreferencesSection}
## CRITICAL: WEEKLY CALORIE TARGET
The user needs approximately ${weeklyCalories} calories for the week (${profile.target_calories} per day).
- Weekly Protein Target: ${weeklyProtein}g (${profile.target_protein}g/day)
- Weekly Carbs Target: ${weeklyCarbs}g (${profile.target_carbs}g/day)
- Weekly Fat Target: ${weeklyFat}g (${profile.target_fat}g/day)

**Your ingredient selection with quantities MUST provide enough total calories and macros to meet these weekly targets.**

## USER CONTEXT
- Meal prep time available: ${prepComplexity} (${profile.prep_time} minutes per meal max)
- Dietary preferences: ${dietaryPrefsText}
- Meals per day: ${profile.meals_per_day}

## INGREDIENT COUNTS REQUESTED BY USER
The user wants their weekly grocery list to include:
- Proteins: ${varietyPrefs.proteins} different options (includes eggs, which are an excellent whole-food protein)
- Vegetables: ${varietyPrefs.vegetables} different options
- Fruits: ${varietyPrefs.fruits} different options
- Grains/Starches: ${varietyPrefs.grains} different options (includes legumes like beans, lentils)
- Healthy Fats: ${varietyPrefs.fats} different options
- Dairy: ${varietyPrefs.dairy} different options (Greek yogurt, cottage cheese, milk, cheese)
${nutritionReference}
## INSTRUCTIONS
Select ingredients AND estimate weekly quantities that:
1. TOTAL to approximately ${weeklyCalories} calories for the week
2. Provide approximately ${weeklyProtein}g protein for the week
3. Are versatile and can be prepared multiple ways
4. Are commonly available at grocery stores
5. Work well for batch cooking
6. Match the user's dietary preferences

## CALORIE DISTRIBUTION GUIDANCE
A typical distribution for ${weeklyCalories} weekly calories:
- Proteins should provide ~35-40% of calories (~${Math.round(weeklyCalories * 0.35)} cal)
- Grains/Starches should provide ~25-30% of calories (~${Math.round(weeklyCalories * 0.25)} cal)
- Fats should provide ~20-25% of calories (~${Math.round(weeklyCalories * 0.20)} cal)
- Fruits, vegetables, and dairy make up the rest

## INGREDIENT SELECTION GUIDELINES
- **Proteins**: Focus on lean, versatile options. Includes eggs (70 cal each, 6g protein). 4oz chicken breast = ~140 cal, 26g protein. 4oz salmon = ~180 cal, 25g protein.
- **Vegetables**: Mix of colors - broccoli, spinach, bell peppers, sweet potatoes. Low calorie but essential for nutrients.
- **Fruits**: Fresh fruits for energy - banana = ~105 cal, berries = ~70-85 cal/cup.
- **Grains/Starches**: Includes legumes. 1 cup cooked rice = ~215 cal, 1 cup quinoa = ~220 cal, black beans (110 cal/half cup, 7g protein).
- **Healthy Fats**: Calorie-dense - 1 tbsp olive oil = 120 cal, 1 oz almonds = 165 cal, 1/2 avocado = 160 cal.
- **Dairy**: Greek yogurt (130 cal/cup, 20g protein), cottage cheese (160 cal/cup, 28g protein), milk, cheese.

## CONSTRAINTS
- Select EXACTLY the number of items requested per category
- Prioritize ingredients that can be used in multiple meals
- ONLY recommend healthy, whole foods that are non-processed or minimally processed
- **Quantities must add up to approximately ${weeklyCalories} total weekly calories**

Use the select_core_ingredients tool to provide your selection.`;

  // Use tool use for guaranteed valid JSON output
  const { result } = await callLLMWithToolUse<CoreIngredients>({
    prompt,
    tool: coreIngredientsSchema,
    maxTokens: 8000,
    userId,
    promptType: 'two_stage_core_ingredients',
  });

  // Normalize to handle any legacy 'pantry' responses
  const normalized = normalizeCoreIngredients(result);
  if (!normalized) {
    throw new Error('Failed to parse core ingredients from LLM response');
  }
  return normalized;
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
): Promise<{ meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }> {
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

Generate all ${totalMealsPerWeek} meals for all 7 days in a single "meals" array.
Order by day (monday first), then by meal type (breakfast, snack, lunch, snack, dinner for 5 meals/day).
${snacksPerDay > 1 ? `Include "snack_number" field for snacks to distinguish snack 1 from snack 2.` : ''}

Use the generate_meals tool to provide your meal plan.`;

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
  const { result: parsed } = await callLLMWithToolUse<{ meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }>({
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

// New prep sessions response type for the collapsible prep view
// Extended prep task as returned by LLM (matches new PrepTask interface)
interface LLMPrepTask {
  id: string;
  description: string;
  detailed_steps: string[];
  cooking_temps?: {
    oven?: string;
    stovetop?: string;
    internal_temp?: string;
    grill?: string;
  };
  cooking_times?: {
    prep_time?: string;
    cook_time?: string;
    rest_time?: string;
    total_time?: string;
  };
  tips?: string[];
  storage?: string;
  estimated_minutes: number;
  meal_ids: string[];
  completed: boolean;
  equipment_needed?: string[];
  ingredients_to_prep?: string[];
}

interface NewPrepSessionsResponse {
  prep_sessions: Array<{
    session_name: string;
    session_type: PrepSessionType;
    session_day: DayOfWeek | null;
    session_time_of_day: 'morning' | 'afternoon' | 'night' | null;
    prep_for_date: string | null;
    estimated_minutes: number;
    prep_tasks: LLMPrepTask[];
    display_order: number;
  }>;
  daily_assembly?: DailyAssembly;
}

/**
 * Stage 3: Analyze meals and generate prep sessions
 * Creates prep sessions based on user's prep style preference
 * Supports: traditional_batch, night_before, day_of, mixed
 */
export async function generatePrepSessions(
  days: DayPlan[],
  coreIngredients: CoreIngredients,
  profile: UserProfile,
  userId: string,
  weekStartDate?: string
): Promise<PrepModeResponse> {
  const prepStyle = profile.prep_style || 'mixed';

  // Build meal IDs for reference
  const mealIds: Record<string, string> = {};
  days.forEach((day) => {
    day.meals.forEach((meal, mealIndex) => {
      const id = `meal_${day.day}_${meal.type}_${mealIndex}`;
      mealIds[`${day.day}_${meal.type}_${mealIndex}`] = id;
    });
  });

  // Build a detailed summary of the meal plan with IDs AND instructions
  // This gives the LLM the actual cooking steps to create accurate prep tasks
  const mealSummary = days.map(day => {
    const mealsList = day.meals.map((m, idx) => {
      const mealId = `meal_${day.day}_${m.type}_${idx}`;
      const ingredientsList = m.ingredients.map(ing => `${ing.amount} ${ing.unit} ${ing.name}`).join(', ');
      const instructionsList = m.instructions.length > 0
        ? `\n      Instructions: ${m.instructions.map((inst, i) => `${i + 1}. ${inst}`).join(' ')}`
        : '';
      return `  - ${m.type} (ID: ${mealId}): ${m.name}
      Prep time: ${m.prep_time_minutes}min | Protein: ${m.macros.protein}g
      Ingredients: ${ingredientsList}${instructionsList}`;
    }).join('\n');
    return `${day.day.charAt(0).toUpperCase() + day.day.slice(1)}:\n${mealsList}`;
  }).join('\n\n');

  // Get meal complexities
  const breakfastComplexity = profile.breakfast_complexity || 'minimal_prep';
  const lunchComplexity = profile.lunch_complexity || 'minimal_prep';
  const dinnerComplexity = profile.dinner_complexity || 'full_recipe';

  // Calculate week dates for prep_for_date
  const weekStart = weekStartDate ? new Date(weekStartDate) : new Date();
  const dayDates: Record<DayOfWeek, string> = {
    monday: new Date(weekStart).toISOString().split('T')[0],
    tuesday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 1)).toISOString().split('T')[0],
    wednesday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 2)).toISOString().split('T')[0],
    thursday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 3)).toISOString().split('T')[0],
    friday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 4)).toISOString().split('T')[0],
    saturday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 5)).toISOString().split('T')[0],
    sunday: new Date(new Date(weekStart).setDate(weekStart.getDate() + 6)).toISOString().split('T')[0],
  };

  const prepStyleInstructions = {
    traditional_batch: `
## PREP STYLE: Traditional Batch Prep
Create 1-2 prep sessions:
1. **Main Batch Prep** (Sunday or Saturday): 1.5-2.5 hours of major cooking
2. **Optional Mid-Week Refresh** (Wednesday): 30-45 min if needed

Group all batch cooking together. Only truly no-cook assembly meals (like grabbing a pre-made snack) should be excluded.
`,
    night_before: `
## PREP STYLE: Night Before
Create 6-7 prep sessions, one for each night (Sunday night through Saturday night).
Each session prepares the NEXT day's meals.

Example:
- "Sunday Night (for Monday)" - prep Monday's meals
- "Monday Night (for Tuesday)" - prep Tuesday's meals
- etc.

Session types should be "night_before".
Group tasks that can be done together (e.g., marinating protein while chopping veggies).
Include ALL meals that have any cooking or prep steps - even "simple" meals like overnight oats need prep instructions.
`,
    day_of: `
## PREP STYLE: Day-Of Fresh Cooking
The user wants to cook fresh for every meal. This means they need DETAILED prep instructions for EVERY meal that involves ANY cooking or preparation.

CRITICAL RULES FOR DAY-OF STYLE:
1. Create a prep session for EVERY meal that requires:
   - Any heat (stove, oven, microwave, grill)
   - Any mixing, chopping, or assembly that takes more than 2 minutes
   - Any advance prep (like soaking oats overnight)

2. ONLY skip meals that are truly grab-and-go (like eating a banana or pre-made protein bar)

3. Session types:
   - "day_of_morning" for breakfast prep
   - "day_of_morning" for lunch prep (done in the morning or at lunchtime)
   - "day_of_dinner" for dinner prep

4. Include ALL meals with cooking verbs in their instructions (bake, sear, roast, grill, sauté, simmer, boil, fry, toast, heat, cook, etc.)

5. Even "simple" meals like eggs, oatmeal, or salads with cooked protein NEED prep sessions with proper instructions.

User's complexity preferences:
- Breakfast: ${breakfastComplexity}
- Lunch: ${lunchComplexity}
- Dinner: ${dinnerComplexity}

NOTE: Complexity preference does NOT mean skip the prep session. It just indicates how complex the user expects meals to be. ALL cooked meals need prep instructions regardless of complexity level.
`,
    mixed: `
## PREP STYLE: Mixed/Flexible
This is the most common choice. Create a balanced prep schedule:

1. **Weekly Batch Prep** (optional, if helpful): Batch cook proteins that appear in multiple meals
2. **Night Before** sessions for meals that benefit from advance prep
3. **Day-Of** sessions for full_recipe dinners that users want fresh

COMPLEXITY-BASED LOGIC:
- quick_assembly meals: Only skip if truly no cooking involved
- minimal_prep meals: Can be prepped night before OR batched if similar across days
- full_recipe meals: Prep night before for components, or cook day-of for freshness

For this user:
- Breakfast: ${breakfastComplexity} → ${breakfastComplexity === 'quick_assembly' ? 'Minimal prep, but include if any cooking' : breakfastComplexity === 'minimal_prep' ? 'Quick night-before prep or batch' : 'May need dedicated prep'}
- Lunch: ${lunchComplexity} → ${lunchComplexity === 'quick_assembly' ? 'Minimal prep, but include if any cooking' : lunchComplexity === 'minimal_prep' ? 'Quick night-before prep or batch' : 'May need dedicated prep'}
- Dinner: ${dinnerComplexity} → ${dinnerComplexity === 'quick_assembly' ? 'Minimal prep' : dinnerComplexity === 'minimal_prep' ? 'Quick night-before prep' : 'Night-before prep or day-of cooking'}
`,
  };

  // Build household context for prep instructions
  const householdServings = profile.household_servings ?? DEFAULT_HOUSEHOLD_SERVINGS_PREFS;
  const householdHasMembers = hasHouseholdMembers(householdServings);

  // Build a day/meal specific household servings summary for prep
  let householdPrepSection = '';
  if (householdHasMembers) {
    const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;
    const servingLines: string[] = [];

    for (const day of DAYS_OF_WEEK) {
      const dayParts: string[] = [];
      for (const meal of mealTypes) {
        const multiplier = getServingMultiplier(householdServings, day, meal);
        if (multiplier > 1) {
          dayParts.push(`${meal}: ${multiplier.toFixed(1)}x`);
        }
      }
      if (dayParts.length > 0) {
        servingLines.push(`- ${DAY_OF_WEEK_LABELS[day]}: ${dayParts.join(', ')}`);
      }
    }

    householdPrepSection = `
## HOUSEHOLD SERVINGS - CRITICAL FOR PREP INSTRUCTIONS
The athlete is cooking for their household. Your prep instructions MUST include quantities for the FULL batch, not just the athlete.

**Serving multipliers by day/meal:**
${servingLines.join('\n')}

**IMPORTANT for prep instructions:**
- Scale ALL ingredient quantities in detailed_steps for the full household
- Example: If Monday dinner is 2.2x servings, and the base recipe calls for "4 oz salmon", write "9 oz salmon (2.2 servings)"
- Include the multiplier or total servings in your instructions so the user knows the batch size
- Meals with 1.0x multiplier are just for the athlete (no scaling needed)
`;
  }

  const prompt = `You are creating a DETAILED prep schedule for a CrossFit athlete's weekly meal plan. The user needs ACTIONABLE cooking instructions, not just meal descriptions.

## MEAL PLAN WITH FULL DETAILS
${mealSummary}

## CORE INGREDIENTS
${JSON.stringify(coreIngredients, null, 2)}

## WEEK DATES
${JSON.stringify(dayDates, null, 2)}
${householdPrepSection}
${prepStyleInstructions[prepStyle as PrepStyle]}

## CRITICAL RULES

### RULE 1: ONE TASK PER MEAL (NOT PER INGREDIENT)
Each prep_task should represent ONE COMPLETE MEAL, not individual ingredients.
- WRONG: Separate tasks for "Roast sweet potato" and "Roast asparagus" for the same dinner
- RIGHT: One task "Monday Dinner: Salmon with Roasted Vegetables" that includes ALL steps for that meal

### RULE 2: INCLUDE EVERY SINGLE MEAL
Create a prep task for EVERY meal in the meal plan, even simple ones:
- Even "Greek yogurt with berries" needs a task: "Scoop yogurt into bowl, top with berries"
- Even "Avocado toast" needs a task: "Toast bread, mash avocado, spread on toast, season with salt"
- NO MEAL should be skipped. If someone asks "what do I do for Tuesday lunch?" there must be a task for it.

### RULE 3: ACTIONABLE STEP-BY-STEP INSTRUCTIONS
Your detailed_steps must be ACTUALLY HELPFUL with real cooking guidance.

BAD (useless - just restates the meal):
- "Prepare overnight oats with Greek yogurt and berries"

GOOD (actionable with real details):
- detailed_steps: [
    "Combine 1/2 cup rolled oats, 1/2 cup Greek yogurt, and 1/2 cup milk in a jar",
    "Stir in 1 tbsp chia seeds and 1 tsp honey",
    "Refrigerate overnight (at least 6 hours)",
    "Top with fresh berries before serving"
  ]

## PREP TASK STRUCTURE

Each prep_task represents ONE MEAL and MUST include:
1. "id": Unique identifier (e.g., "meal_monday_breakfast")
2. "description": The meal name (e.g., "Monday Breakfast: Overnight Oats with Berries")
3. "equipment_needed": Array of ALL cookware and tools needed (THIS IS REQUIRED - see examples below)
4. "ingredients_to_prep": Array of ingredients to gather/prep before starting (THIS IS REQUIRED)
5. "detailed_steps": Array of ALL steps to prepare this meal (THIS IS REQUIRED - never leave empty)
6. "cooking_temps": Object with temperature info (if applicable):
   - "oven": e.g., "400°F" or "200°C"
   - "stovetop": e.g., "medium-high heat"
   - "internal_temp": e.g., "145°F for salmon", "165°F for chicken"
   - "grill": e.g., "medium-high, 400-450°F"
7. "cooking_times": Object with timing info:
   - "prep_time": e.g., "5 min"
   - "cook_time": e.g., "15-20 min"
   - "rest_time": e.g., "5 min" (if applicable)
   - "total_time": e.g., "25 min"
8. "tips": Array of helpful pro tips (optional but encouraged)
9. "storage": Storage instructions (REQUIRED for batch prep and night-before styles, optional for day-of)
   - e.g., "Refrigerate in airtight container for up to 5 days"
   - e.g., "Store in glass meal prep containers, keeps 4-5 days refrigerated"
   - e.g., "Portion into individual containers for grab-and-go"
10. "estimated_minutes": Total time in minutes
11. "meal_ids": Array with the single meal_id this task is for
12. "completed": false

## CRITICAL: EQUIPMENT_NEEDED EXAMPLES

**For "Asian-Style Ground Turkey with Jasmine Rice and Vegetables":**
equipment_needed: ["Large skillet or wok (for turkey and vegetables)", "Medium pot with lid (for rice)", "Cutting board", "Chef's knife", "Wooden spoon or spatula", "Measuring spoons"]

**For "Baked Salmon with Roasted Vegetables":**
equipment_needed: ["Large baking sheet (for salmon)", "Separate baking sheet (for vegetables)", "Parchment paper or foil", "Tongs or spatula", "Small bowl (for seasoning mix)"]

**For "Overnight Oats":**
equipment_needed: ["Mason jar or airtight container", "Spoon for mixing"]

## CRITICAL: INGREDIENTS_TO_PREP EXAMPLES

**For "Asian-Style Ground Turkey with Jasmine Rice and Vegetables":**
ingredients_to_prep: ["1.5 lbs ground turkey", "2 cups jasmine rice", "1 onion, diced", "8 oz mushrooms, sliced", "2 cups red cabbage, shredded", "1.5 tbsp coconut oil", "Garlic powder, salt, pepper, ginger"]

This helps users gather everything BEFORE they start cooking.

## CRITICAL: DETAILED_STEPS WITH VESSEL CLARITY

Your detailed_steps MUST specify which cookware is being used at each step:

**BAD (unclear which vessel):**
- "Add ground turkey, cook 5-6 minutes until browned"
- "Add mushrooms and cook 3-4 minutes"

**GOOD (clear vessel instructions):**
- "In the large skillet, add 1.5 lbs ground turkey, breaking apart with spoon. Cook 5-6 minutes until browned and no pink remains."
- "To the same skillet with the turkey, add 8 oz sliced mushrooms. Cook 3-4 minutes until tender."
- "Meanwhile, in the medium pot, bring 2 cups water to a boil. Add rice, reduce to low, cover and simmer 15 minutes."

**GOOD (using multiple vessels simultaneously):**
- "While the chicken is baking (check step 2), heat 1 tbsp olive oil in a large skillet over medium heat."
- "In a separate small pot, bring 4 cups water to a boil for the quinoa."

**Key patterns to use:**
- "In the [specific cookware]..."
- "To the same [cookware]..." (when adding to existing pan)
- "In a separate [cookware]..." (when using different vessel)
- "While X is cooking in [cookware A], prepare Y in [cookware B]..."
- "Meanwhile, in [cookware]..." (for parallel tasks)

## RESPONSE FORMAT
Return ONLY valid JSON:
{
  "prep_sessions": [
    {
      "session_name": "Monday Morning Prep",
      "session_type": "day_of_morning",
      "session_day": "monday",
      "session_time_of_day": "morning",
      "prep_for_date": "${dayDates.monday}",
      "estimated_minutes": 20,
      "prep_tasks": [
        {
          "id": "meal_monday_breakfast",
          "description": "Monday Breakfast: Overnight Oats with Berries",
          "equipment_needed": [
            "Mason jar or airtight container",
            "Spoon for mixing"
          ],
          "ingredients_to_prep": [
            "1/2 cup rolled oats",
            "1/2 cup Greek yogurt",
            "1/2 cup milk",
            "1 tbsp chia seeds",
            "1 tsp honey",
            "1/4 cup fresh mixed berries"
          ],
          "detailed_steps": [
            "In the mason jar, combine 1/2 cup rolled oats, 1/2 cup Greek yogurt, and 1/2 cup milk",
            "Add 1 tbsp chia seeds and 1 tsp honey, stir well to combine",
            "Cover and refrigerate overnight (minimum 6 hours)",
            "Before serving, top with 1/4 cup fresh mixed berries"
          ],
          "cooking_times": {
            "prep_time": "5 min",
            "rest_time": "6+ hours (overnight)",
            "total_time": "5 min active"
          },
          "tips": [
            "Prep multiple jars at once for the week",
            "Add berries just before eating to keep them fresh"
          ],
          "storage": "Refrigerate in mason jars for up to 5 days",
          "estimated_minutes": 5,
          "meal_ids": ["meal_monday_breakfast_0"],
          "completed": false
        },
        {
          "id": "meal_monday_lunch",
          "description": "Monday Lunch: Greek Salad with Grilled Chicken",
          "equipment_needed": [
            "Large salad bowl",
            "Cutting board",
            "Chef's knife"
          ],
          "ingredients_to_prep": [
            "1 grilled chicken breast, sliced",
            "1 cucumber, diced",
            "2 tomatoes, chopped",
            "1/4 red onion, sliced",
            "1/4 cup Kalamata olives",
            "2 oz feta cheese, crumbled",
            "2 tbsp olive oil",
            "1 tbsp red wine vinegar",
            "Dried oregano, salt, pepper"
          ],
          "detailed_steps": [
            "On the cutting board, slice chicken breast into strips",
            "Chop cucumber, tomatoes, and red onion into bite-sized pieces",
            "In the large salad bowl, combine all chopped vegetables",
            "Add olives and crumbled feta cheese to the bowl",
            "Top with sliced chicken",
            "Drizzle with olive oil and red wine vinegar, season with oregano"
          ],
          "cooking_times": {
            "prep_time": "10 min",
            "total_time": "10 min"
          },
          "storage": "Keep components separate until serving. Dressing on the side, refrigerate up to 3 days",
          "estimated_minutes": 10,
          "meal_ids": ["meal_monday_lunch_0"],
          "completed": false
        }
      ],
      "display_order": 1
    },
    {
      "session_name": "Monday Dinner Prep",
      "session_type": "day_of_dinner",
      "session_day": "monday",
      "session_time_of_day": "night",
      "prep_for_date": "${dayDates.monday}",
      "estimated_minutes": 45,
      "prep_tasks": [
        {
          "id": "meal_monday_dinner",
          "description": "Monday Dinner: Herb-Crusted Salmon with Roasted Vegetables",
          "equipment_needed": [
            "Large baking sheet (for vegetables)",
            "Large skillet (for salmon)",
            "Cutting board",
            "Chef's knife",
            "Tongs or spatula",
            "Meat thermometer"
          ],
          "ingredients_to_prep": [
            "6 oz salmon fillet",
            "1 medium sweet potato, cubed",
            "1 bunch asparagus, trimmed",
            "2 tbsp olive oil",
            "Salt, pepper, garlic powder, dried dill"
          ],
          "detailed_steps": [
            "Preheat oven to 425°F",
            "On the cutting board, cut sweet potato into 1-inch cubes",
            "On the large baking sheet, toss sweet potato cubes with 1 tbsp olive oil, salt and pepper",
            "Place the baking sheet in the oven and roast for 15 minutes",
            "Meanwhile, on the cutting board, trim woody ends from asparagus",
            "Remove salmon from refrigerator and pat completely dry with paper towels",
            "Season salmon with salt, pepper, garlic powder, and dried dill",
            "Add asparagus to the same baking sheet with sweet potato, drizzle with oil and season",
            "Continue roasting vegetables for 12-15 more minutes",
            "In the large skillet, heat 1 tbsp olive oil over medium-high heat until shimmering",
            "Place salmon in the skillet skin-side up and sear undisturbed for 4 minutes until golden",
            "Using tongs, flip salmon and cook 3-4 minutes more until internal temp reaches 145°F",
            "Let salmon rest 2 minutes, then serve with roasted vegetables from the baking sheet"
          ],
          "cooking_temps": {
            "oven": "425°F",
            "stovetop": "medium-high heat",
            "internal_temp": "145°F (salmon is done)"
          },
          "cooking_times": {
            "prep_time": "15 min",
            "cook_time": "30 min",
            "total_time": "45 min"
          },
          "tips": [
            "Start the vegetables first since they take longer",
            "Don't move the salmon while searing - let the crust form",
            "Cut sweet potato uniformly for even cooking"
          ],
          "storage": "Best served fresh. Leftovers keep 2 days refrigerated, reheat veggies in oven",
          "estimated_minutes": 45,
          "meal_ids": ["meal_monday_dinner_0"],
          "completed": false
        }
      ],
      "display_order": 2
    }
  ],
  "daily_assembly": {
    "monday": {
      "breakfast": { "time": "5 min", "instructions": "Remove overnight oats from fridge, top with fresh berries and enjoy cold" },
      "lunch": { "time": "5 min", "instructions": "Combine prepped salad components, add dressing, toss and serve" },
      "dinner": { "time": "0 min", "instructions": "Serve fresh from cooking" }
    },
    "tuesday": {
      "breakfast": { "time": "5 min", "instructions": "Remove overnight oats from fridge, top with fresh berries and enjoy cold" },
      "lunch": { "time": "5 min", "instructions": "Portion prepped chicken and veggies, microwave 2 min if desired warm" }
    }
  }
}

## MEAL CONSOLIDATION RULES
When the SAME EXACT meal appears on multiple days, consolidate into a SINGLE prep task:

**Example - Identical Breakfast across days:**
If "Overnight Oats with Berries" appears on Monday, Tuesday, AND Wednesday breakfast:

Instead of 3 separate tasks, create ONE consolidated task:
{
  "id": "meal_breakfast_overnight_oats_mon_wed",
  "description": "Overnight Oats with Berries (Mon-Wed, 3 servings)",
  "detailed_steps": [
    "In a large bowl, combine 1.5 cups rolled oats, 1.5 cups Greek yogurt, and 1.5 cups milk (3x recipe)",
    "Stir in 3 tbsp chia seeds and 3 tsp honey",
    "Divide evenly into 3 mason jars or containers",
    "Refrigerate overnight (minimum 6 hours)",
    "Each morning, top one serving with 1/4 cup fresh berries before eating"
  ],
  "estimated_minutes": 10,
  "meal_ids": ["meal_monday_breakfast_0", "meal_tuesday_breakfast_0", "meal_wednesday_breakfast_0"],
  "storage": "Refrigerate in individual jars for up to 5 days. Add fresh toppings just before serving.",
  "tips": ["Batch prep all 3 at once to save time", "Keep berries separate until serving for best texture"],
  "completed": false
}

**Consolidation rules:**
- ALWAYS consolidate when the same meal name appears across 2+ days for the same meal type
- Multiply ingredient quantities by the number of servings
- Include ALL meal_ids that this task covers in the meal_ids array
- Update description to show day range and total servings: "Meal Name (Mon-Wed, 3 servings)"
- Adjust detailed_steps to describe making the full batch quantity
- This creates shorter, cleaner prep instructions and better batch prep UX

**When NOT to consolidate:**
- Different meals even if similar (e.g., "Grilled Chicken Salad" vs "Greek Chicken Salad")
- Same meal but different meal types (breakfast vs snack)

**Multiple snacks per day:**
Users may have multiple snacks per day. Use meal_ids with indices:
- "meal_monday_snack_0" for first snack
- "meal_monday_snack_1" for second snack
Consolidate Snack 1 across days separately from Snack 2.

## IMPORTANT RULES
1. Every meal_id in prep_tasks MUST match the format "meal_[day]_[type]_[index]" from the meal plan above
2. Order sessions by display_order chronologically through the week
3. ONE TASK PER MEAL - combine all components of a meal into a single task (or ONE TASK PER CONSOLIDATED MEAL GROUP)
4. EVERY MEAL must have a prep task - even simple assembly meals like "yogurt with fruit"
5. detailed_steps is REQUIRED for every task - never leave it empty or with generic descriptions
6. Include cooking_temps and cooking_times whenever heat/cooking is involved
7. Base your detailed_steps on the actual meal instructions provided above
8. STORAGE: Include storage instructions for any meal that is prepped in advance (required for traditional_batch and night_before styles)
9. DAILY ASSEMBLY (REQUIRED for traditional_batch and night_before styles):
   - For batch prep and night-before styles, include a "daily_assembly" object in your response
   - This tells the user how to assemble/reheat prepped food each day
   - Include instructions for each meal of each day (breakfast, lunch, dinner, snack if applicable)
   - Each entry should have "time" (quick estimate like "5 min") and "instructions" (what to do at meal time)
   - For day_of style, daily_assembly can be empty since food is cooked fresh
10. CONSOLIDATE identical meals - if the same meal appears multiple days, create ONE consolidated task (see MEAL CONSOLIDATION RULES above)

Use the generate_prep_sessions tool to provide your prep schedule.`;

  // Use tool use for guaranteed valid JSON output
  const { result: rawParsed } = await callLLMWithToolUse<NewPrepSessionsResponse>({
    prompt,
    tool: prepSessionsSchema,
    maxTokens: 64000,
    userId,
    promptType: 'prep_mode_analysis',
  });

  // Handle case where LLM returns prep_sessions as a JSON string instead of array
  // This can happen due to LLM quirks with tool use schemas
  // We need to cast to unknown first to check the actual runtime type
  const rawResult = rawParsed as unknown as { prep_sessions: unknown; daily_assembly?: unknown };

  let prepSessionsArray: NewPrepSessionsResponse['prep_sessions'] = [];
  let dailyAssemblyObj: NewPrepSessionsResponse['daily_assembly'] = {};

  if (typeof rawResult?.prep_sessions === 'string') {
    let prepSessionsStr = rawResult.prep_sessions as string;
    console.warn('LLM returned prep_sessions as string, parsing...');
    console.warn(`  String length: ${prepSessionsStr.length} chars`);
    console.warn(`  Last 200 chars: ${prepSessionsStr.slice(-200)}`);

    // First attempt: try parsing as-is
    try {
      prepSessionsArray = JSON.parse(prepSessionsStr);
    } catch (parseError) {
      const parseErr = parseError as SyntaxError;
      console.warn('Initial parse failed:', parseErr.message);

      // Extract position from error message like "at position 2721"
      const posMatch = parseErr.message.match(/at position (\d+)/);
      const errorPosition = posMatch ? parseInt(posMatch[1], 10) : null;

      if (errorPosition) {
        console.warn(`  Error at position ${errorPosition}, attempting targeted repair...`);
        console.warn(`  Context around error: ...${prepSessionsStr.slice(Math.max(0, errorPosition - 50), errorPosition + 50)}...`);
      }

      // Strategy 0: Fix common LLM bracket mismatch errors
      // The LLM sometimes writes ] instead of } to close objects (especially cooking_times)
      // Pattern: "key": "value"\n        ], should be "key": "value"\n        },
      console.warn('Attempting bracket mismatch repair...');
      let repairedStr = prepSessionsStr;

      // Fix pattern: closing an object with ] instead of }
      // Look for patterns like: "string_value"\n        ], (which should be })
      // This commonly happens after cooking_times objects
      repairedStr = repairedStr.replace(
        /("(?:prep_time|cook_time|total_time|stovetop|oven|internal_temp)":\s*"[^"]*")\s*\n(\s*)\]/g,
        '$1\n$2}'
      );

      let repaired = false;

      if (repairedStr !== prepSessionsStr) {
        console.warn('  Applied bracket mismatch fixes, attempting parse...');
        try {
          prepSessionsArray = JSON.parse(repairedStr);
          console.warn(`  Bracket repair successful! Parsed ${prepSessionsArray.length} sessions.`);
          repaired = true;
        } catch (bracketRepairError) {
          console.warn('  Bracket repair parse still failed:', (bracketRepairError as Error).message);
          // Continue to other strategies with the partially repaired string
          prepSessionsStr = repairedStr;
        }
      }

      // Strategy 1: Find session boundaries and extract valid sessions
      // Sessions end with "display_order": N } - find all such boundaries
      const sessions: unknown[] = [];
      if (!repaired) {
        console.warn('Attempting to extract complete sessions by finding boundaries...');

        // Find all potential session end positions (where "display_order": N } appears)
        const sessionEndRegex = /"display_order"\s*:\s*\d+\s*\}/g;
        const sessionEnds: number[] = [];
        let endMatch;
        while ((endMatch = sessionEndRegex.exec(prepSessionsStr)) !== null) {
          sessionEnds.push(endMatch.index + endMatch[0].length);
        }

        console.warn(`  Found ${sessionEnds.length} potential session end positions`);

        // Try parsing from start to each session end to find valid subsets
        for (const endPos of sessionEnds) {
          const candidate = prepSessionsStr.substring(0, endPos) + '\n]';
          try {
            const parsed = JSON.parse(candidate);
            if (Array.isArray(parsed) && parsed.length > 0) {
              sessions.length = 0; // Clear previous
              sessions.push(...parsed);
            }
          } catch {
            // This endpoint doesn't produce valid JSON, continue
          }
        }

        if (sessions.length > 0) {
          console.warn(`  Extracted ${sessions.length} complete sessions by boundary search`);
          prepSessionsArray = sessions as NewPrepSessionsResponse['prep_sessions'];
          repaired = true;
        }
      }

      // Strategy 2: If error position is known, try truncating just before the error
      if (!repaired && errorPosition && errorPosition > 100) {
        console.warn('Boundary search failed, trying truncation before error position...');

        // Search backwards from error position for a complete session boundary
        const beforeError = prepSessionsStr.substring(0, errorPosition);
        const lastSessionEnd = beforeError.lastIndexOf('},');

        if (lastSessionEnd > 0) {
          const truncated = prepSessionsStr.substring(0, lastSessionEnd + 1) + '\n]';
          try {
            prepSessionsArray = JSON.parse(truncated);
            console.warn(`  Repair successful via truncation at position ${lastSessionEnd}! Recovered ${prepSessionsArray.length} sessions.`);
            repaired = true;
          } catch {
            // Continue to next strategy
          }
        }
      }

      // Strategy 3: Look for the last complete "display_order" ending
      if (!repaired) {
        const lastCompleteSessionMatch = prepSessionsStr.match(/[\s\S]*"display_order":\s*\d+\s*\}/g);

        if (lastCompleteSessionMatch) {
          const lastMatch = lastCompleteSessionMatch[lastCompleteSessionMatch.length - 1];
          const lastCompleteIndex = prepSessionsStr.lastIndexOf(lastMatch) + lastMatch.length;

          // Truncate to last complete session and close the array
          const truncatedStr = prepSessionsStr.substring(0, lastCompleteIndex) + '\n]';
          console.warn(`  Attempting repair via display_order match: truncated to ${truncatedStr.length} chars`);

          try {
            prepSessionsArray = JSON.parse(truncatedStr);
            console.warn(`  Repair successful! Recovered ${prepSessionsArray.length} sessions.`);
            repaired = true;
          } catch (repairError) {
            console.error('Repair via display_order match failed:', repairError);
          }
        }
      }

      if (!repaired) {
        console.error('All repair strategies failed');
        console.error('=== TRUNCATED JSON STRING (first 500 chars) ===');
        console.error(prepSessionsStr.slice(0, 500));
        console.error('=== AROUND ERROR POSITION ===');
        if (errorPosition) {
          console.error(prepSessionsStr.slice(Math.max(0, errorPosition - 200), errorPosition + 200));
        }
        console.error('=== LAST 500 CHARS ===');
        console.error(prepSessionsStr.slice(-500));
        console.error('=== END DEBUG INFO ===');
        const error = new Error('Failed to generate prep sessions - prep_sessions was string but not valid JSON') as Error & { rawResponse?: string };
        error.rawResponse = prepSessionsStr.slice(0, 50000);
        throw error;
      }
    }
  } else {
    prepSessionsArray = rawResult?.prep_sessions as NewPrepSessionsResponse['prep_sessions'];
  }

  // Also handle daily_assembly if it's a string
  if (typeof rawResult?.daily_assembly === 'string') {
    console.warn('LLM returned daily_assembly as string, parsing...');
    try {
      dailyAssemblyObj = JSON.parse(rawResult.daily_assembly);
    } catch {
      // daily_assembly is optional, just set to empty object if parsing fails
      dailyAssemblyObj = {};
    }
  } else if (rawResult?.daily_assembly) {
    dailyAssemblyObj = rawResult.daily_assembly as NewPrepSessionsResponse['daily_assembly'];
  }

  // Reconstruct the parsed object with properly typed values
  const parsed: NewPrepSessionsResponse = {
    prep_sessions: prepSessionsArray,
    daily_assembly: dailyAssemblyObj,
  };

  // Validate that we got a valid response with prep_sessions array
  if (!parsed || !parsed.prep_sessions || !Array.isArray(parsed.prep_sessions)) {
    console.error('=== PREP SESSIONS VALIDATION FAILED ===');
    console.error('  parsed is null/undefined:', parsed == null);
    console.error('  typeof parsed:', typeof parsed);
    if (parsed) {
      console.error('  Object.keys(parsed):', Object.keys(parsed));
      console.error('  parsed.prep_sessions exists:', 'prep_sessions' in parsed);
      console.error('  typeof parsed.prep_sessions:', typeof parsed.prep_sessions);
      console.error('  Is array:', Array.isArray(parsed.prep_sessions));
    }
    const rawResponse = JSON.stringify(parsed, null, 2);
    console.error('  Full response:', rawResponse.slice(0, 2000));
    console.error('=== END VALIDATION FAILURE ===');

    // Create an error with the raw response attached for debugging
    const error = new Error('Failed to generate prep sessions - LLM returned invalid response structure') as Error & { rawResponse?: string };
    error.rawResponse = rawResponse.slice(0, 50000); // Limit to 50KB for storage
    throw error;
  }

  // Additional validation: ensure we have at least one prep session
  if (parsed.prep_sessions.length === 0) {
    console.error('LLM returned empty prep_sessions array');
    const error = new Error('Failed to generate prep sessions - no sessions returned') as Error & { rawResponse?: string };
    error.rawResponse = JSON.stringify(parsed, null, 2);
    throw error;
  }

  // Convert new format to PrepModeResponse format for backward compatibility
  // The new format includes prep_tasks with detailed_steps, cooking_temps, cooking_times, tips
  const prepModeResponse: PrepModeResponse = {
    prepSessions: parsed.prep_sessions.map(session => ({
      sessionName: session.session_name,
      sessionOrder: session.display_order,
      estimatedMinutes: session.estimated_minutes,
      instructions: `${session.session_type} session${session.session_day ? ` on ${session.session_day}` : ''}`,
      prepItems: session.prep_tasks.map(task => ({
        item: task.description,
        quantity: '',
        method: task.detailed_steps?.join(' → ') || '', // Include detailed steps in method for legacy
        storage: task.storage || '',
        feeds: task.meal_ids.map(mealId => {
          // Parse meal_id format: "meal_monday_lunch_0"
          const parts = mealId.split('_');
          if (parts.length >= 3) {
            return {
              day: parts[1] as DayOfWeek,
              meal: parts[2] as MealType,
            };
          }
          return { day: 'monday' as DayOfWeek, meal: 'dinner' as MealType };
        }),
      })),
      // Store new fields for the UI - ensure detailed fields are preserved
      sessionType: session.session_type,
      sessionDay: session.session_day,
      sessionTimeOfDay: session.session_time_of_day,
      prepForDate: session.prep_for_date,
      prepTasks: session.prep_tasks.map(task => ({
        ...task,
        // Ensure detailed_steps is always an array
        detailed_steps: task.detailed_steps || [],
        // Ensure cooking_temps and cooking_times are preserved
        cooking_temps: task.cooking_temps || undefined,
        cooking_times: task.cooking_times || undefined,
        tips: task.tips || [],
        storage: task.storage || undefined,
        equipment_needed: task.equipment_needed || undefined,
        ingredients_to_prep: task.ingredients_to_prep || undefined,
      })),
      displayOrder: session.display_order,
    })),
    dailyAssembly: parsed.daily_assembly || {},
  };

  // Store the raw new format for the new prep view UI
  (prepModeResponse as PrepModeResponse & { newPrepSessions: NewPrepSessionsResponse['prep_sessions'] }).newPrepSessions = parsed.prep_sessions;

  return prepModeResponse;
}

/**
 * Get a human-readable description of the household size
 */
function getHouseholdDescription(servings: HouseholdServingsPrefs): string {
  let totalAdults = 1; // Athlete
  let totalChildren = 0;

  const mealTypes = ['breakfast', 'lunch', 'dinner', 'snacks'] as const;

  for (const day of DAYS_OF_WEEK) {
    for (const meal of mealTypes) {
      const dayServings = servings[day]?.[meal];
      if (dayServings) {
        totalAdults = Math.max(totalAdults, 1 + (dayServings.adults || 0));
        totalChildren = Math.max(totalChildren, dayServings.children || 0);
      }
    }
  }

  if (totalChildren > 0) {
    return `${totalAdults} adults and ${totalChildren} children`;
  }
  return totalAdults === 1 ? 'just the athlete' : `${totalAdults} adults`;
}

/**
 * Generate grocery list from core ingredients
 * Converts core ingredients to practical shopping quantities
 * Scales quantities based on household servings
 */
export async function generateGroceryListFromCoreIngredients(
  coreIngredients: CoreIngredients,
  days: DayPlan[],
  userId: string,
  profile?: UserProfile
): Promise<Ingredient[]> {
  // First, collect all ingredient usage from meals to understand quantities
  const ingredientUsage: Map<string, { count: number; amounts: string[] }> = new Map();

  for (const day of days) {
    for (const meal of day.meals) {
      for (const ing of meal.ingredients) {
        const key = ing.name.toLowerCase();
        const existing = ingredientUsage.get(key) || { count: 0, amounts: [] };
        existing.count += 1;
        existing.amounts.push(`${ing.amount} ${ing.unit}`);
        ingredientUsage.set(key, existing);
      }
    }
  }

  // Build usage summary
  const usageSummary = Array.from(ingredientUsage.entries())
    .map(([name, data]) => `${name}: used ${data.count} times (${data.amounts.join(', ')})`)
    .join('\n');

  // Calculate household scaling if applicable
  const householdServings = profile?.household_servings ?? DEFAULT_HOUSEHOLD_SERVINGS_PREFS;
  const avgMultiplier = getAverageServingMultiplier(householdServings);
  const householdHasMembers = hasHouseholdMembers(householdServings);

  let householdScalingSection = '';
  if (householdHasMembers) {
    householdScalingSection = `
## HOUSEHOLD SCALING - READ CAREFULLY
The ingredient usage above shows ATHLETE-ONLY portions (1 person).
The household has ${getHouseholdDescription(householdServings)}, which means an average of ${avgMultiplier.toFixed(1)}x portions per meal.

**YOUR TASK**: Multiply the total ingredient amounts by approximately ${avgMultiplier.toFixed(1)}x to account for the full household, THEN consolidate into practical shopping quantities.

Example: If the athlete uses "chicken breast: 8 oz × 7 meals = 56 oz (3.5 lb)" for the week,
the household (${avgMultiplier.toFixed(1)}x) needs approximately ${(3.5 * avgMultiplier).toFixed(1)} lb total.
`;
  } else {
    householdScalingSection = `
## SCALING NOTE
This meal plan is for a SINGLE PERSON (the athlete only). No household scaling needed.
Simply consolidate the ingredient usage into practical shopping quantities.
`;
  }

  const prompt = `You are creating a practical grocery shopping list from a meal plan's core ingredients.

## CORE INGREDIENTS
${JSON.stringify(coreIngredients, null, 2)}

## INGREDIENT USAGE IN MEALS
${usageSummary}
${householdScalingSection}

## CRITICAL: REASONABLENESS CHECKS
Before finalizing quantities, validate that they make sense for ONE WEEK of meals:

**Red flags that indicate you're calculating wrong:**
- More than 15 of any single fruit or vegetable (e.g., 40 bell peppers is WRONG)
- More than 20 of any citrus or small fruit (e.g., 26 oranges is WRONG)
- More than 12 avocados (unless explicitly used in every single meal)
- More than 5 lbs of any single vegetable
- More than 8 lbs total protein for a household of 2-4 people

**Realistic weekly quantities for a household of 3-4 people:**
- Proteins: 4-6 lbs total (e.g., 2 lbs chicken + 2 lbs ground turkey + 1.5 lbs fish)
- Leafy greens: 1-2 bags spinach, 1 bunch kale
- Vegetables: 6-10 bell peppers MAX, 4-6 zucchini, 3-5 lbs broccoli
- Fruits: 2 bunches bananas (6-8 bananas), 6-12 oranges, 6-10 avocados
- Sweet potatoes: 3-5 lbs
- Grains: 2-3 lbs rice, 1-2 bags/boxes oats

If your calculated quantities exceed these by 2x or more, you're scaling incorrectly.

## INSTRUCTIONS
Convert these core ingredients into a practical grocery shopping list with realistic quantities.

**SCALING REMINDER:**
${householdHasMembers
  ? `The usage data above shows ATHLETE-ONLY portions. You MUST apply the ${avgMultiplier.toFixed(1)}x household multiplier when calculating totals, then consolidate into practical shopping units.`
  : `The usage data shows athlete-only portions. Round up slightly for shopping convenience.`}

Use practical shopping quantities:
- Use "whole" or count for items bought individually (e.g., "6" bell peppers, NOT "40")
- Use "lb" or "oz" for meats and proteins
- Use "bag" for items typically sold in bags
- Use "bunch" for herbs and leafy greens
- Use "container" or "package" for yogurt, tofu, etc.
- Round up modestly to ensure enough food, but stay realistic

## RESPONSE FORMAT
Return ONLY valid JSON:
Sort by category: produce, protein, dairy, grains, pantry, frozen, other.

Use the generate_grocery_list tool to provide your grocery list.`;

  // Use tool use for guaranteed valid JSON output
  const { result: parsed } = await callLLMWithToolUse<{ grocery_list: Ingredient[] }>({
    prompt,
    tool: groceryListSchema,
    maxTokens: 12000,
    userId,
    promptType: 'two_stage_grocery_list',
  });

  // Define reasonable maximum quantities for a week's worth of groceries
  // These limits are generous enough for a family of 4-5 but prevent absurd quantities
  const maxQuantities: Record<string, { max: number; unit: string }> = {
    // Produce - whole items
    'bell pepper': { max: 12, unit: 'whole' },
    'avocado': { max: 14, unit: 'whole' },
    'orange': { max: 18, unit: 'whole' },
    'apple': { max: 18, unit: 'whole' },
    'banana': { max: 14, unit: 'whole' },
    'lemon': { max: 10, unit: 'whole' },
    'lime': { max: 10, unit: 'whole' },
    'onion': { max: 8, unit: 'whole' },
    'zucchini': { max: 10, unit: 'whole' },
    'cucumber': { max: 8, unit: 'whole' },
    'tomato': { max: 12, unit: 'whole' },
    'sweet potato': { max: 10, unit: 'whole' },
    // Proteins - by weight
    'chicken': { max: 8, unit: 'lb' },
    'beef': { max: 6, unit: 'lb' },
    'salmon': { max: 5, unit: 'lb' },
    'fish': { max: 5, unit: 'lb' },
    'turkey': { max: 6, unit: 'lb' },
    'pork': { max: 5, unit: 'lb' },
    'shrimp': { max: 3, unit: 'lb' },
  };

  // Validate and cap quantities
  const warnings: string[] = [];
  const cappedGroceryList = parsed.grocery_list.map(item => {
    const amount = parseFloat(item.amount);
    if (isNaN(amount)) return item;

    const nameLower = item.name.toLowerCase();

    // Check against specific limits
    for (const [ingredient, limit] of Object.entries(maxQuantities)) {
      if (nameLower.includes(ingredient) && amount > limit.max) {
        warnings.push(`Capped ${item.name}: ${amount} → ${limit.max} ${item.unit}`);
        return { ...item, amount: String(limit.max) };
      }
    }

    // General fallback limits for items not in the specific list
    if (item.unit === 'whole' && amount > 20 && !nameLower.includes('egg')) {
      warnings.push(`Capped ${item.name}: ${amount} → 15 whole`);
      return { ...item, amount: '15' };
    }
    if (item.unit === 'lb' && amount > 10) {
      warnings.push(`Capped ${item.name}: ${amount} → 8 lb`);
      return { ...item, amount: '8' };
    }

    return item;
  });

  if (warnings.length > 0) {
    console.warn('Grocery list quantities capped:', warnings);
    // Log to database for monitoring
    await logLLMCall({
      user_id: userId,
      prompt: 'QUANTITY_CAPPED',
      output: warnings.join('; '),
      model: 'validation',
      prompt_type: 'grocery_list_validation',
    });
  }

  return cappedGroceryList;
}

/**
 * Progress callback type for streaming updates
 */
export type ProgressCallback = (stage: string, message: string) => void;

/**
 * Helper function to organize meals into day plans
 */
export function organizeMealsIntoDays(mealsResult: { meals: Array<MealWithIngredientNutrition & { day: DayOfWeek }> }): DayPlan[] {
  const mealsByDay = new Map<DayOfWeek, Meal[]>();
  for (const day of DAYS) {
    mealsByDay.set(day, []);
  }

  for (const meal of mealsResult.meals) {
    const dayMeals = mealsByDay.get(meal.day as DayOfWeek) || [];
    dayMeals.push({
      name: meal.name,
      type: meal.type,
      prep_time_minutes: meal.prep_time_minutes,
      ingredients: meal.ingredients,
      instructions: meal.instructions,
      macros: meal.macros,
    });
    mealsByDay.set(meal.day as DayOfWeek, dayMeals);
  }

  // Build day plans with totals
  return DAYS.map(day => {
    const meals = mealsByDay.get(day) || [];
    const daily_totals: Macros = meals.reduce(
      (totals, meal) => ({
        calories: totals.calories + meal.macros.calories,
        protein: totals.protein + meal.macros.protein,
        carbs: totals.carbs + meal.macros.carbs,
        fat: totals.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    );

    return { day, meals, daily_totals };
  });
}

/**
 * Main two-stage meal plan generation function
 * Orchestrates all three stages and returns a complete meal plan with prep sessions
 */
export async function generateMealPlanTwoStage(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[],
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  selectedTheme?: MealPlanTheme
): Promise<{
  days: DayPlan[];
  grocery_list: Ingredient[];
  core_ingredients: CoreIngredients;
  prep_sessions: PrepModeResponse;
}> {
  // Use the progress version with a no-op callback
  return generateMealPlanWithProgress(
    profile,
    userId,
    recentMealNames,
    mealPreferences,
    validatedMeals,
    ingredientPreferences,
    selectedTheme,
    () => {} // No-op progress callback
  );
}

/**
 * Main two-stage meal plan generation function WITH progress callbacks
 * Orchestrates all stages with streaming progress updates
 * Parallelizes grocery list and prep sessions for better performance
 */
export async function generateMealPlanWithProgress(
  profile: UserProfile,
  userId: string,
  recentMealNames?: string[],
  mealPreferences?: { liked: string[]; disliked: string[] },
  validatedMeals?: ValidatedMealMacros[],
  ingredientPreferences?: { liked: string[]; disliked: string[] },
  selectedTheme?: MealPlanTheme,
  onProgress?: ProgressCallback
): Promise<{
  days: DayPlan[];
  grocery_list: Ingredient[];
  core_ingredients: CoreIngredients;
  prep_sessions: PrepModeResponse;
}> {
  const progress = onProgress || (() => {});

  // ===== TEST MODE: Check for fixture mode =====
  const testConfig = getTestConfig();
  if (testConfig.mode === 'fixture' && process.env.MEAL_PLAN_TEST_MODE) {
    console.log('[TEST MODE] FIXTURE MODE: Returning mock meal plan (no API calls)');
    const { FIXTURE_MEAL_PLAN, FIXTURE_GROCERY_LIST, FIXTURE_CORE_INGREDIENTS, FIXTURE_PREP_SESSIONS } = await import('./claude_test');
    return {
      days: FIXTURE_MEAL_PLAN,
      grocery_list: FIXTURE_GROCERY_LIST,
      core_ingredients: FIXTURE_CORE_INGREDIENTS,
      prep_sessions: FIXTURE_PREP_SESSIONS,
    };
  }

  // Log test mode if active
  if (testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    const { logTestMode, logSavings } = await import('./claude_test');
    logTestMode(testConfig);
    logSavings(testConfig);
  }
  // ===== END TEST MODE =====

  // Stage 1: Generate core ingredients (with theme)
  progress('ingredients', selectedTheme
    ? `Selecting ${selectedTheme.display_name} ingredients...`
    : 'Selecting ingredients based on your macros...');
  const coreIngredients = await generateCoreIngredients(
    profile,
    userId,
    recentMealNames,
    mealPreferences,
    ingredientPreferences,
    selectedTheme
  );
  progress('ingredients_done', 'Ingredients selected!');

  // Stage 2: Generate meals from core ingredients (with theme)
  progress('meals', selectedTheme
    ? `Creating your ${selectedTheme.display_name} meal plan...`
    : 'Creating your 7-day meal plan...');
  const mealsResult = await generateMealsFromCoreIngredients(
    profile,
    coreIngredients,
    userId,
    mealPreferences,
    validatedMeals,
    selectedTheme
  );
  progress('meals_done', 'Meals created!');

  // ===== TEST MODE: Handle day repetition =====
  let days: DayPlan[];
  if (!testConfig.generateFullWeek && testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    // Extract Monday meals and repeat across the week
    const { extractMondayMeals, repeatDayAcrossWeek } = await import('./claude_test');
    console.log('[TEST MODE] Repeating Monday meals across all 7 days...');
    const mondayMeals = extractMondayMeals(mealsResult);
    days = repeatDayAcrossWeek(mondayMeals);
  } else {
    // Normal full week organization
    days = organizeMealsIntoDays(mealsResult);
  }
  // ===== END TEST MODE =====

  // Stage 3: Generate grocery list AND prep sessions IN PARALLEL
  // This is a key performance optimization - these two tasks are independent
  progress('finalizing', 'Building grocery list and prep schedule...');

  // ===== TEST MODE: Skip prep sessions if configured =====
  let grocery_list: Ingredient[];
  let prep_sessions: PrepModeResponse;

  if (testConfig.skipPrepSessions && testConfig.mode !== 'production' && process.env.MEAL_PLAN_TEST_MODE) {
    console.log('[TEST MODE] Skipping prep sessions generation');
    grocery_list = await generateGroceryListFromCoreIngredients(coreIngredients, days, userId, profile);
    prep_sessions = { prepSessions: [], dailyAssembly: {} };
  } else {
    [grocery_list, prep_sessions] = await Promise.all([
      generateGroceryListFromCoreIngredients(coreIngredients, days, userId, profile),
      generatePrepSessions(days, coreIngredients, profile, userId),
    ]);
  }
  // ===== END TEST MODE =====

  progress('finalizing_done', 'Almost done!');

  return {
    days,
    grocery_list,
    core_ingredients: coreIngredients,
    prep_sessions,
  };
}

/**
 * Generate prep sessions for an existing meal plan
 * Can be called separately if prep mode wasn't generated initially
 */
export async function generatePrepModeForExistingPlan(
  mealPlanId: string,
  userId: string
): Promise<PrepModeResponse> {
  const supabase = await createClient();

  // Fetch the meal plan (normalized structure - no plan_data)
  const { data: mealPlan, error } = await supabase
    .from('meal_plans')
    .select('id, core_ingredients')
    .eq('id', mealPlanId)
    .eq('user_id', userId)
    .single();

  if (error || !mealPlan) {
    throw new Error('Meal plan not found');
  }

  // Fetch meal_plan_meals with their linked meals
  // Use explicit FK reference since there are two FKs to meals table
  const { data: mealPlanMeals, error: mealsError } = await supabase
    .from('meal_plan_meals')
    .select(`
      id,
      day,
      meal_type,
      position,
      meals!meal_plan_meals_meal_id_fkey (
        id,
        name,
        meal_type,
        ingredients,
        instructions,
        calories,
        protein,
        carbs,
        fat,
        prep_time_minutes
      )
    `)
    .eq('meal_plan_id', mealPlanId)
    .order('day')
    .order('meal_type')
    .order('position');

  if (mealsError) {
    throw new Error('Failed to fetch meal plan meals');
  }

  // Fetch user profile for prep preferences
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single();

  if (!profile) {
    throw new Error('User profile not found');
  }

  // Convert normalized meals to DayPlan[] format for generatePrepSessions
  type DayOfWeekType = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';
  const DAYS_ORDER: DayOfWeekType[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
  const daysMap = new Map<DayOfWeekType, Meal[]>();

  for (const mpm of mealPlanMeals || []) {
    const day = mpm.day as DayOfWeekType;
    if (!daysMap.has(day)) {
      daysMap.set(day, []);
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mealData = mpm.meals as any;
    if (!mealData) continue;

    const meal: Meal = {
      name: mealData.name,
      type: mealData.meal_type,
      prep_time_minutes: mealData.prep_time_minutes,
      ingredients: mealData.ingredients,
      instructions: mealData.instructions,
      macros: {
        calories: mealData.calories,
        protein: mealData.protein,
        carbs: mealData.carbs,
        fat: mealData.fat,
      },
    };

    daysMap.get(day)!.push(meal);
  }

  // Build days array in proper order
  const days: DayPlan[] = DAYS_ORDER.map(day => ({
    day,
    meals: daysMap.get(day) || [],
    daily_totals: (daysMap.get(day) || []).reduce(
      (acc, meal) => ({
        calories: acc.calories + meal.macros.calories,
        protein: acc.protein + meal.macros.protein,
        carbs: acc.carbs + meal.macros.carbs,
        fat: acc.fat + meal.macros.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    ),
  }));

  const rawCoreIngredients = mealPlan.core_ingredients as Record<string, string[]> | null;

  // Normalize core ingredients to handle legacy 'pantry' field
  const ingredients: CoreIngredients = normalizeCoreIngredients(rawCoreIngredients) || {
    proteins: [],
    vegetables: [],
    fruits: [],
    grains: [],
    fats: [],
    dairy: [],
  };

  return generatePrepSessions(days, ingredients, profile as UserProfile, userId);
}

